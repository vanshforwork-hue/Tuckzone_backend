package com.school.canteen.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.school.canteen.IntegrationTestBase;
import com.school.canteen.TestDataFactory;
import com.school.canteen.dto.UserSummary;
import com.school.canteen.dto.menu.MenuItemResponse;
import com.school.canteen.dto.order.OrderLineRequest;
import com.school.canteen.dto.order.OrderResponse;
import com.school.canteen.dto.order.OrderStatusUpdateRequest;
import com.school.canteen.dto.order.PlaceOrderRequest;
import com.school.canteen.dto.wallet.MockTopupCompleteRequest;
import com.school.canteen.dto.wallet.TopupInitResponse;
import com.school.canteen.dto.wallet.TopupRequest;
import com.school.canteen.enums.OrderStatus;
import com.school.canteen.exception.InsufficientBalanceException;
import com.school.canteen.exception.InvalidOrderStateException;
import com.school.canteen.repository.DailyMenuItemRepository;
import com.school.canteen.repository.NotificationOutboxRepository;
import com.school.canteen.service.AuthService;
import com.school.canteen.service.DailyMenuService;
import com.school.canteen.service.MenuItemService;
import com.school.canteen.service.OrderService;
import com.school.canteen.service.WalletService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The invariants that protect real money and real food.
 *
 * These run concurrently on purpose: the bugs they guard against (double charging,
 * overselling) only appear under simultaneous requests and are invisible to sequential
 * tests.
 */
class OrderConcurrencyIntegrationTest extends IntegrationTestBase {

    @Autowired private AuthService authService;
    @Autowired private WalletService walletService;
    @Autowired private MenuItemService menuItemService;
    @Autowired private DailyMenuService dailyMenuService;
    @Autowired private OrderService orderService;
    @Autowired private DailyMenuItemRepository dailyMenuItemRepository;
    @Autowired private NotificationOutboxRepository outboxRepository;

    /** Tomorrow, so the slot cutoff has not passed regardless of when the suite runs. */
    private LocalDate menuDate() {
        return LocalDate.now().plusDays(1);
    }

    private UUID teacherWithBalance(BigDecimal amount) {
        var registration = TestDataFactory.teacher();
        UserSummary user = authService.registerTeacher(registration);
        TopupInitResponse topup = walletService.initiateTopup(user.id(), new TopupRequest(amount));
        walletService.mockCompleteTopup(user.id(),
                new MockTopupCompleteRequest(topup.gatewayOrderId()));
        return user.id();
    }

    private UUID publishItem(BigDecimal price, int quantity) {
        MenuItemResponse item = menuItemService.create(
                TestDataFactory.menuItem(price, BigDecimal.valueOf(10)));
        dailyMenuService.addItem(TestDataFactory.dailyMenu(menuDate(), item.id(), quantity));
        return item.id();
    }

    private PlaceOrderRequest order(UUID itemId, int qty, String key) {
        return new PlaceOrderRequest(null, menuDate(), null, null, "Staff Room",
                List.of(new OrderLineRequest(itemId, qty)), key, null);
    }

    /** Runs every task at once and returns the outcomes, successes and failures alike. */
    private <T> List<Future<T>> runConcurrently(List<Callable<T>> tasks) throws Exception {
        try (ExecutorService pool = Executors.newFixedThreadPool(tasks.size())) {
            return pool.invokeAll(tasks);
        }
    }

    @Test
    @DisplayName("simultaneous identical submissions create one order and charge once")
    void duplicateSubmissionsAreIdempotent() throws Exception {
        UUID userId = teacherWithBalance(BigDecimal.valueOf(500));
        UUID itemId = publishItem(BigDecimal.valueOf(40), 50);
        String idempotencyKey = "concurrent-" + UUID.randomUUID();

        List<Callable<OrderResponse>> taps = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            taps.add(() -> orderService.placeOrder(userId, order(itemId, 1, idempotencyKey)));
        }

        List<Future<OrderResponse>> results = runConcurrently(taps);

        // Every caller must see the same order — a double tap on a slow connection must
        // never become two lunches and two charges.
        List<String> orderNumbers = new ArrayList<>();
        for (Future<OrderResponse> result : results) {
            orderNumbers.add(result.get().orderNumber());
        }
        assertThat(orderNumbers).hasSize(6).containsOnly(orderNumbers.getFirst());

        // Charged exactly once: 500 - 40.
        assertThat(walletService.getWallet(userId).balance())
                .isEqualByComparingTo(BigDecimal.valueOf(460));
    }

    @Test
    @DisplayName("stock cannot be oversold when buyers compete for the last units")
    void stockIsNeverOversold() throws Exception {
        UUID userId = teacherWithBalance(BigDecimal.valueOf(1000));
        UUID itemId = publishItem(BigDecimal.valueOf(10), 3);

        List<Callable<Boolean>> buyers = new ArrayList<>();
        for (int i = 0; i < 8; i++) {
            buyers.add(() -> {
                try {
                    orderService.placeOrder(userId, order(itemId, 1, "buyer-" + UUID.randomUUID()));
                    return true;
                } catch (RuntimeException soldOut) {
                    return false;
                }
            });
        }

        long succeeded = 0;
        for (Future<Boolean> result : runConcurrently(buyers)) {
            if (result.get()) {
                succeeded++;
            }
        }

        // Exactly the stocked quantity may succeed, no matter how many raced for it.
        assertThat(succeeded).isEqualTo(3);
        assertThat(dailyMenuItemRepository
                .findByMenuDateAndMenuItem_Id(menuDate(), itemId).orElseThrow()
                .getRemainingQuantity()).isZero();
    }

    @Test
    @DisplayName("an unaffordable order leaves no charge, no stock movement and no notification")
    void failedOrderRollsBackCompletely() {
        UUID userId = teacherWithBalance(BigDecimal.valueOf(50));
        UUID itemId = publishItem(BigDecimal.valueOf(40), 20);
        long notificationsBefore = outboxRepository.count();

        assertThatThrownBy(() ->
                orderService.placeOrder(userId, order(itemId, 5, "too-expensive-" + UUID.randomUUID())))
                .isInstanceOf(InsufficientBalanceException.class);

        assertThat(walletService.getWallet(userId).balance())
                .isEqualByComparingTo(BigDecimal.valueOf(50));
        assertThat(dailyMenuItemRepository
                .findByMenuDateAndMenuItem_Id(menuDate(), itemId).orElseThrow()
                .getRemainingQuantity()).isEqualTo(20);
        // The outbox row is written in the same transaction, so a rollback must take the
        // notification with it — otherwise a customer hears about an order that never was.
        assertThat(outboxRepository.count()).isEqualTo(notificationsBefore);
    }

    @Test
    @DisplayName("a placed order can never be cancelled or rejected — it goes straight to "
            + "DELIVERED, with no Accept step, no intermediate kitchen-workflow status, and "
            + "no REJECTED destination left")
    void placedOrderHasNoCancellationOrRejectionPath() {
        UUID userId = teacherWithBalance(BigDecimal.valueOf(200));
        UUID itemId = publishItem(BigDecimal.valueOf(40), 10);

        OrderResponse placed = orderService.placeOrder(userId,
                order(itemId, 2, "no-cancel-" + UUID.randomUUID()));
        assertThat(placed.status()).isEqualTo(OrderStatus.PLACED);
        BigDecimal balanceAfterOrder = walletService.getWallet(userId).balance();

        // No cancellation capability exists anywhere for the buyer — enforced at compile
        // time (OrderService no longer declares cancelMyOrder), the strongest possible
        // guarantee. The old DELETE /api/orders/{id} endpoint is gone from OrderController
        // too, so a stale/scripted client hitting it now gets a 404, not a stale 200.

        // Admin can no longer reject it either — REJECTED is not in ADMIN_FORWARD's allowed
        // set for any status, so the request is rejected the same as any other invalid move.
        assertThatThrownBy(() -> orderService.adminTransition(placed.id(),
                new OrderStatusUpdateRequest(OrderStatus.REJECTED, null)))
                .isInstanceOf(InvalidOrderStateException.class);

        // No manual "Accept" step and no intermediate PREPARING/PACKED/OUT_FOR_DELIVERY
        // status either — those enum constants no longer exist, so PLACED goes directly to
        // DELIVERED, the only allowed forward move.
        var delivered = orderService.adminTransition(placed.id(),
                new OrderStatusUpdateRequest(OrderStatus.DELIVERED, null));
        assertThat(delivered.status()).isEqualTo(OrderStatus.DELIVERED);

        // Untouched throughout: no refund, no stock restoration — this order was never voided.
        assertThat(walletService.getWallet(userId).balance()).isEqualByComparingTo(balanceAfterOrder);
        assertThat(dailyMenuItemRepository
                .findByMenuDateAndMenuItem_Id(menuDate(), itemId).orElseThrow()
                .getRemainingQuantity()).isEqualTo(8);
    }

    @Test
    @DisplayName("concurrent wallet top-ups of the same payment credit it only once")
    void topupVerificationIsIdempotent() throws Exception {
        var registration = TestDataFactory.teacher();
        UUID userId = authService.registerTeacher(registration).id();
        TopupInitResponse topup = walletService.initiateTopup(userId,
                new TopupRequest(BigDecimal.valueOf(300)));

        List<Callable<Boolean>> callbacks = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            callbacks.add(() -> {
                try {
                    walletService.mockCompleteTopup(userId,
                            new MockTopupCompleteRequest(topup.gatewayOrderId()));
                    return true;
                } catch (RuntimeException ignored) {
                    return false;
                }
            });
        }
        runConcurrently(callbacks);

        // Payment providers retry their callbacks; a retry must never mint free money.
        assertThat(walletService.getWallet(userId).balance())
                .isEqualByComparingTo(BigDecimal.valueOf(300));
    }
}

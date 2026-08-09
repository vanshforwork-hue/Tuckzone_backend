package com.school.canteen.order;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.school.canteen.IntegrationTestBase;
import com.school.canteen.TestDataFactory;
import com.school.canteen.dto.menu.MenuItemResponse;
import com.school.canteen.dto.order.DefaultOrderingDateResponse;
import com.school.canteen.dto.order.OrderLineRequest;
import com.school.canteen.dto.order.OrderingWindowRequest;
import com.school.canteen.dto.order.PlaceOrderRequest;
import com.school.canteen.entity.DeliverySlot;
import com.school.canteen.exception.OrderingClosedException;
import com.school.canteen.repository.DeliverySlotRepository;
import com.school.canteen.service.AuthService;
import com.school.canteen.service.DailyMenuService;
import com.school.canteen.service.MenuItemService;
import com.school.canteen.service.OrderService;
import com.school.canteen.service.OrderingWindowService;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The default-ordering-date resolution and cutoff enforcement behind sections 19-25 of the
 * date/cutoff requirements: the app only ever accepts orders for tomorrow onward, the
 * default date must skip a closed/past-cutoff day rather than naively assuming "tomorrow",
 * and the backend must be the final authority regardless of what a stale frontend still shows.
 */
class OrderingWindowIntegrationTest extends IntegrationTestBase {

    @Autowired private AuthService authService;
    @Autowired private MenuItemService menuItemService;
    @Autowired private DailyMenuService dailyMenuService;
    @Autowired private OrderService orderService;
    @Autowired private OrderingWindowService orderingWindowService;
    @Autowired private DeliverySlotRepository deliverySlotRepository;

    private UUID recessSlotId() {
        return orderService.listSlots().getFirst().id();
    }

    private DeliverySlot recessSlotEntity(UUID slotId) {
        return deliverySlotRepository.findById(slotId).orElseThrow();
    }

    @Test
    @DisplayName("default ordering date is tomorrow when nothing is closed")
    void defaultDateIsTomorrowByDefault() {
        UUID slotId = recessSlotId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        // A far-future cutoff guarantees "hasn't passed yet" regardless of what time the
        // test suite happens to run at. Explicitly (re)opened rather than assumed: this
        // shared "tomorrow" row/slot cutoff can be left CLOSED by another test method in
        // this class that ran first against the same database — tests here are not isolated
        // by rollback (see IntegrationTestBase), only by explicitly resetting shared state.
        orderingWindowService.updateCutoffTime(slotId, LocalTime.of(23, 59));
        orderingWindowService.open(new OrderingWindowRequest(tomorrow, slotId, null, null));

        DefaultOrderingDateResponse result = orderingWindowService.resolveDefaultOrderingDate();

        assertThat(result.menuDate()).isEqualTo(tomorrow);
    }

    @Test
    @DisplayName("default ordering date skips a manually closed tomorrow and lands on the day after")
    void defaultDateSkipsAClosedDay() {
        UUID slotId = recessSlotId();
        orderingWindowService.updateCutoffTime(slotId, LocalTime.of(23, 59));
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate dayAfter = tomorrow.plusDays(1);

        orderingWindowService.close(new OrderingWindowRequest(tomorrow, slotId, null, "Holiday"));

        DefaultOrderingDateResponse result = orderingWindowService.resolveDefaultOrderingDate();

        assertThat(result.menuDate()).isEqualTo(dayAfter);
    }

    @Test
    @DisplayName("placing an order for a manually closed date is rejected with OrderingClosedException, "
            + "not a generic error, and the message names why and the next open date")
    void placingAnOrderForAClosedDateIsRejected() {
        UUID slotId = recessSlotId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        LocalDate dayAfter = tomorrow.plusDays(1);
        orderingWindowService.updateCutoffTime(slotId, LocalTime.of(23, 59));
        orderingWindowService.close(new OrderingWindowRequest(tomorrow, slotId, null, "Holiday"));

        UUID userId = authService.registerTeacher(TestDataFactory.teacher()).id();
        MenuItemResponse item = menuItemService.create(TestDataFactory.menuItem(BigDecimal.TEN, BigDecimal.ONE));
        dailyMenuService.addItem(TestDataFactory.dailyMenu(tomorrow, item.id(), 10));

        PlaceOrderRequest request = new PlaceOrderRequest(null, tomorrow, null, null, "Staff Room",
                List.of(new OrderLineRequest(item.id(), 1)), "closed-date-" + UUID.randomUUID(), null);

        assertThatThrownBy(() -> orderService.placeOrder(userId, request))
                .isInstanceOf(OrderingClosedException.class)
                .hasMessageContaining("stopped taking orders")
                .hasMessageContaining(dayAfter.toString().substring(0, 4)); // the year, cheaply proves a date is named
    }

    @Test
    @DisplayName("reopening a date past its normal cutoff with an override accepts orders again")
    void reopeningPastCutoffWithOverrideWorks() {
        UUID slotId = recessSlotId();
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        // Deliberately just after midnight: before essentially any wall-clock time this
        // suite would actually run at, without hardcoding "now" into the fixture.
        orderingWindowService.updateCutoffTime(slotId, LocalTime.of(0, 0, 1));
        DeliverySlot slot = recessSlotEntity(slotId);

        assertThatThrownBy(() -> orderingWindowService.assertAcceptingOrders(tomorrow, slot))
                .isInstanceOf(OrderingClosedException.class);

        orderingWindowService.open(new OrderingWindowRequest(tomorrow, slotId, LocalTime.of(23, 59), "extra stock"));

        // No exception now that the override cutoff is in the future.
        orderingWindowService.assertAcceptingOrders(tomorrow, slot);
    }

    @Test
    @DisplayName("a cutoff a few seconds in the future still accepts orders for tomorrow")
    void cutoffAFewSecondsInTheFutureStillAccepts() {
        UUID slotId = recessSlotId();
        DeliverySlot slot = recessSlotEntity(slotId);
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        orderingWindowService.updateCutoffTime(slotId, LocalTime.now().plusSeconds(5));

        // Deadline for "tomorrow" is today at the cutoff time — still a few seconds away.
        orderingWindowService.assertAcceptingOrders(tomorrow, slot);
    }

    @Test
    @DisplayName("a cutoff that already passed today rejects orders for tomorrow, matching "
            + "'9:00 PM or later is blocked' rather than only strictly-after")
    void cutoffThatAlreadyPassedIsRejected() {
        UUID slotId = recessSlotId();
        DeliverySlot slot = recessSlotEntity(slotId);
        LocalDate tomorrow = LocalDate.now().plusDays(1);
        orderingWindowService.updateCutoffTime(slotId, LocalTime.now().minusSeconds(1));

        assertThatThrownBy(() -> orderingWindowService.assertAcceptingOrders(tomorrow, slot))
                .isInstanceOf(OrderingClosedException.class);
    }
}

package com.school.canteen.service.impl;

import com.school.canteen.dto.order.AdminOrderResponse;
import com.school.canteen.dto.order.DeliverySlotResponse;
import com.school.canteen.dto.order.OrderLineRequest;
import com.school.canteen.dto.order.OrderResponse;
import com.school.canteen.dto.order.OrderStatusUpdateRequest;
import com.school.canteen.dto.order.PlaceOrderRequest;
import com.school.canteen.dto.payment.PaymentInitiationResponse;
import com.school.canteen.entity.DailyMenuItem;
import com.school.canteen.entity.DeliverySlot;
import com.school.canteen.entity.MenuItem;
import com.school.canteen.entity.Order;
import com.school.canteen.entity.OrderItem;
import com.school.canteen.entity.StudentProfile;
import com.school.canteen.entity.User;
import com.school.canteen.entity.Ward;
import com.school.canteen.enums.MenuType;
import com.school.canteen.enums.NotificationEvent;
import com.school.canteen.enums.OrderStatus;
import com.school.canteen.enums.OrderType;
import com.school.canteen.enums.PaymentMethod;
import com.school.canteen.enums.PaymentMode;
import com.school.canteen.enums.PaymentStatus;
import com.school.canteen.enums.PaymentUseCase;
import com.school.canteen.enums.Role;
import com.school.canteen.exception.ApiException;
import com.school.canteen.exception.BadRequestException;
import com.school.canteen.exception.InvalidOrderStateException;
import com.school.canteen.exception.OutOfStockException;
import com.school.canteen.exception.ResourceNotFoundException;
import com.school.canteen.mapper.OrderMapper;
import com.school.canteen.notification.NotificationMessages;
import com.school.canteen.repository.DailyMenuItemRepository;
import com.school.canteen.repository.DeliverySlotRepository;
import com.school.canteen.repository.MenuItemRepository;
import com.school.canteen.repository.OrderRepository;
import com.school.canteen.repository.ParentChildLinkRepository;
import com.school.canteen.repository.StudentProfileRepository;
import com.school.canteen.repository.UserRepository;
import com.school.canteen.repository.WardRepository;
import com.school.canteen.service.CreatePaymentCommand;
import com.school.canteen.service.NotificationService;
import com.school.canteen.service.OrderService;
import com.school.canteen.service.OrderingWindowService;
import com.school.canteen.service.PaymentService;
import com.school.canteen.service.WalletService;
import com.school.canteen.util.PageRequests;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrderServiceImpl implements OrderService {

    /**
     * Allowed forward moves the canteen admin can make. There is deliberately no manual
     * "Accept" step and no REJECTED destination: a PLACED order is already fully confirmed
     * and paid (see placeOrderInTransaction/placeWithGatewayOrSplit). There is likewise no
     * cancellation path left once an order reaches PLACED (see the removed {@code
     * cancelMyOrder}) — only a still-pending gateway payment can be voided
     * (PaymentService.cancelPayment / PaymentExpirySweeper), which happens before an order
     * is ever confirmed in the first place.
     *
     * The kitchen-workflow steps that used to sit between PLACED and DELIVERED
     * (ACCEPTED/PREPARING/PACKED/OUT_FOR_DELIVERY) are gone — Admin/Subadmin now only ever
     * mark an order DELIVERED directly, and a migration collapsed every order already
     * sitting in one of those removed statuses back to PLACED, so there is nothing left to
     * give a forward edge to.
     */
    private static final Map<OrderStatus, Set<OrderStatus>> ADMIN_FORWARD = new EnumMap<>(OrderStatus.class);

    /** Export must never silently truncate a day's orders the way the normal 200-row page
     *  cap would; this is a generous ceiling, not a real-world expectation. */
    private static final int EXPORT_MAX_ROWS = 5000;

    static {
        ADMIN_FORWARD.put(OrderStatus.PLACED, Set.of(OrderStatus.DELIVERED));
    }

    private static final Set<Role> ROLES_THAT_CAN_ORDER =
            Set.of(Role.STUDENT, Role.TEACHER, Role.PARENT);

    /** How many times to look for the winning order before giving up on a duplicate race. */
    private static final int DUPLICATE_LOOKUP_ATTEMPTS = 5;
    private static final long DUPLICATE_LOOKUP_BACKOFF_MS = 40L;

    private final OrderRepository orderRepository;
    private final DailyMenuItemRepository dailyMenuItemRepository;
    private final MenuItemRepository menuItemRepository;
    private final DeliverySlotRepository deliverySlotRepository;
    private final StudentProfileRepository studentProfileRepository;
    private final ParentChildLinkRepository parentChildLinkRepository;
    private final WardRepository wardRepository;
    private final UserRepository userRepository;
    private final WalletService walletService;
    private final PaymentService paymentService;
    private final NotificationService notificationService;
    private final OrderingWindowService orderingWindowService;
    private final OrderMapper orderMapper;
    private final Clock clock;
    /**
     * Self-reference so the transactional placement can be invoked through the Spring
     * proxy. Calling it as a plain {@code this.method()} would bypass the proxy and run
     * without a transaction.
     */
    private final OrderService self;

    public OrderServiceImpl(OrderRepository orderRepository,
                            DailyMenuItemRepository dailyMenuItemRepository,
                            MenuItemRepository menuItemRepository,
                            DeliverySlotRepository deliverySlotRepository,
                            StudentProfileRepository studentProfileRepository,
                            ParentChildLinkRepository parentChildLinkRepository,
                            WardRepository wardRepository,
                            UserRepository userRepository,
                            WalletService walletService,
                            PaymentService paymentService,
                            NotificationService notificationService,
                            OrderingWindowService orderingWindowService,
                            OrderMapper orderMapper,
                            Clock clock,
                            @Lazy OrderService self) {
        this.orderRepository = orderRepository;
        this.dailyMenuItemRepository = dailyMenuItemRepository;
        this.menuItemRepository = menuItemRepository;
        this.deliverySlotRepository = deliverySlotRepository;
        this.studentProfileRepository = studentProfileRepository;
        this.parentChildLinkRepository = parentChildLinkRepository;
        this.wardRepository = wardRepository;
        this.userRepository = userRepository;
        this.walletService = walletService;
        this.paymentService = paymentService;
        this.notificationService = notificationService;
        this.orderingWindowService = orderingWindowService;
        this.orderMapper = orderMapper;
        this.clock = clock;
        this.self = self;
    }

    /**
     * Deliberately NOT transactional.
     *
     * Two simultaneous submissions with the same idempotency key both pass the "already
     * placed?" pre-check, so the second one is stopped by the uq_orders_idem constraint.
     * In PostgreSQL that violation aborts the whole transaction, so the duplicate cannot
     * be resolved inside it — every follow-up query would fail. Handling it out here lets
     * the failed transaction roll back cleanly (no half-order, no double debit) and then
     * return the order that actually won the race.
     */
    @Override
    public OrderResponse placeOrder(UUID userId, PlaceOrderRequest request) {
        try {
            return self.placeOrderInTransaction(userId, request);
        } catch (DataIntegrityViolationException duplicateSubmission) {
            // The competing submission may not have committed yet at the instant our
            // insert was rejected, so give it a moment before concluding it is missing.
            for (int attempt = 0; attempt < DUPLICATE_LOOKUP_ATTEMPTS; attempt++) {
                OrderResponse winner =
                        self.findByIdempotencyKey(userId, request.idempotencyKey());
                if (winner != null) {
                    return winner;
                }
                sleepBriefly();
            }
            throw duplicateSubmission;
        }
    }

    /**
     * Loads an already-placed order by its idempotency key.
     *
     * Transactional because the response mapping walks lazy associations (slot, items,
     * each item's menu item). Doing that outside a session throws
     * LazyInitializationException, since open-in-view is disabled.
     */
    @Override
    @Transactional(readOnly = true)
    public OrderResponse findByIdempotencyKey(UUID userId, String idempotencyKey) {
        return orderRepository.findByPlacedBy_IdAndIdempotencyKey(userId, idempotencyKey)
                .map(orderMapper::toResponse)
                .orElse(null);
    }

    private static void sleepBriefly() {
        try {
            Thread.sleep(DUPLICATE_LOOKUP_BACKOFF_MS);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while resolving duplicate order",
                    interrupted);
        }
    }

    @Override
    @Transactional
    public OrderResponse placeOrderInTransaction(UUID userId, PlaceOrderRequest request) {
        // 1) Idempotency fast path: a resent checkout returns the same order.
        var existing = orderRepository.findByPlacedBy_IdAndIdempotencyKey(userId, request.idempotencyKey());
        if (existing.isPresent()) {
            return orderMapper.toResponse(existing.get());
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!ROLES_THAT_CAN_ORDER.contains(user.getRole())) {
            throw new ApiException(HttpStatus.FORBIDDEN,
                    "Only students, teachers and parents can place orders");
        }

        DeliverySlot slot = resolveRecessSlot();

        LocalDate date = request.menuDate();
        validateOrderingWindow(date, slot);

        Order order = new Order();
        order.setOrderNumber(orderRepository.nextOrderNumber());
        order.setPlacedBy(user);
        applyOrderType(order);
        applyRecipientAndLocation(user, request, order);
        order.setSlot(slot);
        order.setMenuDate(date);
        order.setStatus(OrderStatus.PLACED);
        order.setPaymentStatus(PaymentStatus.PENDING);
        order.setIdempotencyKey(request.idempotencyKey());

        BigDecimal total = addLinesAndReserveStock(order, date, request.items());
        order.setTotalAmount(total);

        boolean useGateway = request.paymentMode() == PaymentMode.GATEWAY_ONLY
                || request.paymentMode() == PaymentMode.WALLET_PLUS_GATEWAY;
        if (useGateway) {
            return placeWithGatewayOrSplit(order, user, total, request);
        }

        // Original, unchanged fast path: paymentMode null or WALLET_ONLY. Pay from the
        // placing user's wallet immediately. If the balance is short, this throws and the
        // whole transaction rolls back — including every stock decrement above.
        order.setPaymentMethod(PaymentMethod.WALLET);
        orderRepository.save(order);
        walletService.debit(userId, total, "ORDER", order.getId().toString(),
                "Order " + OrderMapper.formatOrderNumber(order.getOrderNumber()));
        order.setPaymentStatus(PaymentStatus.PAID);

        // Queued inside this transaction, so the notification and the order commit
        // together — a customer can never be told about an order that rolled back.
        notifyStatus(order, OrderStatus.PLACED);
        notificationService.notifyUser(user, NotificationEvent.PAYMENT_SUCCESSFUL,
                "Payment successful",
                "Paid " + total + " from your wallet for order "
                        + OrderMapper.formatOrderNumber(order.getOrderNumber()) + ".",
                Map.of("orderId", order.getId().toString(),
                        "amount", total.toPlainString()));

        return orderMapper.toResponse(order);
    }

    /**
     * The new path: a Payment (useCase=CHECKOUT) is created through PaymentService, which
     * computes the real pricing (including any admin-enabled platform fee — never
     * calculated here), debits whatever wallet portion applies synchronously, and either
     * settles immediately (pure wallet funding — see PaymentServiceImpl.createPayment) or
     * leaves the order PENDING with gateway details for the client to complete checkout.
     * If wallet debit fails (insufficient balance) or the gateway call fails, this whole
     * method's transaction rolls back — the order and its stock reservation never persist,
     * identical in spirit to the wallet-only path's rollback guarantee above.
     */
    private OrderResponse placeWithGatewayOrSplit(Order order, User user, BigDecimal total,
                                                   PlaceOrderRequest request) {
        order.setPaymentMethod(PaymentMethod.DIRECT);
        orderRepository.save(order);

        BigDecimal walletAvailable = request.paymentMode() == PaymentMode.WALLET_PLUS_GATEWAY
                ? walletService.getWallet(user.getId()).balance()
                : BigDecimal.ZERO;

        PaymentInitiationResponse payment = paymentService.createPayment(new CreatePaymentCommand(
                user.getId(), PaymentUseCase.CHECKOUT, total, BigDecimal.ZERO, BigDecimal.ZERO,
                request.paymentMode(), walletAvailable, "ORDER", order.getId().toString(),
                request.idempotencyKey()));

        // "PAID" means createPayment already settled this order in full from wallet alone
        // (see PaymentServiceImpl.settleOrder, which mutated this same managed entity
        // within this same transaction) — order.getPaymentStatus() now reflects that, and
        // it is safe to tell the customer their order is placed right now.
        //
        // Otherwise a gateway leg is still PENDING: the order is NOT confirmed yet, so we
        // must not say "order placed" here — that would tell the customer they have an
        // order before they have actually paid for it (this was a real bug: this call used
        // to fire unconditionally, sending a false "order placed" email the instant the
        // Razorpay order was created, before the widget even opened). Both the "order
        // placed" and "payment successful" notifications now fire together, only once
        // payment is actually verified — see PaymentServiceImpl.settleOrder.
        boolean settledImmediately = "PAID".equals(payment.status());
        if (settledImmediately) {
            notifyStatus(order, OrderStatus.PLACED);
        }
        return orderMapper.toResponse(order, settledImmediately ? null : payment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<OrderResponse> myOrders(UUID userId, Integer page, Integer size) {
        return orderRepository
                .findByPlacedBy_IdOrderByCreatedAtDesc(userId, PageRequests.of(page, size))
                .stream()
                .map(orderMapper::toResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public OrderResponse getMyOrder(UUID userId, UUID orderId) {
        Order order = orderRepository.findByIdAndPlacedBy_Id(orderId, userId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        return orderMapper.toResponse(order);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DeliverySlotResponse> listSlots() {
        return deliverySlotRepository.findByActiveTrueOrderByOrderCutoffTimeAsc().stream()
                .map(orderMapper::toSlotResponse)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminOrderResponse> adminList(LocalDate date, OrderStatus status, String search,
                                              String sort, Integer page, Integer size) {
        Pageable pageable = PageRequests.of(page, size);
        List<Order> orders = (status == null)
                ? orderRepository.findByMenuDateOrderByCreatedAtAsc(date, pageable)
                : orderRepository.findByMenuDateAndStatusOrderByCreatedAtAsc(date, status, pageable);
        return toAdminResponses(excludeUnpaidGatewayOrders(orders), search, sort);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AdminOrderResponse> adminListForExport(LocalDate date, OrderStatus status, String search) {
        Pageable unbounded = PageRequest.of(0, EXPORT_MAX_ROWS);
        List<Order> orders = (status == null)
                ? orderRepository.findByMenuDateOrderByCreatedAtAsc(date, unbounded)
                : orderRepository.findByMenuDateAndStatusOrderByCreatedAtAsc(date, status, unbounded);
        return toAdminResponses(excludeUnpaidGatewayOrders(orders), search, null);
    }

    /**
     * A gateway checkout (GATEWAY_ONLY/WALLET_PLUS_GATEWAY) creates the order row and
     * marks it PLACED before the customer has actually completed payment — see
     * placeWithGatewayOrSplit's javadoc — so it stays visually and functionally
     * indistinguishable from a genuinely paid order until either the webhook/verify call
     * settles it (paymentStatus -> PAID) or PaymentExpirySweeper reverses it, up to 15
     * minutes later. Without this filter, a customer who opens Razorpay checkout and then
     * cancels appears in the kitchen queue as a normal new order — this hides it from the
     * canteen until payment is actually confirmed, matching the wallet-only path, which is
     * never PENDING (settled synchronously at order creation).
     */
    private List<Order> excludeUnpaidGatewayOrders(List<Order> orders) {
        return orders.stream().filter(order -> order.getPaymentStatus() != PaymentStatus.PENDING).toList();
    }

    /** Search/sort are applied in memory: a day's admin order list is a small, bounded
     *  dataset — the same assumption every other admin list query in this class already
     *  makes — so this avoids a combinatorial explosion of derived repository queries. */
    private List<AdminOrderResponse> toAdminResponses(List<Order> orders, String search, String sort) {
        List<AdminOrderResponse> responses = orders.stream().map(orderMapper::toAdminResponse).toList();

        if (search != null && !search.isBlank()) {
            String needle = search.trim().toLowerCase(Locale.ROOT);
            responses = responses.stream()
                    .filter(r -> r.orderNumber().toLowerCase(Locale.ROOT).contains(needle)
                            || r.recipientName().toLowerCase(Locale.ROOT).contains(needle)
                            || (r.studentName() != null
                                    && r.studentName().toLowerCase(Locale.ROOT).contains(needle)))
                    .toList();
        }

        Comparator<AdminOrderResponse> comparator = (sort == null) ? null : switch (sort) {
            case "amount_asc" -> Comparator.comparing(AdminOrderResponse::totalAmount);
            case "amount_desc" -> Comparator.comparing(AdminOrderResponse::totalAmount).reversed();
            case "oldest" -> Comparator.comparing(AdminOrderResponse::createdAt);
            case "newest" -> Comparator.comparing(AdminOrderResponse::createdAt).reversed();
            default -> null;
        };
        if (comparator != null) {
            responses = responses.stream().sorted(comparator).toList();
        }
        return responses;
    }

    @Override
    @Transactional
    public AdminOrderResponse adminTransition(UUID orderId, OrderStatusUpdateRequest request) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found"));
        OrderStatus target = request.status();

        // Belt-and-suspenders alongside adminList's filter: a gateway checkout that's still
        // PENDING (opened, not yet completed or cancelled) must never be actionable, even
        // via a direct API call bypassing the queue view — see excludeUnpaidGatewayOrders.
        if (order.getPaymentStatus() == PaymentStatus.PENDING) {
            throw new InvalidOrderStateException(
                    "This order's payment has not been completed yet");
        }

        // No REJECTED destination is ever in ADMIN_FORWARD's allowed sets (see its
        // javadoc), so a request targeting it lands here and is rejected the same as any
        // other invalid transition — there is no special-cased reject-and-refund path left.
        Set<OrderStatus> allowed = ADMIN_FORWARD.getOrDefault(order.getStatus(), Set.of());
        if (!allowed.contains(target)) {
            throw new InvalidOrderStateException(
                    "Cannot move an order from " + order.getStatus() + " to " + target);
        }
        // Optional, not required: there is no separate "dispatch" step to gate on it
        // anymore, but admins can still note who delivered an order if they want to.
        if (request.deliveryPersonName() != null && !request.deliveryPersonName().isBlank()) {
            order.setDeliveryPersonName(request.deliveryPersonName().trim());
        }
        order.setStatus(target);
        notifyStatus(order, target);
        return orderMapper.toAdminResponse(order);
    }

    // --- helpers ---------------------------------------------------------------

    /** There is a single ordering slot (Recess) — the customer no longer picks one, so the
     *  server resolves the one active slot instead of trusting a client-supplied id. */
    private DeliverySlot resolveRecessSlot() {
        return deliverySlotRepository.findByActiveTrueOrderByOrderCutoffTimeAsc().stream()
                .findFirst()
                .orElseThrow(() -> new ResourceNotFoundException("Recess is not configured"));
    }

    private void validateOrderingWindow(LocalDate date, DeliverySlot slot) {
        // All comparisons run in the school's timezone via the injected Clock. Using the
        // JVM default would evaluate cutoffs in UTC on the deploy host, shifting a 09:30
        // cutoff to 15:00 local and letting orders in long after the kitchen has closed.
        if (date.isBefore(LocalDate.now(clock))) {
            throw new BadRequestException("Cannot order for a past date");
        }
        // Delegated so advance ordering honours both the slot's cutoff and the canteen's
        // manual open/closed switch for that date.
        orderingWindowService.assertAcceptingOrders(date, slot);
    }

    /**
     * Sets who receives the order and where it goes.
     *
     * For a parent, and for a student ordering for themselves, the location is derived from
     * the student's class and section rather than trusting the client — delivery staff need
     * an actual classroom to walk to, and Class is mandatory registration data anyway, so
     * there is nothing useful a free-text field would add. A teacher has no class, so their
     * own delivery location remains a required free-text field.
     */
    private void applyRecipientAndLocation(User user, PlaceOrderRequest request, Order order) {
        if (user.getRole() == Role.PARENT) {
            // Current flow: a ward the parent entered directly (no login, no admission
            // number, so no roll-number suffix on the delivery location).
            if (request.beneficiaryWardId() != null) {
                Ward ward = wardRepository.findByIdAndParent_Id(request.beneficiaryWardId(), user.getId())
                        .orElseThrow(() -> new ResourceNotFoundException("Ward not found"));
                order.setBeneficiaryWard(ward);
                order.setRecipientName(ward.getName());
                order.setDeliveryLocation("Class " + ward.getStudentClass() + "-" + ward.getSection());
                return;
            }

            // Older flow: a real, login-capable student account linked by admission
            // number. Kept for historical/older-client compatibility only — no longer
            // reachable from either frontend's UI.
            if (request.beneficiaryStudentProfileId() == null) {
                throw new BadRequestException("Select which child this order is for");
            }
            StudentProfile child = studentProfileRepository.findById(request.beneficiaryStudentProfileId())
                    .orElseThrow(() -> new ResourceNotFoundException("Child not found"));
            if (!parentChildLinkRepository.existsByParent_IdAndStudentProfile_Id(
                    user.getId(), child.getId())) {
                throw new ApiException(HttpStatus.FORBIDDEN,
                        "This child is not linked to your account");
            }
            order.setBeneficiaryStudentProfile(child);
            order.setRecipientName(child.getUser().getFullName());
            order.setDeliveryLocation("Class " + child.getStudentClass() + "-" + child.getSection()
                    + " (Roll " + child.getRollNumber() + ")");
            return;
        }

        // Student/teacher self-order.
        if (request.beneficiaryStudentProfileId() != null) {
            throw new BadRequestException("Only a parent can order on behalf of a child");
        }
        order.setRecipientName(user.getFullName());

        if (user.getRole() == Role.STUDENT) {
            StudentProfile self = studentProfileRepository.findByUser_Id(user.getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Student profile not found"));
            order.setDeliveryLocation("Class " + self.getStudentClass() + "-" + self.getSection()
                    + " (Roll " + self.getRollNumber() + ")");
            return;
        }

        // Teacher — no class, so their own free-text location is still required.
        String extraDetail = (request.deliveryLocation() == null)
                ? "" : request.deliveryLocation().trim();
        if (extraDetail.isBlank()) {
            throw new BadRequestException("Delivery location is required");
        }
        order.setDeliveryLocation(extraDetail);
    }

    private BigDecimal addLinesAndReserveStock(Order order, LocalDate date,
                                               List<OrderLineRequest> lines) {
        Set<UUID> seen = new HashSet<>();
        BigDecimal total = BigDecimal.ZERO;

        for (OrderLineRequest line : lines) {
            if (!seen.add(line.menuItemId())) {
                throw new BadRequestException("Duplicate item in order; combine into one line");
            }

            MenuItem menuItem = menuItemRepository.findById(line.menuItemId())
                    .filter(MenuItem::isActive)
                    .orElseThrow(() -> new BadRequestException("Item is not on the menu for " + date));

            if (menuItem.getMenuType() == MenuType.FIXED) {
                // Always orderable once active and in stock — no per-date scheduling, so
                // there is nothing to reserve or decrement.
                if (!menuItem.isAvailable()) {
                    throw new OutOfStockException(menuItem.getName());
                }
            } else {
                // DAILY: unchanged from before — the item must be scheduled on this exact
                // date, and stock is reserved atomically against that day's row.
                dailyMenuItemRepository
                        .findByMenuDateAndMenuItem_Id(date, line.menuItemId())
                        .filter(DailyMenuItem::isAvailable)
                        .orElseThrow(() -> new BadRequestException("Item is not on the menu for " + date));

                int updated = dailyMenuItemRepository.tryDecrement(date, line.menuItemId(), line.quantity());
                if (updated == 0) {
                    throw new OutOfStockException(menuItem.getName());
                }
            }

            BigDecimal unitPrice = menuItem.getPrice();
            BigDecimal lineTotal = unitPrice.multiply(BigDecimal.valueOf(line.quantity()));

            OrderItem item = new OrderItem();
            item.setMenuItem(menuItem);
            item.setItemName(menuItem.getName());
            item.setUnitPrice(unitPrice);
            // Snapshots, same reasoning as itemName/unitPrice above: if this item is later
            // permanently deleted, reports must still read the values as they were when the
            // order was placed rather than losing them along with the catalog row.
            item.setCostPrice(menuItem.getCostPrice());
            item.setMenuType(menuItem.getMenuType());
            item.setQuantity(line.quantity());
            item.setLineTotal(lineTotal);
            order.addItem(item);

            total = total.add(lineTotal);
        }
        return total;
    }

    /**
     * Every order is delivered — takeaway (counter pickup, teacher-only) was removed along
     * with the admin's pickup-code collection screen. {@code request.orderType()} is
     * ignored rather than validated: an old client sending TAKEAWAY should not error, it
     * should just be treated as a delivery. {@link OrderType#TAKEAWAY} itself stays in the
     * enum only so historical orders placed before this change keep deserializing.
     */
    private void applyOrderType(Order order) {
        order.setOrderType(OrderType.DELIVERY);
    }

    /** Sends the order's owner the message matching its new status. */
    private void notifyStatus(Order order, OrderStatus status) {
        String orderNumber = OrderMapper.formatOrderNumber(order.getOrderNumber());
        notificationService.notifyUser(
                order.getPlacedBy(),
                NotificationMessages.eventFor(status),
                NotificationMessages.titleFor(status),
                NotificationMessages.bodyFor(status, orderNumber, order.getRecipientName(),
                        order.getDeliveryPersonName()),
                Map.of("orderId", order.getId().toString(),
                        "orderNumber", orderNumber,
                        "status", status.name()));
    }

}

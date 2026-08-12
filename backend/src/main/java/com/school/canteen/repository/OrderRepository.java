package com.school.canteen.repository;

import com.school.canteen.entity.Order;
import com.school.canteen.enums.OrderStatus;
import com.school.canteen.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    /** Next human-friendly order number from the DB sequence. */
    @Query(value = "select nextval('order_number_seq')", nativeQuery = true)
    long nextOrderNumber();

    Optional<Order> findByPlacedBy_IdAndIdempotencyKey(UUID userId, String idempotencyKey);

    Optional<Order> findByIdAndPlacedBy_Id(UUID id, UUID userId);

    List<Order> findByPlacedBy_IdOrderByCreatedAtDesc(UUID userId, Pageable pageable);

    List<Order> findByMenuDateOrderByCreatedAtAsc(LocalDate menuDate, Pageable pageable);

    List<Order> findByMenuDateAndStatusOrderByCreatedAtAsc(LocalDate menuDate, OrderStatus status,
                                                           Pageable pageable);

    /**
     * How much of each item is already committed for a date, ignoring cancelled and
     * rejected orders. This is what tells the canteen what to cook for advance orders.
     */
    @Query("""
            select oi.menuItem.id, oi.itemName, sum(oi.quantity)
              from OrderItem oi
             where oi.order.menuDate = :menuDate
               and oi.order.status not in (
                   com.school.canteen.enums.OrderStatus.CANCELLED,
                   com.school.canteen.enums.OrderStatus.REJECTED)
             group by oi.menuItem.id, oi.itemName
             order by sum(oi.quantity) desc
            """)
    List<Object[]> aggregateDemand(@Param("menuDate") LocalDate menuDate);

    // ---- reporting ----
    // Only orders that were actually paid for and not reversed count as earnings.
    // Including cancelled or rejected orders would inflate revenue with money refunded.

    @Query("""
            select coalesce(sum(o.totalAmount), 0)
              from Order o
             where o.menuDate between :from and :to
               and o.paymentStatus = com.school.canteen.enums.PaymentStatus.PAID
               and o.status not in (
                   com.school.canteen.enums.OrderStatus.CANCELLED,
                   com.school.canteen.enums.OrderStatus.REJECTED)
            """)
    BigDecimal revenueBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Cost of goods sold. An item with no recorded cost price contributes zero, so the
     * report understates cost rather than refusing to run — the dashboard flags it instead.
     * Reads oi.costPrice (a snapshot taken at order time) rather than joining menu_items,
     * so a permanently deleted item's past cost still counts.
     */
    @Query("""
            select coalesce(sum(oi.quantity * coalesce(oi.costPrice, 0)), 0)
              from OrderItem oi
             where oi.order.menuDate between :from and :to
               and oi.order.paymentStatus = com.school.canteen.enums.PaymentStatus.PAID
               and oi.order.status not in (
                   com.school.canteen.enums.OrderStatus.CANCELLED,
                   com.school.canteen.enums.OrderStatus.REJECTED)
            """)
    BigDecimal costOfGoodsBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    @Query("""
            select o.menuDate, count(o), coalesce(sum(o.totalAmount), 0)
              from Order o
             where o.menuDate between :from and :to
               and o.paymentStatus = com.school.canteen.enums.PaymentStatus.PAID
               and o.status not in (
                   com.school.canteen.enums.OrderStatus.CANCELLED,
                   com.school.canteen.enums.OrderStatus.REJECTED)
             group by o.menuDate
             order by o.menuDate
            """)
    List<Object[]> dailySalesBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    // Groups by the snapshotted oi.menuType (taken at order time) rather than joining
    // menu_items, so a permanently deleted item still appears in historical "top items".
    @Query("""
            select oi.itemName, oi.menuType, sum(oi.quantity), coalesce(sum(oi.lineTotal), 0)
              from OrderItem oi
             where oi.order.menuDate between :from and :to
               and oi.order.status not in (
                   com.school.canteen.enums.OrderStatus.CANCELLED,
                   com.school.canteen.enums.OrderStatus.REJECTED)
             group by oi.itemName, oi.menuType
             order by sum(oi.quantity) desc
            """)
    List<Object[]> topItemsBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /**
     * Order volume by hour of day, converted into the school's timezone.
     * Grouping on the raw UTC timestamp would report peaks 5.5 hours off in India.
     */
    @Query(value = """
            select cast(extract(hour from (o.created_at at time zone :zone)) as int) as hour,
                   count(*)
              from orders o
             where o.menu_date between :from and :to
             group by 1
             order by 1
            """, nativeQuery = true)
    List<Object[]> peakHoursBetween(@Param("from") LocalDate from, @Param("to") LocalDate to,
                                    @Param("zone") String zone);

    long countByMenuDate(LocalDate menuDate);

    long countByMenuDateAndStatus(LocalDate menuDate, OrderStatus status);

    long countByMenuDateAndStatusIn(LocalDate menuDate, Collection<OrderStatus> statuses);

    // Dashboard-only counts: an order whose gateway checkout was abandoned or never
    // completed sits at paymentStatus PENDING forever (see OrderServiceImpl -
    // excludeUnpaidGatewayOrders keeps the same kind of row off the Orders Board), so
    // without this filter these stats double as a count of failed/abandoned checkout
    // attempts alongside real orders.
    long countByMenuDateAndPaymentStatus(LocalDate menuDate, PaymentStatus paymentStatus);

    long countByMenuDateAndPaymentStatusAndStatus(LocalDate menuDate, PaymentStatus paymentStatus,
                                                  OrderStatus status);

    long countByMenuDateAndPaymentStatusAndStatusIn(LocalDate menuDate, PaymentStatus paymentStatus,
                                                     Collection<OrderStatus> statuses);
}

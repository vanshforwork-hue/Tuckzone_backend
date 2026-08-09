package com.school.canteen.dto.order;

import com.school.canteen.enums.OrderStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/** Canteen-admin status change. deliveryPersonName is always optional — a note of who
 *  delivered the order, not a gate on the transition. */
public record OrderStatusUpdateRequest(
        @NotNull OrderStatus status,
        @Size(max = 120) String deliveryPersonName) {
}

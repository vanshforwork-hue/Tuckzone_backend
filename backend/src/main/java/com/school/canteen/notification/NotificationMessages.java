package com.school.canteen.notification;

import com.school.canteen.enums.NotificationEvent;
import com.school.canteen.enums.OrderStatus;

/**
 * Wording for every notification, in one place.
 *
 * Keeping copy out of the services means changing "Delivered" to something friendlier
 * does not involve touching order logic, and the mobile app can still branch on the
 * {@link NotificationEvent} rather than on text.
 */
public final class NotificationMessages {

    private NotificationMessages() {
    }

    public static NotificationEvent eventFor(OrderStatus status) {
        return switch (status) {
            case PLACED -> NotificationEvent.ORDER_PLACED;
            case DELIVERED -> NotificationEvent.ORDER_DELIVERED;
            case CANCELLED -> NotificationEvent.ORDER_CANCELLED;
            case REJECTED -> NotificationEvent.ORDER_REJECTED;
        };
    }

    public static String titleFor(OrderStatus status) {
        return switch (status) {
            case PLACED -> "Order placed";
            case DELIVERED -> "Delivered";
            case CANCELLED -> "Order cancelled";
            case REJECTED -> "Order rejected";
        };
    }

    public static String bodyFor(OrderStatus status, String orderNumber, String recipient,
                                 String deliveryPerson) {
        return switch (status) {
            case PLACED -> "Order " + orderNumber + " for " + recipient + " has been placed.";
            case DELIVERED -> (deliveryPerson == null || deliveryPerson.isBlank())
                    ? "Order " + orderNumber + " was delivered to " + recipient + "."
                    : "Order " + orderNumber + " was delivered to " + recipient + " by " + deliveryPerson + ".";
            case CANCELLED -> "Order " + orderNumber + " was cancelled and refunded to your wallet.";
            case REJECTED -> "The canteen could not accept order " + orderNumber
                    + ". The amount has been refunded to your wallet.";
        };
    }
}

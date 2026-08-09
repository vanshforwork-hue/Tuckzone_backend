package com.school.canteen.enums;

/**
 * Everything the system tells a user about. Kept as an explicit list so message wording
 * lives in one place and the mobile app can branch on a stable identifier rather than
 * parsing text.
 */
public enum NotificationEvent {
    ORDER_PLACED,
    PAYMENT_SUCCESSFUL,
    ORDER_DELIVERED,
    ORDER_CANCELLED,
    ORDER_REJECTED,
    REFUND_ISSUED,
    WALLET_TOPPED_UP,
    PASSWORD_CHANGED,
    /** Someone signed in — the earliest warning a user gets if it was not them. */
    SIGNED_IN,
    ORDERING_OPENED,
    ORDERING_CLOSED
}

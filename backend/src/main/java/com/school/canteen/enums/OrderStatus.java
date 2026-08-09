package com.school.canteen.enums;

/**
 * Lifecycle of an order. Forward flow is PLACED → DELIVERED — there is no intermediate
 * kitchen-workflow tracking (no ACCEPTED/PREPARING/PACKED/OUT_FOR_DELIVERY step; those
 * constants were removed, and a V21 migration collapsed every existing order sitting in
 * one of them back to PLACED, so no row in the database can reference them). REJECTED (by
 * canteen) and CANCELLED (by customer) remain purely for historical display of orders from
 * before that refund path was removed — nothing can be newly assigned either status.
 * Allowed transitions are enforced in the service.
 */
public enum OrderStatus {
    PLACED,
    DELIVERED,
    REJECTED,
    CANCELLED
}

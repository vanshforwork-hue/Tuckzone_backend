-- The kitchen-workflow steps (ACCEPTED/PREPARING/PACKED/OUT_FOR_DELIVERY) are removed —
-- Admin/Subadmin now only ever mark an order DELIVERED directly, no intermediate steps.
-- Any order still sitting in one of those in-flight statuses hasn't been delivered yet, so
-- it maps back to PLACED, the only remaining "not yet delivered" state. REJECTED/CANCELLED
-- are untouched: those are terminal refund outcomes, not workflow steps, and are unrelated
-- to this collapse.
update orders
set status = 'PLACED'
where status in ('ACCEPTED', 'PREPARING', 'PACKED', 'OUT_FOR_DELIVERY');

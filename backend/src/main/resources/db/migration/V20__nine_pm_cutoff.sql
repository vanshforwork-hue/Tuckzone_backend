-- The active ordering slot was still seeded (V4) at 09:30:00, a leftover from the old
-- same-day "order before recess" model. The app now orders for the next available day, and
-- the business-mandated deadline for that is 9 PM the day before delivery. Only the active
-- slot is touched; the deactivated "Lunch Recess" row is historical and left alone.
update delivery_slots
set order_cutoff_time = '21:00:00'
where active = true;

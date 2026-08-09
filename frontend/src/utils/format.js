/**
 * Collapses the order lifecycle (PLACED/REJECTED/CANCELLED/DELIVERED — there is no
 * intermediate kitchen-workflow status) down to the two words customers and admins
 * actually see. The real status still drives filters and action buttons — this only
 * simplifies what gets printed on screen.
 */
export function orderStatusLabel(status) {
  return status === 'DELIVERED' ? 'Delivered' : 'Placed';
}

/** "VIII-B" style class label, used wherever a student's class/section needs to render as
 *  one value instead of two separate fields side by side. */
export function classLabel(studentClass, section) {
  if (!studentClass) return '';
  return section ? `${studentClass}-${section}` : studentClass;
}

/**
 * "10 August 2026" from a Y-M-D date string (as every `<input type="date">` and API date
 * field in this app already is). Deliberately does NOT go through `new Date(iso)` — that
 * constructor parses an ISO date-only string as UTC midnight, which renders as the previous
 * day in any browser west of UTC. Parsing the components directly avoids that entirely.
 */
export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

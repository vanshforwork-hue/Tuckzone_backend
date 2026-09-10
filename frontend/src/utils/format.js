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

/** Adds `days` to an ISO date string, returning another ISO date string. Parses via Y/M/D
 *  components like formatDate above rather than `new Date(iso)`, which parses a bare
 *  "YYYY-MM-DD" as UTC midnight and can shift a day off in a negative-UTC-offset timezone. */
export function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** "₹120" / "₹120.50" — whole rupees render without decimals, fractional amounts keep two. */
export function formatCurrency(amount) {
  const value = Number(amount) || 0;
  const hasFraction = Math.abs(value % 1) > 0.001;
  return `₹${value.toFixed(hasFraction ? 2 : 0)}`;
}

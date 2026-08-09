/** Formats a numeric/string amount as Indian Rupees, e.g. 1234.5 -> "₹1,234.50". */
export function formatCurrency(amount: number | string): string {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (Number.isNaN(value)) return '₹0.00';
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Short, readable date for order cards and transaction rows. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "VIII-B" style class label used across order cards, profile, and children lists. */
export function classLabel(studentClass?: string | null, section?: string | null): string {
  if (!studentClass) return '';
  return section ? `${studentClass}-${section}` : studentClass;
}

/** Collapses the order lifecycle (PLACED/REJECTED/CANCELLED/DELIVERED — there is no
 *  intermediate kitchen-workflow status) down to the two words customers and admins
 *  actually see. The real status still drives filters and action buttons — this only
 *  simplifies what gets printed on screen. */
export function orderStatusLabel(status: string): 'Placed' | 'Delivered' {
  return status === 'DELIVERED' ? 'Delivered' : 'Placed';
}

export function initials(fullName?: string | null): string {
  if (!fullName) return '?';
  return fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

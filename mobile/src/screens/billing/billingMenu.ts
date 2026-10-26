export type BillingEntryKey = 'held' | 'repeat' | 'bills' | 'catalog' | 'reports' | 'settings' | 'printer';
export type BillingGroupKey = 'sell' | 'sales' | 'menu' | 'tools';

export interface BillingEntry {
  key: BillingEntryKey;
  label: string;
  /** Stack route to open; absent for in-screen actions (held, repeat). */
  route?: 'BillingHistory' | 'BillingCatalog' | 'BillingReports' | 'BillingSettings' | 'BillingPrinter';
}
export interface BillingGroup { key: BillingGroupKey; label: string; entries: BillingEntry[] }

/**
 * The Billing toolbar for a role, grouped Sell / Sales / Menu / Tools. Mirrors the server rules:
 * reports and settings are Canteen Admin only (the backend returns 403 for a Sub Admin regardless
 * of what is shown here). Empty groups are dropped.
 */
export function billingMenuGroups(role: string | undefined): BillingGroup[] {
  const admin = role === 'CANTEEN_ADMIN';
  const groups: BillingGroup[] = [
    { key: 'sell', label: 'Sell', entries: [{ key: 'held', label: 'Held bills' }, { key: 'repeat', label: 'Repeat last' }] },
    { key: 'sales', label: 'Sales', entries: [{ key: 'bills', label: 'Bills', route: 'BillingHistory' }] },
    { key: 'menu', label: 'Menu', entries: [{ key: 'catalog', label: admin ? 'Menu / Catalog' : 'Menu availability', route: 'BillingCatalog' }] },
    { key: 'tools', label: 'Tools', entries: [{ key: 'printer', label: 'Printer', route: 'BillingPrinter' }] },
  ];
  if (admin) {
    groups[1].entries.push({ key: 'reports', label: 'Reports', route: 'BillingReports' });
    groups[3].entries.push({ key: 'settings', label: 'Billing settings', route: 'BillingSettings' });
  }
  return groups;
}

export const billingMenuEntries = (role: string | undefined): BillingEntry[] =>
  billingMenuGroups(role).flatMap((g) => g.entries);

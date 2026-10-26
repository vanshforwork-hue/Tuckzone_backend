export type BillingEntryKey = 'held' | 'repeat' | 'bills' | 'catalog' | 'reports' | 'settings' | 'printer';

export interface BillingEntry {
  key: BillingEntryKey;
  label: string;
  /** Stack route to open; absent for in-screen actions (held, repeat). */
  route?: 'BillingHistory' | 'BillingCatalog' | 'BillingReports' | 'BillingSettings' | 'BillingPrinter';
}

/**
 * The Billing toolbar for a role. Mirrors the server rules: reports and settings are Canteen
 * Admin only (the backend returns 403 for a Sub Admin regardless of what is shown here).
 */
export function billingMenuEntries(role: string | undefined): BillingEntry[] {
  const admin = role === 'CANTEEN_ADMIN';
  const entries: BillingEntry[] = [
    { key: 'held', label: 'Held bills' },
    { key: 'repeat', label: 'Repeat last' },
    { key: 'bills', label: 'Bills', route: 'BillingHistory' },
    { key: 'catalog', label: admin ? 'Menu / Catalog' : 'Menu availability', route: 'BillingCatalog' },
  ];
  if (admin) {
    entries.push({ key: 'reports', label: 'Reports', route: 'BillingReports' });
    entries.push({ key: 'settings', label: 'Billing settings', route: 'BillingSettings' });
  }
  entries.push({ key: 'printer', label: 'Printer', route: 'BillingPrinter' });
  return entries;
}

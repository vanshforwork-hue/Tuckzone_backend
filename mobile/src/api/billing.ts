import { apiClient } from './client';

/** Counter billing (POS). Canteen Admin + Sub Admin only; see PosController on the backend. */

export type PaymentMethod = 'CASH' | 'UPI' | 'CARD' | 'OTHER';
export type BillStatus = 'COMPLETED' | 'VOID';
export type Granularity = 'DAY' | 'WEEK' | 'MONTH';

export interface PosCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PosItem {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  emoji: string;
  available: boolean;
  favorite: boolean;
  sortOrder: number;
}

export interface PosCatalog {
  categories: PosCategory[];
  items: PosItem[];
}

export interface PosItemRequest {
  categoryId: string;
  name: string;
  price: number;
  emoji?: string;
  available?: boolean;
  favorite?: boolean;
  sortOrder?: number;
}

export interface PosSettings {
  businessName: string;
  address: string;
  phone: string;
  gstin: string;
  footerMessage: string;
  currencySymbol: string;
  gstPercent: number;
  gstEnabledDefault: boolean;
}

export interface BillLine {
  itemId: string | null;
  itemName: string;
  emoji: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Bill {
  id: string;
  invoiceNumber: string;
  billDate: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  status: BillStatus;
  voidReason: string | null;
  voidedAt: string | null;
  paymentMethod: PaymentMethod | null;
  /** Always MANUAL_UNVERIFIED: the cashier typed it in; nothing confirmed it. */
  paymentStatus: string;
  subtotal: number;
  gstPercent: number;
  gstAmount: number;
  total: number;
  businessName: string;
  address: string;
  phone: string;
  gstin: string;
  footerMessage: string;
  currencySymbol: string;
  lines: BillLine[];
}

export interface BillSummary {
  id: string;
  invoiceNumber: string;
  billDate: string;
  createdAt: string;
  createdByName: string;
  status: BillStatus;
  paymentMethod: PaymentMethod | null;
  total: number;
  itemCount: number;
}

export interface BillPage {
  content: BillSummary[];
  totalElements: number;
  page: number;
  size: number;
}

export interface CartLineInput {
  itemId: string;
  quantity: number;
}

export interface CreateBillRequest {
  idempotencyKey: string;
  lines: CartLineInput[];
  gstEnabled: boolean;
  paymentMethod?: PaymentMethod;
}

export interface HeldCart {
  id: string;
  label: string;
  createdAt: string;
  lines: CartLineInput[];
}

export interface SalesSummary {
  from: string;
  to: string;
  granularity: Granularity;
  bills: number;
  subtotal: number;
  gst: number;
  total: number;
  voidedBills: number;
  voidedTotal: number;
  periods: { periodStart: string; bills: number; subtotal: number; gst: number; total: number }[];
  byPayment: { method: string; bills: number; total: number }[];
  byItem: { itemName: string; quantity: number; total: number }[];
}

const base = '/admin/billing';

export const billingApi = {
  catalog: () => apiClient.get<PosCatalog>(`${base}/catalog`).then((r) => r.data),
  createCategory: (name: string, sortOrder?: number) =>
    apiClient.post<PosCategory>(`${base}/categories`, { name, sortOrder }).then((r) => r.data),
  updateCategory: (id: string, name: string, sortOrder?: number) =>
    apiClient.put<PosCategory>(`${base}/categories/${id}`, { name, sortOrder }).then((r) => r.data),
  archiveCategory: (id: string) => apiClient.delete(`${base}/categories/${id}`),
  createItem: (data: PosItemRequest) => apiClient.post<PosItem>(`${base}/items`, data).then((r) => r.data),
  updateItem: (id: string, data: PosItemRequest) =>
    apiClient.put<PosItem>(`${base}/items/${id}`, data).then((r) => r.data),
  setAvailability: (id: string, available: boolean) =>
    apiClient.patch<PosItem>(`${base}/items/${id}/availability`, { available }).then((r) => r.data),
  archiveItem: (id: string) => apiClient.delete(`${base}/items/${id}`),

  settings: () => apiClient.get<PosSettings>(`${base}/settings`).then((r) => r.data),
  updateSettings: (data: PosSettings) => apiClient.put<PosSettings>(`${base}/settings`, data).then((r) => r.data),

  createBill: (data: CreateBillRequest) => apiClient.post<Bill>(`${base}/bills`, data).then((r) => r.data),
  listBills: (params: { from?: string; to?: string; status?: BillStatus; q?: string; page?: number; size?: number }) =>
    apiClient.get<BillPage>(`${base}/bills`, { params }).then((r) => r.data),
  getBill: (id: string) => apiClient.get<Bill>(`${base}/bills/${id}`).then((r) => r.data),
  voidBill: (id: string, reason: string) =>
    apiClient.post<Bill>(`${base}/bills/${id}/void`, { reason }).then((r) => r.data),

  hold: (lines: CartLineInput[], label?: string) =>
    apiClient.post<HeldCart>(`${base}/held`, { lines, label }).then((r) => r.data),
  listHeld: () => apiClient.get<HeldCart[]>(`${base}/held`).then((r) => r.data),
  resumeHeld: (id: string) => apiClient.post<HeldCart>(`${base}/held/${id}/resume`).then((r) => r.data),
  discardHeld: (id: string) => apiClient.delete(`${base}/held/${id}`),

  summary: (from: string, to: string, granularity: Granularity) =>
    apiClient.get<SalesSummary>(`${base}/reports/summary`, { params: { from, to, granularity } }).then((r) => r.data),
  exportXlsx: (from: string, to: string) =>
    apiClient
      .get<ArrayBuffer>(`${base}/reports/export`, { params: { from, to }, responseType: 'arraybuffer' })
      .then((r) => r.data),
};

/**
 * Cart total preview in integer paise (no float drift), mirroring the server's exclusive
 * GST rounded half-up. The server's figures on the returned bill are the authoritative ones.
 */
export function previewTotals(
  lines: { price: number; quantity: number }[],
  gstPercent: number,
  gstEnabled: boolean,
): { subtotal: number; gst: number; total: number } {
  const subtotalPaise = lines.reduce((sum, l) => sum + Math.round(l.price * 100) * l.quantity, 0);
  const pctHundredths = gstEnabled ? Math.round(gstPercent * 100) : 0;
  const gstPaise = Math.floor((subtotalPaise * pctHundredths + 5000) / 10000);
  return { subtotal: subtotalPaise / 100, gst: gstPaise / 100, total: (subtotalPaise + gstPaise) / 100 };
}

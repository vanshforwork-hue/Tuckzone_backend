/**
 * TypeScript mirrors of the backend DTOs (see docs/openapi.json). Kept in one file so a
 * field rename on the backend is a single, obvious place to fix on the client.
 */

export type Role = 'STUDENT' | 'TEACHER' | 'PARENT' | 'CANTEEN_ADMIN' | 'SUB_ADMIN';
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type OtpPurpose = 'LOGIN' | 'PASSWORD_RESET' | 'EMAIL_VERIFICATION';
export type MenuType = 'DAILY' | 'FIXED';
export type OrderStatus =
  | 'PLACED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'REJECTED';
export type OrderType = 'DELIVERY' | 'TAKEAWAY';
export type PaymentStatus = 'PENDING' | 'PAID' | 'REFUNDED';
export type TransactionType = 'CREDIT' | 'DEBIT';
export type PaymentUseCase = 'WALLET_RECHARGE' | 'CHECKOUT' | 'SUBSCRIPTION';
export type PaymentMode = 'WALLET_ONLY' | 'GATEWAY_ONLY' | 'WALLET_PLUS_GATEWAY';
export type PaymentTxnStatus = 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';
export type OrderingStatus = 'OPEN' | 'CLOSED';
export type ExpenseCategory =
  | 'INGREDIENTS'
  | 'STAFF_WAGES'
  | 'GAS_FUEL'
  | 'RENT'
  | 'UTILITIES'
  | 'PACKAGING'
  | 'EQUIPMENT'
  | 'OTHER';

export interface UserSummary {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: Role;
  status: UserStatus;
  emailVerified?: boolean;
  createdAt: string;
  admissionNumber?: string | null;
  studentClass?: string | null;
  section?: string | null;
  rollNumber?: string | null;
  seatNumber?: string | null;
  parentMobile?: string | null;
  employeeId?: string | null;
  department?: string | null;
}

export interface AuthResponse {
  tokenType: string;
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  user: UserSummary;
}

export interface AppConfigResponse {
  currency: string;
  timezone: string;
  otpLength: number;
  otpTtlMinutes: number;
  otpDevCodeReturned: boolean;
  mockPaymentsEnabled: boolean;
  maxTopupAmount: number;
  passwordMinLength: number;
  quickTopupAmounts: number[];
  minimumAppVersion: string;
}

export interface OtpIssuedResponse {
  message: string;
  expiresInMinutes: number;
  devCode: string | null;
  /** Seconds to wait before requesting another code for the same address. */
  resendAfterSeconds: number;
}

export interface MenuItemResponse {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  costPrice?: number | null;
  menuType: MenuType;
  available: boolean;
  imageUrl?: string | null;
  allergens?: string | null;
  active: boolean;
}

export interface DailyMenuItemResponse {
  id: string;
  menuDate: string;
  menuItem: MenuItemResponse;
  totalQuantity: number;
  remainingQuantity: number;
  available: boolean;
}

export interface DeliverySlotResponse {
  id: string;
  name: string;
  orderCutoffTime: string;
  deliveryTime: string;
}

export interface OrderItemResponse {
  menuItemId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface OrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  pickupCode?: string | null;
  menuDate: string;
  slotName: string;
  deliveryTime: string;
  recipientName: string;
  /** Null for a teacher's own order, which has no class. Resolved server-side from the
   *  student's profile — never something the client typed at checkout. */
  recipientClass?: string | null;
  recipientSection?: string | null;
  deliveryLocation: string;
  deliveryPersonName?: string | null;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  items: OrderItemResponse[];
  createdAt: string;
  /** Non-null only when placed with paymentMode GATEWAY_ONLY/WALLET_PLUS_GATEWAY and still
   *  needs the client to complete a gateway checkout — see PaymentInitiationResponse. */
  payment?: PaymentInitiationResponse | null;
}

/**
 * What `/admin/orders` and the status-transition endpoint actually return — a superset of
 * {@link OrderResponse} that additionally carries the ordering student's identity
 * (name/class/section/roll number), which only Canteen Admin/Sub Admin ever see.
 */
export interface AdminOrderResponse {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  orderType: OrderType;
  pickupCode?: string | null;
  menuDate: string;
  slotName: string;
  deliveryTime: string;
  recipientName: string;
  deliveryLocation: string;
  deliveryPersonName?: string | null;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  totalAmount: number;
  items: OrderItemResponse[];
  createdAt: string;
  studentName?: string | null;
  studentClass?: string | null;
  studentSection?: string | null;
  studentRollNumber?: string | null;
}

export interface WalletResponse {
  userId: string;
  balance: number;
  currency: string;
}

export interface WalletTransactionResponse {
  id: string;
  type: TransactionType;
  amount: number;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  description?: string | null;
  createdAt: string;
}

export interface TopupInitResponse {
  topupId: string;
  gatewayOrderId: string;
  /** The wallet credit amount — never includes platformFee (the wallet never receives it). */
  amount: number;
  currency: string;
  gatewayKeyId: string;
  /** 0 unless an admin has enabled a WALLET_RECHARGE platform fee. */
  platformFee: number;
  /** amount + platformFee — what the gateway widget actually charges. */
  grandTotal: number;
}

export interface PricingBreakdown {
  subtotal: number;
  platformFee: number;
  discount: number;
  tax: number;
  walletUsed: number;
  gatewayAmount: number;
  grandTotal: number;
  currency: string;
}

export interface PaymentInitiationResponse {
  paymentId: string;
  status: PaymentTxnStatus | string;
  /** Null when the payment settled immediately from wallet alone — nothing to check out. */
  providerOrderId?: string | null;
  providerKeyId?: string | null;
  pricing: PricingBreakdown;
}

export interface PaymentStatusResponse {
  paymentId: string;
  useCase: PaymentUseCase;
  status: PaymentTxnStatus | string;
  provider: string;
  providerPaymentId?: string | null;
  pricing: PricingBreakdown;
  createdAt: string;
}

export interface VerifyPaymentRequest {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

export interface WardResponse {
  id: string;
  name: string;
  studentClass: string;
  section: string;
}

export interface WardRequest {
  name: string;
  studentClass: string;
  section: string;
}

export interface NotificationResponse {
  id: string;
  event: string;
  title: string;
  body: string;
  payload?: string | null;
  createdAt: string;
}

export interface OrderingWindowResponse {
  menuDate: string;
  slotId: string;
  slotName: string;
  status: OrderingStatus;
  effectiveCutoffTime: string;
  acceptingOrders: boolean;
  reason?: string | null;
}

/** The date the ordering UI should default to right now — see
 *  OrderingWindowService#resolveDefaultOrderingDate. */
export interface DefaultOrderingDateResponse {
  menuDate: string;
  slotId: string;
  slotName: string;
  cutoffTime: string;
}

export interface DemandRow {
  menuItemId: string;
  itemName: string;
  orderedQuantity: number;
  totalQuantity: number;
  remainingQuantity: number;
  shortfall: number;
}

export interface DashboardResponse {
  date: string;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  rejectedOrders: number;
  cancelledOrders: number;
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  totalCustomers: number;
  topItems: TopItemRow[];
  topDailyItems: TopItemRow[];
  topFixedItems: TopItemRow[];
  lowStock: { itemName: string; remainingQuantity: number; totalQuantity: number }[];
}

export interface TopItemRow {
  itemName: string;
  menuType: MenuType;
  quantitySold: number;
  revenue: number;
}

export interface SalesReportResponse {
  from: string;
  to: string;
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  orderCount: number;
  daily: { date: string; orders: number; revenue: number }[];
  topItems: TopItemRow[];
  topDailyItems: TopItemRow[];
  topFixedItems: TopItemRow[];
  peakHours: { hour: number; orders: number }[];
}

export interface ExpenseResponse {
  id: string;
  expenseDate: string;
  category: ExpenseCategory;
  description?: string | null;
  amount: number;
}

export type PlatformFeeType = 'PERCENTAGE' | 'FIXED';

export interface PlatformFeeSettingsResponse {
  useCase: PaymentUseCase;
  enabled: boolean;
  feeType: PlatformFeeType;
  feeValue: number;
  minFee?: number | null;
  maxFee?: number | null;
}

export interface ApiErrorBody {
  timestamp: string;
  status: number;
  error: string;
  message: string;
  path: string;
  details: string[];
  /** Stable marker for errors the app must branch on, e.g. 'EMAIL_NOT_VERIFIED'. */
  code?: string | null;
  /** Validation failures keyed by field name, so a form can mark the offending input. */
  fieldErrors?: Record<string, string> | null;
}

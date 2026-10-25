/** Shared param-list types so `navigation.navigate(...)` calls are type-checked. */
import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome: undefined;
  Login: undefined;
  /** Present when arriving from LoginScreen's Email tab after Firebase verified an
   *  identity with no matching account yet — see FirebaseAccountService on the backend. */
  Register: { firebaseIdToken?: string; email?: string } | undefined;
  ForgotPassword: undefined;
  /** `devCode` is only ever populated when the backend runs with OTP dev codes enabled. */
  VerifyEmail: { email: string; devCode?: string | null };
};

export type CustomerTabParamList = {
  Menu: undefined;
  Orders: undefined;
  Wallet: undefined;
  Children: undefined;
  Profile: undefined;
};

export type CustomerStackParamList = {
  // Allows a screen inside CustomerTabs (e.g. Profile) to jump to a sibling tab —
  // `navigation.navigate('CustomerTabs', { screen: 'Wallet' })` — instead of only being
  // able to reach stack-level screens. Existing bare `navigate('CustomerTabs')` calls stay
  // valid since the params are optional.
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  Checkout: undefined;
  /** Reached by replace() from Checkout, so back cannot return to a submitted cart. */
  OrderConfirmation: { orderId: string };
  OrderDetail: { orderId: string };
  Notifications: undefined;
};

/** Counter billing (POS) stack, shared by Canteen Admin and Sub Admin as one tab. */
export type BillingStackParamList = {
  BillingPos: undefined;
  BillingHistory: undefined;
  BillDetail: { billId: string };
  BillingCatalog: undefined;
  BillingSettings: undefined;
  BillingReports: undefined;
};

export type AdminTabParamList = {
  Dashboard: undefined;
  OrdersBoard: undefined;
  MenuManagement: undefined;
  Billing: undefined;
  More: undefined;
};

export type AdminStackParamList = {
  AdminTabs: undefined;
  Reports: undefined;
  Expenses: undefined;
  Users: undefined;
  OrderingWindows: undefined;
  Notifications: undefined;
  SubAdmins: undefined;
  PaymentSettings: undefined;
  ExportOrders: undefined;
};

export type SubAdminTabParamList = {
  OrdersBoard: undefined;
  MenuManagement: undefined;
  Billing: undefined;
  ExportOrders: undefined;
  Account: undefined;
};

export type SubAdminStackParamList = {
  SubAdminTabs: undefined;
};

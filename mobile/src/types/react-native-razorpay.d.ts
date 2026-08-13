declare module 'react-native-razorpay' {
  export interface RazorpayOptions {
    key: string;
    order_id: string;
    name?: string;
    description?: string;
    currency?: string;
    amount?: number;
    prefill?: { name?: string; email?: string; contact?: string };
    theme?: { color?: string };
    [key: string]: unknown;
  }

  export interface RazorpaySuccessResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }

  export interface RazorpayErrorResponse {
    code?: number;
    description?: string;
    [key: string]: unknown;
  }

  export default class RazorpayCheckout {
    static open(options: RazorpayOptions): Promise<RazorpaySuccessResponse>;
    static onExternalWalletSelection(callback: (data: unknown) => void): void;
  }
}

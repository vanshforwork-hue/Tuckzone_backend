import RazorpayCheckout from 'react-native-razorpay';

export interface RazorpayCheckoutParams {
  providerOrderId: string;
  providerKeyId: string;
  amount?: number;
  currency?: string;
  name?: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
}

export interface RazorpayCheckoutResult {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
}

/**
 * Opens Razorpay's native Android/iOS checkout for a payment this app already created
 * server-side. Resolves once the user completes checkout; rejects if they dismiss it or
 * the gateway reports a failure. Mirrors the web app's openRazorpayCheckout
 * (frontend/src/utils/razorpay.js) — nothing here decides what was charged, the widget
 * only ever displays what providerOrderId already committed to server-side.
 */
export async function openRazorpayCheckout({
  providerOrderId,
  providerKeyId,
  name,
  description,
  prefill,
}: RazorpayCheckoutParams): Promise<RazorpayCheckoutResult> {
  try {
    const response = await RazorpayCheckout.open({
      key: providerKeyId,
      order_id: providerOrderId,
      name: name || 'TuckZone',
      description,
      prefill,
    });
    return {
      providerOrderId: response.razorpay_order_id,
      providerPaymentId: response.razorpay_payment_id,
      signature: response.razorpay_signature,
    };
  } catch (error: any) {
    // The native module rejects with { code, description } for both a user-dismissed
    // widget and a gateway-reported failure (declined card, bank timeout, ...) — there is
    // no separate "dismissed" event on Android/iOS the way the web widget's
    // modal.ondismiss is, so both map to the same rejection here.
    throw new Error(error?.description || 'Payment was cancelled');
  }
}

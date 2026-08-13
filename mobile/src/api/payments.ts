import { apiClient } from './client';
import type {
  PaymentInitiationResponse,
  PaymentMode,
  PaymentStatusResponse,
  PaymentUseCase,
  PricingBreakdown,
  VerifyPaymentRequest,
} from './types';

export const paymentsApi = {
  /** Non-binding preview — the real charge always re-derives its amount server-side. */
  calculatePricing: (
    useCase: PaymentUseCase,
    amount: number,
    paymentMode?: PaymentMode,
    walletAmountAvailable?: number,
  ) =>
    apiClient
      .post<PricingBreakdown>('/payments/calculate-pricing', {
        useCase,
        amount,
        paymentMode,
        walletAmountAvailable,
      })
      .then((r) => r.data),

  /** Only WALLET_RECHARGE is accepted here — checkout payments are created by placing an
   *  order (see ordersApi.place), never directly. */
  createWalletRechargePayment: (amount: number, idempotencyKey?: string) =>
    apiClient
      .post<PaymentInitiationResponse>('/payments', { useCase: 'WALLET_RECHARGE', amount, idempotencyKey })
      .then((r) => r.data),

  verifyPayment: (paymentId: string, request: VerifyPaymentRequest) =>
    apiClient.post<PaymentStatusResponse>(`/payments/${paymentId}/verify`, request).then((r) => r.data),

  /** Voids a PENDING payment (widget dismissed or verify failed) instead of leaving it for
   *  PaymentExpirySweeper's 15-minute sweep — mirrors web's cancelPayment (payments.js). */
  cancelPayment: (paymentId: string) =>
    apiClient.post<PaymentStatusResponse>(`/payments/${paymentId}/cancel`).then((r) => r.data),

  /** Dev-only: simulates a successful gateway callback when mock payments are allowed. */
  mockComplete: (paymentId: string) =>
    apiClient.post<PaymentStatusResponse>(`/payments/${paymentId}/mock-complete`).then((r) => r.data),

  getStatus: (paymentId: string) =>
    apiClient.get<PaymentStatusResponse>(`/payments/${paymentId}`).then((r) => r.data),
};

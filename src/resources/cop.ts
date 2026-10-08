import type { RequestOptions } from '../core';
import { APIResource } from '../resource';
import type { RequestBody } from '../types';

/**
 * Colombian peso payments: Bre-B (QR / transfer key), Nequi (push approval) or Daviplata (SMS
 * code). Payments complete asynchronously — listen for `payment.completed` / `payment.failed`.
 * COP must be enabled on your account (403 `method_not_allowed` otherwise).
 */
export class CopPayments extends APIResource {
  /**
   * Create a payment in whole pesos. `buyer` is required for `nequi` and `daviplata`. The response
   * `next` says what the buyer does: `show_qr`, `approve_in_app` or `submit_otp`.
   * Pass `idempotencyKey` in options to retry safely.
   */
  create(params: RequestBody<'CopPayments_create'>, options?: RequestOptions) {
    return this.call('CopPayments_create', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('CopPayments_get', { path: { id } }, options);
  }

  /** Daviplata: submit the code the buyer received by SMS. A wrong code fails with `invalid_otp`. */
  submitOtp(id: string, params: RequestBody<'CopPayments_submitOtp'>, options?: RequestOptions) {
    return this.call('CopPayments_submitOtp', { path: { id }, body: params }, options);
  }

  /** Cancel a pending payment. */
  cancel(id: string, options?: RequestOptions) {
    return this.call('CopPayments_cancel', { path: { id } }, options);
  }

  /** Full refund of a completed payment, within 96 hours. */
  refund(id: string, options?: RequestOptions) {
    return this.call('CopPayments_refund', { path: { id } }, options);
  }
}

/** Your COP balance, in whole pesos. Kept apart from VES and stablecoins. */
export class CopBalance extends APIResource {
  retrieve(options?: RequestOptions) {
    return this.call('CopPayments_balance', {}, options);
  }
}

/** Collect Colombian pesos (Bre-B, Nequi, Daviplata). */
export class Cop extends APIResource {
  readonly payments = new CopPayments(this.http);
  readonly balance = new CopBalance(this.http);
}

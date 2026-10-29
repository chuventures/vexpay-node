import type { RequestOptions } from '../core';
import { APIResource } from '../resource';
import type { RequestBody } from '../types';

/**
 * Colombian peso payments: PSE and Bancolombia (bank redirect), Bancolombia QR, Bre-B (QR /
 * transfer key), Nequi (push approval) or Daviplata (SMS code or redirect). Cards are taken only on
 * the hosted checkout. Payments complete asynchronously — listen for `payment.completed` /
 * `payment.failed`. COP must be enabled on your account (403 `method_not_allowed` otherwise).
 */
export class CopPayments extends APIResource {
  /**
   * Create a payment in whole pesos. `buyer` is required for every channel except `breb`, with
   * `termsAccepted: true` when {@link Cop.channels} says `needsTermsAcceptance`; `pse` also needs
   * `pse.bankCode`. The response `next` says what the buyer does: `show_qr`, `approve_in_app`,
   * `submit_otp`, `redirect` (send them to `next.url`) or `redirect_pending` (retrieve again shortly).
   * Pass `idempotencyKey` in options to retry safely.
   */
  create(params: RequestBody<'CopPayments_create'>, options?: RequestOptions) {
    return this.call('CopPayments_create', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('CopPayments_get', { path: { id } }, options);
  }

  /** Daviplata with `next.type: "submit_otp"`: submit the code the buyer received by SMS. A wrong code fails with `invalid_otp`. */
  submitOtp(id: string, params: RequestBody<'CopPayments_submitOtp'>, options?: RequestOptions) {
    return this.call('CopPayments_submitOtp', { path: { id }, body: params }, options);
  }

  /** Cancel a pending payment. */
  cancel(id: string, options?: RequestOptions) {
    return this.call('CopPayments_cancel', { path: { id } }, options);
  }

  /**
   * Full refund of a completed payment, within the channel's window (card 24 h, Bre-B 96 h).
   * Channels that cannot be refunded through the API fail with `refund_not_supported`.
   */
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

/** Collect Colombian pesos (PSE, Bancolombia, Bre-B, Nequi, Daviplata; cards via the hosted checkout). */
export class Cop extends APIResource {
  readonly payments = new CopPayments(this.http);
  readonly balance = new CopBalance(this.http);

  /** Channels you can use right now, with what each needs, plus the PSE banks and terms links. */
  channels(options?: RequestOptions) {
    return this.call('CopPayments_channels', {}, options);
  }
}

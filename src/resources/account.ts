import type { RequestOptions } from '../core';
import { PagePromise } from '../pagination';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** Venezuelan bank catalog (SIMF codes, supported services, logos). */
export class Banks extends APIResource {
  list(options?: RequestOptions) {
    return this.call('Payments_getBanks', {}, options);
  }
}

/** USD → VES at the official BCV rate. */
export class Quotes extends APIResource {
  retrieve(params: QueryParams<'Payments_getQuote'>, options?: RequestOptions) {
    return this.call('Payments_getQuote', { query: params }, options);
  }
}

/** Every movement in your VES balance (payments, fees, payouts, chargebacks, …), newest first. */
export class BalanceTransactions extends APIResource {
  /** Await for one page, or `for await` over every movement. The amounts sum to `ledgerNetVes`. */
  list(params: QueryParams<'Balance_listTransactions'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Balance_listTransactions', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }
}

/**
 * Load your own Bs balance by Pago Móvil (money that is not a sale). Send the exact `amountVes` from
 * `payerPhone` to the returned `receiver` before `expiresAt`; the top-up completes when the transfer
 * arrives. Each top-up needs a `sourceNote` and counts against your monthly limit. Enabled per account
 * (`topups_not_enabled`, 403).
 */
export class BalanceTopups extends APIResource {
  /** Start a top-up. Over the monthly limit fails with `topup_cap_exceeded` (422). */
  create(params: RequestBody<'Topups_create'>, options?: RequestOptions) {
    return this.call('Topups_create', { body: params }, options);
  }

  /** Your latest top-ups (newest first, `limit` 1–100) plus this month's limit usage. */
  list(params: QueryParams<'Topups_list'> = {}, options?: RequestOptions) {
    return this.call('Topups_list', { query: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Topups_get', { path: { id } }, options);
  }

  /** Release the still-held part of a completed top-up now, for `instantFeeVes`. Idempotent; `not_held` (409) if nothing is held. */
  instant(id: string, options?: RequestOptions) {
    return this.call('Topups_instant', { path: { id } }, options);
  }

  /** Test mode only: complete the top-up as if the Pago Móvil arrived. */
  simulate(id: string, options?: RequestOptions) {
    return this.call('Topups_simulate', { path: { id } }, options);
  }
}

/** Your platform balance. */
export class Balance extends APIResource {
  readonly transactions = new BalanceTransactions(this.http);
  readonly topups = new BalanceTopups(this.http);

  retrieve(options?: RequestOptions) {
    return this.call('Balance_getBalance', {}, options);
  }
}

/** VES payouts to verified merchants. `externalRef` is the idempotency key. */
export class Payouts extends APIResource {
  create(params: RequestBody<'Payouts_create'>, options?: RequestOptions) {
    return this.call('Payouts_create', { body: params }, options);
  }

  /** Pay out immediately (crédito inmediato). */
  createInstant(params: RequestBody<'Payouts_createInstant'>, options?: RequestOptions) {
    return this.call('Payouts_createInstant', { body: params }, options);
  }

  /** Many payouts in one request, with item-level idempotency. */
  createBatch(params: RequestBody<'Payouts_createBatch'>, options?: RequestOptions) {
    return this.call('Payouts_createBatch', { body: params }, options);
  }

  /** Await for one page, or `for await` over every payout. */
  list(params: QueryParams<'Payouts_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Payouts_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Payouts_getById', { path: { id } }, options);
  }

  retrieveByRef(externalRef: string, options?: RequestOptions) {
    return this.call('Payouts_getByRef', { path: { externalRef } }, options);
  }
}

/** The account your own VEXPay earnings are paid out to. */
export class TenantPayoutAccount extends APIResource {
  retrieve(options?: RequestOptions) {
    return this.call('TenantPayoutAccount_get', {}, options);
  }

  /** Create or replace the payout account (PUT). */
  upsert(params: RequestBody<'TenantPayoutAccount_upsert'>, options?: RequestOptions) {
    return this.call('TenantPayoutAccount_upsert', { body: params }, options);
  }

  /** Same as `upsert`, sent as POST (supports `Idempotency-Key`). */
  create(params: RequestBody<'TenantPayoutAccount_upsertPost'>, options?: RequestOptions) {
    return this.call('TenantPayoutAccount_upsertPost', { body: params }, options);
  }

  startVerification(options?: RequestOptions) {
    return this.call('TenantPayoutAccount_startVerify', {}, options);
  }

  confirmVerification(params: RequestBody<'TenantPayoutAccount_confirmVerify'>, options?: RequestOptions) {
    return this.call('TenantPayoutAccount_confirmVerify', { body: params }, options);
  }
}

/** Where VEXPay delivers signed webhooks. */
export class WebhookEndpoints extends APIResource {
  /** The response includes the signing `secret` — store it to verify deliveries. */
  create(params: RequestBody<'Webhooks_createWebhook'>, options?: RequestOptions) {
    return this.call('Webhooks_createWebhook', { body: params }, options);
  }

  list(options?: RequestOptions) {
    return this.call('Webhooks_listWebhooks', {}, options);
  }

  update(id: string, params: RequestBody<'Webhooks_updateWebhook'>, options?: RequestOptions) {
    return this.call('Webhooks_updateWebhook', { path: { id }, body: params }, options);
  }

  delete(id: string, options?: RequestOptions) {
    return this.call('Webhooks_deleteWebhook', { path: { id } }, options);
  }

  /** Send a `notification.test` delivery to your endpoints. */
  sendTest(options?: RequestOptions) {
    return this.call('Notifications_sendTest', {}, options);
  }
}

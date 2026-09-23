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

/** Your platform balance. */
export class Balance extends APIResource {
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

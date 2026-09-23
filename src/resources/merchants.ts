import type { RequestOptions } from '../core';
import { PagePromise } from '../pagination';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody, Schemas } from '../types';

export type MerchantListParams = Omit<QueryParams<'Merchants_listOrGetByRef'>, 'externalRef'>;

/** Where a merchant gets paid (bank account or Pago Móvil). */
export class PayoutMethods extends APIResource {
  list(merchantId: string, options?: RequestOptions) {
    return this.call('Merchants_listPayoutMethods', { path: { id: merchantId } }, options);
  }

  create(merchantId: string, params: RequestBody<'Merchants_addPayoutMethod'>, options?: RequestOptions) {
    return this.call('Merchants_addPayoutMethod', { path: { id: merchantId }, body: params }, options);
  }

  setDefault(merchantId: string, methodId: string, options?: RequestOptions) {
    return this.call('Merchants_setDefaultPayoutMethod', { path: { id: merchantId, methodId } }, options);
  }

  delete(merchantId: string, methodId: string, options?: RequestOptions) {
    return this.call('Merchants_deletePayoutMethod', { path: { id: merchantId, methodId } }, options);
  }

  /** Send micro-deposits to this payout method. */
  startVerification(merchantId: string, methodId: string, options?: RequestOptions) {
    return this.call('Merchants_startVerifyMethod', { path: { id: merchantId, methodId } }, options);
  }

  /** Confirm the micro-deposit amounts the merchant saw. */
  confirmVerification(
    merchantId: string,
    methodId: string,
    params: RequestBody<'Merchants_confirmVerifyMethod'>,
    options?: RequestOptions,
  ) {
    return this.call(
      'Merchants_confirmVerifyMethod',
      { path: { id: merchantId, methodId }, body: params },
      options,
    );
  }
}

export class Merchants extends APIResource {
  readonly payoutMethods = new PayoutMethods(this.http);

  /** `externalRef` is required and is the idempotency key for merchant creation. */
  create(params: RequestBody<'Merchants_create'>, options?: RequestOptions) {
    return this.call('Merchants_create', { body: params }, options);
  }

  /** Await for one page (`items`, `nextCursor`), or `for await` over every merchant. */
  list(params: MerchantListParams = {}, options?: RequestOptions) {
    return new PagePromise<Schemas['MerchantListResponseDto']>(
      (cursor) =>
        this.call('Merchants_listOrGetByRef', { query: { ...params, cursor } }, options) as Promise<
          Schemas['MerchantListResponseDto']
        >,
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Merchants_getById', { path: { id } }, options);
  }

  /** Look up a merchant by the `externalRef` you created it with. */
  retrieveByRef(externalRef: string, options?: RequestOptions) {
    return this.call('Merchants_listOrGetByRef', { query: { externalRef } }, options) as Promise<
      Schemas['MerchantResponseDto']
    >;
  }

  update(id: string, params: RequestBody<'Merchants_update'>, options?: RequestOptions) {
    return this.call('Merchants_update', { path: { id }, body: params }, options);
  }

  delete(id: string, options?: RequestOptions) {
    return this.call('Merchants_remove', { path: { id } }, options);
  }

  retrieveBalance(id: string, options?: RequestOptions) {
    return this.call('Merchants_getBalance', { path: { id } }, options);
  }

  /** Move VES between this merchant's balance and another. */
  transfer(id: string, params: RequestBody<'Merchants_transfer'>, options?: RequestOptions) {
    return this.call('Merchants_transfer', { path: { id }, body: params }, options);
  }

  listAuditEvents(id: string, options?: RequestOptions) {
    return this.call('Merchants_listAuditEvents', { path: { id } }, options);
  }

  /** Send micro-deposits to the merchant's default payout method. */
  startVerification(id: string, options?: RequestOptions) {
    return this.call('Merchants_startVerify', { path: { id } }, options);
  }

  confirmVerification(id: string, params: RequestBody<'Merchants_confirmVerify'>, options?: RequestOptions) {
    return this.call('Merchants_confirmVerify', { path: { id }, body: params }, options);
  }
}

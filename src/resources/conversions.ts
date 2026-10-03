import type { RequestOptions } from '../core';
import { PagePromise } from '../pagination';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** A rate for converting VES to USDT, locked for 60 seconds. */
export class ConversionQuotes extends APIResource {
  /** Send `sourceAmountVes` (VES to spend) or `targetAmountUsdt` (USDT to receive) — exactly one. */
  create(params: RequestBody<'Conversions_createQuote'>, options?: RequestOptions) {
    return this.call('Conversions_createQuote', { body: params }, options);
  }
}

/**
 * Convert available VES into your USDT balance. Accepting a quote debits the VES at once; the
 * conversion is `PENDING` until VEXPay delivers the USDT (`conversion.completed`). Enabled per account.
 */
export class Conversions extends APIResource {
  readonly quotes = new ConversionQuotes(this.http);

  /** Accept a quote (`quoteId`). Pass `idempotencyKey` in options to retry safely. */
  create(params: RequestBody<'Conversions_create'>, options?: RequestOptions) {
    return this.call('Conversions_create', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Conversions_get', { path: { id } }, options);
  }

  /** Await for one page, or `for await` over every conversion (newest first). */
  list(params: QueryParams<'Conversions_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Conversions_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  /** Cancel a `PENDING` conversion; the VES returns to your available balance. */
  cancel(id: string, options?: RequestOptions) {
    return this.call('Conversions_cancel', { path: { id } }, options);
  }
}

import type { RequestOptions } from '../core';
import { PagePromise } from '../pagination';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** A rate for converting VES or COP to USDT, locked for 60 seconds. */
export class ConversionQuotes extends APIResource {
  /**
   * `sourceCurrency` is `'VES'` (default) or `'COP'`. Send `sourceAmount` (to spend; COP in whole pesos)
   * or `targetAmountUsdt` (USDT to receive) — exactly one. VES may still use `sourceAmountVes`.
   */
  create(params: RequestBody<'Conversions_createQuote'>, options?: RequestOptions) {
    return this.call('Conversions_createQuote', { body: params }, options);
  }
}

/** Your conversion spreads, minimum and caps, and COP auto-convert. */
export class ConversionSettings extends APIResource {
  retrieve(options?: RequestOptions) {
    return this.call('ConversionSettings_get', {}, options);
  }

  /** Only `autoConvert.COP.percent` (0–100, whole number; 0 = off) can be changed. */
  update(params: RequestBody<'ConversionSettings_update'>, options?: RequestOptions) {
    return this.call('ConversionSettings_update', { body: params }, options);
  }
}

/**
 * Convert available VES or COP into your USDT balance. Accepting a quote debits the source at once
 * (`conversion.created`); the conversion is `PENDING` until VEXPay delivers the USDT
 * (`conversion.completed`). Enabled per account.
 */
export class Conversions extends APIResource {
  readonly quotes = new ConversionQuotes(this.http);
  readonly settings = new ConversionSettings(this.http);

  /** Accept a quote (`quoteId`). Pass `idempotencyKey` in options to retry safely. */
  create(params: RequestBody<'Conversions_create'>, options?: RequestOptions) {
    return this.call('Conversions_create', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Conversions_get', { path: { id } }, options);
  }

  /** Await for one page, or `for await` over every conversion (newest first). Filter with `sourceCurrency`. */
  list(params: QueryParams<'Conversions_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Conversions_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  /** Cancel a `PENDING` conversion; the VES or COP returns to your available balance. */
  cancel(id: string, options?: RequestOptions) {
    return this.call('Conversions_cancel', { path: { id } }, options);
  }
}

import type { RequestOptions } from '../core';
import { PagePromise } from '../pagination';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** Single-purchase checkouts: redirect to `url`, or embed with @vexpay/js using `clientSecret`. */
export class CheckoutSessions extends APIResource {
  /** `clientSecret` is returned only here — hand it to the browser, never store or log it. */
  create(params: RequestBody<'CheckoutSessions_create'>, options?: RequestOptions) {
    return this.call('CheckoutSessions_create', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('CheckoutSessions_retrieve', { path: { id } }, options);
  }
}

export class Checkout extends APIResource {
  readonly sessions = new CheckoutSessions(this.http);
}

/** No-code products sold through hosted payment links. */
export class Products extends APIResource {
  create(params: RequestBody<'Products_create'>, options?: RequestOptions) {
    return this.call('Products_create', { body: params }, options);
  }

  /** Await for one page, or `for await` over every product. */
  list(params: QueryParams<'Products_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Products_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Products_get', { path: { id } }, options);
  }

  update(id: string, params: RequestBody<'Products_update'>, options?: RequestOptions) {
    return this.call('Products_update', { path: { id }, body: params }, options);
  }

  delete(id: string, options?: RequestOptions) {
    return this.call('Products_remove', { path: { id } }, options);
  }

  /** Publish a shareable `/pay/:slug` link for this product. */
  createLink(id: string, params: RequestBody<'Products_createLink'>, options?: RequestOptions) {
    return this.call('Products_createLink', { path: { id }, body: params }, options);
  }

  listLinks(id: string, options?: RequestOptions) {
    return this.call('Products_listLinks', { path: { id } }, options);
  }
}

export class PaymentLinks extends APIResource {
  retrieve(id: string, options?: RequestOptions) {
    return this.call('PaymentLinks_get', { path: { id } }, options);
  }

  update(id: string, params: RequestBody<'PaymentLinks_update'>, options?: RequestOptions) {
    return this.call('PaymentLinks_update', { path: { id }, body: params }, options);
  }

  delete(id: string, options?: RequestOptions) {
    return this.call('PaymentLinks_remove', { path: { id } }, options);
  }
}

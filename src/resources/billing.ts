import type { RequestOptions } from '../core';
import { PagePromise } from '../pagination';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** A customer's attached domiciliación payment methods. */
export class CustomerPaymentMethods extends APIResource {
  /** Await for one page, or `for await` over every attached method (newest first). */
  list(customerId: string, params: QueryParams<'PaymentMethods_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) =>
        this.call('PaymentMethods_list', { path: { id: customerId }, query: { ...params, cursor } }, options),
      params.cursor,
    );
  }
}

/** Who you bill: subscriptions, invoices and payment methods belong to a customer. */
export class Customers extends APIResource {
  readonly paymentMethods = new CustomerPaymentMethods(this.http);

  /** Pass `idempotencyKey` in options to retry safely. */
  create(params: RequestBody<'Customers_create'> = {}, options?: RequestOptions) {
    return this.call('Customers_create', { body: params }, options);
  }

  /** Await for one page, or `for await` over every customer (newest first). Filter with `email`. */
  list(params: QueryParams<'Customers_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Customers_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Customers_retrieve', { path: { id } }, options);
  }

  update(id: string, params: RequestBody<'Customers_update'>, options?: RequestOptions) {
    return this.call('Customers_update', { path: { id }, body: params }, options);
  }

  /** Refused with 409 while the customer has a live subscription. */
  delete(id: string, options?: RequestOptions) {
    return this.call('Customers_remove', { path: { id } }, options);
  }
}

/** Recurring prices (USD per interval) on a product. */
export class Prices extends APIResource {
  create(params: RequestBody<'Prices_create'>, options?: RequestOptions) {
    return this.call('Prices_create', { body: params }, options);
  }

  /** Await for one page, or `for await` over every price. Filter with `product` and `active`. */
  list(params: QueryParams<'Prices_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Prices_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Prices_retrieve', { path: { id } }, options);
  }

  /** Only `active`, `nickname` and `metadata` can change; create a new price for a new amount. */
  update(id: string, params: RequestBody<'Prices_update'>, options?: RequestOptions) {
    return this.call('Prices_update', { path: { id }, body: params }, options);
  }
}

/** Bill a customer on a price every interval. */
export class Subscriptions extends APIResource {
  /** Pass `idempotencyKey` in options to retry safely. */
  create(params: RequestBody<'Subscriptions_create'>, options?: RequestOptions) {
    return this.call('Subscriptions_create', { body: params }, options);
  }

  /** Await for one page, or `for await` over every subscription (newest first). Filter with `customer`, `price`, `status`. */
  list(params: QueryParams<'Subscriptions_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Subscriptions_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Subscriptions_retrieve', { path: { id } }, options);
  }

  /** Changes apply from the next invoice. Set `cancelAtPeriodEnd` to cancel when the period ends. */
  update(id: string, params: RequestBody<'Subscriptions_update'>, options?: RequestOptions) {
    return this.call('Subscriptions_update', { path: { id }, body: params }, options);
  }

  /** Cancel now; its open invoices are voided. */
  cancel(id: string, options?: RequestOptions) {
    return this.call('Subscriptions_cancel', { path: { id } }, options);
  }
}

/** What a subscription bills each period. */
export class Invoices extends APIResource {
  /** Await for one page, or `for await` over every invoice (newest first). Filter with `customer`, `subscription`, `status`. */
  list(params: QueryParams<'Invoices_list'> = {}, options?: RequestOptions) {
    return new PagePromise(
      (cursor) => this.call('Invoices_list', { query: { ...params, cursor } }, options),
      params.cursor,
    );
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Invoices_retrieve', { path: { id } }, options);
  }

  /** Void an open invoice. */
  void(id: string, options?: RequestOptions) {
    return this.call('Invoices_void', { path: { id } }, options);
  }

  /** Stop chasing an open invoice; it can still be paid. */
  markUncollectible(id: string, options?: RequestOptions) {
    return this.call('Invoices_markUncollectible', { path: { id } }, options);
  }

  /** Record an open invoice as paid outside VEXPay (`paidOutOfBand: true`); no money moves. */
  pay(id: string, params: RequestBody<'Invoices_pay'>, options?: RequestOptions) {
    return this.call('Invoices_pay', { path: { id }, body: params }, options);
  }
}

/** A hosted link where a customer authorizes domiciliación (expires in 24 h). */
export class SetupSessions extends APIResource {
  /** `url` is returned only here — send it to the customer. */
  create(params: RequestBody<'SetupSessions_create'>, options?: RequestOptions) {
    return this.call('SetupSessions_create', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('SetupSessions_retrieve', { path: { id } }, options);
  }
}

/** Domiciliación payment methods. List a customer's with `customers.paymentMethods.list()`. */
export class PaymentMethods extends APIResource {
  retrieve(id: string, options?: RequestOptions) {
    return this.call('PaymentMethods_retrieve', { path: { id } }, options);
  }

  /** The method is never charged again. */
  detach(id: string, options?: RequestOptions) {
    return this.call('PaymentMethods_detach', { path: { id } }, options);
  }
}

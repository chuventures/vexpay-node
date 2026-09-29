import type { RequestOptions } from '../core';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** Your USDT balance (USDT settles in USDT, never converted to VES). */
export class CryptoBalance extends APIResource {
  retrieve(options?: RequestOptions) {
    return this.call('Crypto_getBalance', {}, options);
  }
}

/** Static USDT deposit addresses per customer and network. */
export class DepositAddresses extends APIResource {
  /** Get or create — calling again for the same customer and network returns the same address. */
  create(params: RequestBody<'Crypto_createDepositAddress'>, options?: RequestOptions) {
    return this.call('Crypto_createDepositAddress', { body: params }, options);
  }
}

/** Enabled USDT networks with the payout fee and availability for an amount. */
export class CryptoNetworks extends APIResource {
  list(params: QueryParams<'Crypto_listNetworks'> = {}, options?: RequestOptions) {
    return this.call('Crypto_listNetworks', { query: params }, options);
  }
}

/** USDT payouts to external addresses. `idempotencyKey` (in the body) makes retries safe. */
export class CryptoPayouts extends APIResource {
  create(params: RequestBody<'Crypto_createPayout'>, options?: RequestOptions) {
    return this.call('Crypto_createPayout', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Crypto_getPayout', { path: { id } }, options);
  }
}

/** USDT: deposit addresses, balance, networks and payouts. */
export class Crypto extends APIResource {
  readonly balance = new CryptoBalance(this.http);
  readonly depositAddresses = new DepositAddresses(this.http);
  readonly networks = new CryptoNetworks(this.http);
  readonly payouts = new CryptoPayouts(this.http);
}

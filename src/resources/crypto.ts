import type { RequestOptions } from '../core';
import { APIResource } from '../resource';
import type { QueryParams, RequestBody } from '../types';

/** One stablecoin balance (`currency`: USDT by default, or USDC). Never converted to VES. */
export class CryptoBalance extends APIResource {
  retrieve(params: QueryParams<'Crypto_getBalance'> = {}, options?: RequestOptions) {
    return this.call('Crypto_getBalance', { query: params }, options);
  }
}

/** Every stablecoin balance (USDT and USDC). */
export class CryptoBalances extends APIResource {
  list(options?: RequestOptions) {
    return this.call('Crypto_getBalances', {}, options);
  }
}

/** Static deposit addresses per customer, stablecoin (`currency`) and network. */
export class DepositAddresses extends APIResource {
  /** Get or create — calling again for the same customer and network returns the same address. */
  create(params: RequestBody<'Crypto_createDepositAddress'>, options?: RequestOptions) {
    return this.call('Crypto_createDepositAddress', { body: params }, options);
  }
}

/** Enabled networks for one stablecoin (`currency`) with the payout fee and availability for an amount. */
export class CryptoNetworks extends APIResource {
  list(params: QueryParams<'Crypto_listNetworks'> = {}, options?: RequestOptions) {
    return this.call('Crypto_listNetworks', { query: params }, options);
  }
}

/** Stablecoin payouts to external addresses (`currency`: USDT or USDC). `idempotencyKey` (in the body) makes retries safe. */
export class CryptoPayouts extends APIResource {
  create(params: RequestBody<'Crypto_createPayout'>, options?: RequestOptions) {
    return this.call('Crypto_createPayout', { body: params }, options);
  }

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Crypto_getPayout', { path: { id } }, options);
  }
}

/** Stablecoins (USDT, USDC): deposit addresses, balances, networks and payouts. */
export class Crypto extends APIResource {
  readonly balance = new CryptoBalance(this.http);
  readonly balances = new CryptoBalances(this.http);
  readonly depositAddresses = new DepositAddresses(this.http);
  readonly networks = new CryptoNetworks(this.http);
  readonly payouts = new CryptoPayouts(this.http);
}

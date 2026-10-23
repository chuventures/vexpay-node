import { HttpClient, type CoreConfig } from './core';
import { VexPayConfigurationError } from './errors';
import {
  Balance,
  Banks,
  Payouts,
  Quotes,
  TenantPayoutAccount,
  WebhookEndpoints,
} from './resources/account';
import {
  Customers,
  Invoices,
  PaymentMethods,
  Prices,
  SetupSessions,
  Subscriptions,
} from './resources/billing';
import { Checkout, PaymentLinks, Products } from './resources/commerce';
import { Conversions } from './resources/conversions';
import { Cop } from './resources/cop';
import { Crypto } from './resources/crypto';
import { Merchants } from './resources/merchants';
import { Payments } from './resources/payments';
import { Webhooks } from './webhooks';

export const DEFAULT_BASE_URL = 'https://api.pay.vexwallet.co';

export interface VexPayOptions {
  /** API origin. Defaults to production (`https://api.pay.vexwallet.co`). */
  baseUrl?: string;
  /** Per-attempt timeout. Default 30 000 ms. */
  timeoutMs?: number;
  /** Retries for connection errors, timeouts, 429 and 5xx. Default 2. */
  maxNetworkRetries?: number;
  /** Custom fetch (proxies, instrumentation, tests). Defaults to the global fetch. */
  fetch?: typeof fetch;
}

export class VexPay {
  /** @internal */
  readonly http: HttpClient;

  readonly banks: Banks;
  readonly quotes: Quotes;
  readonly balance: Balance;
  readonly payments: Payments;
  readonly checkout: Checkout;
  readonly merchants: Merchants;
  readonly payouts: Payouts;
  /** USDT: deposit addresses, balance, networks and payouts. */
  readonly crypto: Crypto;
  /** Convert available VES to USDT (enabled per account). */
  readonly conversions: Conversions;
  /** Colombian pesos: Bre-B, Nequi and Daviplata payments and the COP balance. */
  readonly cop: Cop;
  readonly products: Products;
  readonly paymentLinks: PaymentLinks;
  readonly tenantPayoutAccount: TenantPayoutAccount;
  readonly webhookEndpoints: WebhookEndpoints;
  /** Billing: who you bill. */
  readonly customers: Customers;
  /** Billing: recurring prices on products. */
  readonly prices: Prices;
  /** Billing: bill a customer on a price every interval. */
  readonly subscriptions: Subscriptions;
  readonly invoices: Invoices;
  /** Billing: hosted links where a customer authorizes domiciliación. */
  readonly setupSessions: SetupSessions;
  /** Billing: domiciliación payment methods (bolívar methods your account takes: `payments.methods()`). */
  readonly paymentMethods: PaymentMethods;
  /** Offline helpers: `constructEvent` verifies deliveries; no API calls. */
  readonly webhooks = new Webhooks();

  constructor(apiKey: string, options: VexPayOptions = {}) {
    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new VexPayConfigurationError(
        'A VEXPay API key is required: new VexPay(process.env.VEXPAY_API_KEY).',
      );
    }
    const fetchImpl = options.fetch ?? globalThis.fetch;
    if (typeof fetchImpl !== 'function') {
      throw new VexPayConfigurationError('No fetch implementation found. Use Node.js 20+ or pass options.fetch.');
    }
    const config: CoreConfig = {
      apiKey: apiKey.trim(),
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
      timeoutMs: options.timeoutMs ?? 30_000,
      maxNetworkRetries: options.maxNetworkRetries ?? 2,
      fetch: fetchImpl.bind(globalThis),
    };
    this.http = new HttpClient(config);

    this.banks = new Banks(this.http);
    this.quotes = new Quotes(this.http);
    this.balance = new Balance(this.http);
    this.payments = new Payments(this.http);
    this.checkout = new Checkout(this.http);
    this.merchants = new Merchants(this.http);
    this.payouts = new Payouts(this.http);
    this.crypto = new Crypto(this.http);
    this.conversions = new Conversions(this.http);
    this.cop = new Cop(this.http);
    this.products = new Products(this.http);
    this.paymentLinks = new PaymentLinks(this.http);
    this.tenantPayoutAccount = new TenantPayoutAccount(this.http);
    this.webhookEndpoints = new WebhookEndpoints(this.http);
    this.customers = new Customers(this.http);
    this.prices = new Prices(this.http);
    this.subscriptions = new Subscriptions(this.http);
    this.invoices = new Invoices(this.http);
    this.setupSessions = new SetupSessions(this.http);
    this.paymentMethods = new PaymentMethods(this.http);
  }
}

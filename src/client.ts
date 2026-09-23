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
import { Checkout, PaymentLinks, Products } from './resources/commerce';
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
  readonly products: Products;
  readonly paymentLinks: PaymentLinks;
  readonly tenantPayoutAccount: TenantPayoutAccount;
  readonly webhookEndpoints: WebhookEndpoints;
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
    this.products = new Products(this.http);
    this.paymentLinks = new PaymentLinks(this.http);
    this.tenantPayoutAccount = new TenantPayoutAccount(this.http);
    this.webhookEndpoints = new WebhookEndpoints(this.http);
  }
}

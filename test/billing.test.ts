import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { VexPay, type Schemas } from '../src/index';
import { mockServer } from './mock-server';

const CUSTOMER = { id: 'cus_1', object: 'customer', name: 'María Pérez', email: 'maria@example.com', metadata: {} };
const PRICE = { id: 'price_1', object: 'price', product: 'prod_1', unitAmountUsd: '10.00', active: true };
const SUBSCRIPTION = { id: 'sub_1', object: 'subscription', customer: 'cus_1', status: 'active', cancelAtPeriodEnd: false };
const INVOICE = { id: 'in_1', object: 'invoice', status: 'open', customer: 'cus_1', subscription: 'sub_1' };
const SETUP = { id: 'seti_1', object: 'setup_session', customer: 'cus_1', status: 'open', url: 'https://pay.example/setup/seti_1' };
const METHOD = { id: 'pm_1', object: 'payment_method', customer: 'cus_1', status: 'active' };

/** Two pages for every list: the first points at `c2`, the second ends. */
function page(item: { id: string }, url: string) {
  return url.includes('cursor=c2')
    ? { items: [{ ...item, id: `${item.id}_b` }], nextCursor: null }
    : { items: [item], nextCursor: 'c2' };
}

describe('billing', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      const path = req.url.split('?')[0]!;
      if (path === '/v1/customers/cus_1/payment-methods') return { status: 200, body: page(METHOD, req.url) };
      if (req.method === 'GET' && path === '/v1/customers') return { status: 200, body: page(CUSTOMER, req.url) };
      if (req.method === 'GET' && path === '/v1/prices') return { status: 200, body: page(PRICE, req.url) };
      if (req.method === 'GET' && path === '/v1/subscriptions') return { status: 200, body: page(SUBSCRIPTION, req.url) };
      if (req.method === 'GET' && path === '/v1/invoices') return { status: 200, body: page(INVOICE, req.url) };
      if (req.method === 'DELETE' && path.startsWith('/v1/customers/')) return { status: 200, body: { id: 'cus_1', deleted: true } };
      if (req.method === 'DELETE' && path.startsWith('/v1/subscriptions/')) return { status: 200, body: { ...SUBSCRIPTION, status: 'canceled' } };
      if (req.method === 'DELETE' && path.startsWith('/v1/payment-methods/')) return { status: 200, body: { ...METHOD, status: 'detached' } };
      if (path.endsWith('/void')) return { status: 200, body: { ...INVOICE, status: 'void' } };
      if (path.endsWith('/mark-uncollectible')) return { status: 200, body: { ...INVOICE, status: 'uncollectible' } };
      if (path.endsWith('/pay')) return { status: 200, body: { ...INVOICE, status: 'paid', paidOutOfBand: true } };
      const created = req.method === 'POST' && path.split('/').length === 3;
      const body = path.startsWith('/v1/customers')
        ? CUSTOMER
        : path.startsWith('/v1/prices')
          ? PRICE
          : path.startsWith('/v1/subscriptions')
            ? SUBSCRIPTION
            : path.startsWith('/v1/invoices')
              ? INVOICE
              : path.startsWith('/v1/setup-sessions')
                ? SETUP
                : METHOD;
      return { status: created ? 201 : 200, body };
    });
    vexpay = new VexPay('sk_test_billing', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  const last = () => server.requests.at(-1)!;

  it('creates, retrieves, updates and deletes a customer', async () => {
    const customer = await vexpay.customers.create(
      { name: 'María Pérez', email: 'maria@example.com' },
      { idempotencyKey: 'cus-1' },
    );
    expect(customer.id).toBe('cus_1');
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/customers', body: { name: 'María Pérez' } });
    expect(last().headers['idempotency-key']).toBe('cus-1');

    await vexpay.customers.retrieve('cus_1');
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/customers/cus_1' });

    await vexpay.customers.update('cus_1', { phone: '04141234567' });
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/customers/cus_1', body: { phone: '04141234567' } });

    expect(await vexpay.customers.delete('cus_1')).toEqual({ id: 'cus_1', deleted: true });
    expect(last()).toMatchObject({ method: 'DELETE', url: '/v1/customers/cus_1' });
  });

  it('paginates customers and their payment methods', async () => {
    const first = await vexpay.customers.list({ email: 'maria@example.com', limit: 1 });
    expect(first.nextCursor).toBe('c2');
    expect(last().url).toBe('/v1/customers?email=maria%40example.com&limit=1');

    const ids = (await vexpay.customers.list({ limit: 1 }).autoPagingToArray()).map((c) => c.id);
    expect(ids).toEqual(['cus_1', 'cus_1_b']);
    expect(last().url).toBe('/v1/customers?limit=1&cursor=c2');

    const methods = await vexpay.customers.paymentMethods.list('cus_1').autoPagingToArray();
    expect(methods.map((m) => m.id)).toEqual(['pm_1', 'pm_1_b']);
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/customers/cus_1/payment-methods?cursor=c2' });
  });

  it('creates, lists, retrieves and updates prices', async () => {
    await vexpay.prices.create({ product: 'prod_1', unitAmountUsd: 10, recurring: { interval: 'month' } });
    expect(last()).toMatchObject({
      method: 'POST',
      url: '/v1/prices',
      body: { product: 'prod_1', unitAmountUsd: 10, recurring: { interval: 'month' } },
    });

    const ids: string[] = [];
    for await (const price of vexpay.prices.list({ product: 'prod_1', active: 'true' })) ids.push(price.id);
    expect(ids).toEqual(['price_1', 'price_1_b']);
    expect(last().url).toBe('/v1/prices?product=prod_1&active=true&cursor=c2');

    await vexpay.prices.retrieve('price_1');
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/prices/price_1' });

    await vexpay.prices.update('price_1', { active: false });
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/prices/price_1', body: { active: false } });
  });

  it('creates, lists, updates and cancels subscriptions', async () => {
    await vexpay.subscriptions.create(
      { customer: 'cus_1', price: 'price_1', methods: ['c2p'] },
      { idempotencyKey: 'sub-1' },
    );
    expect(last()).toMatchObject({
      method: 'POST',
      url: '/v1/subscriptions',
      body: { customer: 'cus_1', price: 'price_1', methods: ['c2p'] },
    });
    expect(last().headers['idempotency-key']).toBe('sub-1');

    const first = await vexpay.subscriptions.list({ customer: 'cus_1', status: 'active' });
    expect(first.items[0]!.id).toBe('sub_1');
    expect(last().url).toBe('/v1/subscriptions?customer=cus_1&status=active');

    await vexpay.subscriptions.retrieve('sub_1');
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/subscriptions/sub_1' });

    await vexpay.subscriptions.update('sub_1', { cancelAtPeriodEnd: true });
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/subscriptions/sub_1', body: { cancelAtPeriodEnd: true } });

    expect((await vexpay.subscriptions.cancel('sub_1')).status).toBe('canceled');
    expect(last()).toMatchObject({ method: 'DELETE', url: '/v1/subscriptions/sub_1', body: undefined });
  });

  it('lists, retrieves, voids, marks uncollectible and pays invoices', async () => {
    const all = await vexpay.invoices.list({ subscription: 'sub_1' }).autoPagingToArray();
    expect(all.map((i) => i.id)).toEqual(['in_1', 'in_1_b']);
    expect(last().url).toBe('/v1/invoices?subscription=sub_1&cursor=c2');

    await vexpay.invoices.retrieve('in_1');
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/invoices/in_1' });

    expect((await vexpay.invoices.void('in_1')).status).toBe('void');
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/invoices/in_1/void' });
    expect(last().headers['idempotency-key']).toBeTruthy();

    expect((await vexpay.invoices.markUncollectible('in_1')).status).toBe('uncollectible');
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/invoices/in_1/mark-uncollectible' });

    expect((await vexpay.invoices.pay('in_1', { paidOutOfBand: true })).status).toBe('paid');
    expect(last()).toMatchObject({ method: 'POST', url: '/v1/invoices/in_1/pay', body: { paidOutOfBand: true } });
  });

  it('creates and retrieves setup sessions', async () => {
    const setup = await vexpay.setupSessions.create({ customer: 'cus_1', successUrl: 'https://shop.example/done' });
    expect(setup.url).toBe(SETUP.url);
    expect(last()).toMatchObject({
      method: 'POST',
      url: '/v1/setup-sessions',
      body: { customer: 'cus_1', successUrl: 'https://shop.example/done' },
    });

    await vexpay.setupSessions.retrieve('seti_1');
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/setup-sessions/seti_1' });
  });

  it('retrieves and detaches payment methods', async () => {
    await vexpay.paymentMethods.retrieve('pm_1');
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/payment-methods/pm_1' });

    expect((await vexpay.paymentMethods.detach('pm_1')).status).toBe('detached');
    expect(last()).toMatchObject({ method: 'DELETE', url: '/v1/payment-methods/pm_1' });
  });

  it('keeps payments.methods() on the bolívar method list', async () => {
    await vexpay.payments.methods();
    expect(last()).toMatchObject({ method: 'GET', url: '/v1/payment-methods' });
  });
});

describe('typed billing resources', () => {
  it('ties methods to the generated schemas', () => {
    const vexpay = new VexPay('sk_test_types');
    expectTypeOf(vexpay.customers.create).returns.resolves.toEqualTypeOf<Schemas['CustomerResponseDto']>();
    expectTypeOf(vexpay.customers.delete).returns.resolves.toEqualTypeOf<Schemas['DeletedObjectResponseDto']>();
    expectTypeOf(vexpay.prices.create).parameter(0).toEqualTypeOf<Schemas['CreatePriceDto']>();
    expectTypeOf(vexpay.subscriptions.cancel).returns.resolves.toEqualTypeOf<Schemas['SubscriptionResponseDto']>();
    expectTypeOf(vexpay.invoices.pay).returns.resolves.toEqualTypeOf<Schemas['InvoiceResponseDto']>();
    expectTypeOf(vexpay.setupSessions.create).returns.resolves.toEqualTypeOf<Schemas['SetupSessionResponseDto']>();
    expectTypeOf(vexpay.paymentMethods.detach).returns.resolves.toEqualTypeOf<Schemas['PaymentMethodResponseDto']>();
  });
});

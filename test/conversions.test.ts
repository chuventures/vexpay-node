import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VexPay } from '../src/index';
import { mockServer } from './mock-server';

const CONVERSION = {
  id: 'c0a8f6a2-1111-4b7e-9a51-0f4a1e9a0001', object: 'conversion', status: 'PENDING', reference: null,
  rate: '998.8299', marketRate: '979.2450', spreadPercent: '2.0000', rateSource: 'market',
  sourceAmountVes: '10000.00', targetAmountUsdt: '10.01', createdAt: '2026-10-03T00:00:00.000Z',
  completedAt: null, canceledAt: null, cancelReason: null,
};

describe('conversions', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      if (req.url === '/v1/conversions/quotes') {
        return { status: 201, body: { id: 'q1', object: 'conversion_quote', rate: '998.8299', marketRate: '979.2450', spreadPercent: '2.0000', rateSource: 'market', sourceAmountVes: '10000.00', targetAmountUsdt: '10.01', expiresAt: '2026-10-03T00:01:00.000Z', createdAt: '2026-10-03T00:00:00.000Z' } };
      }
      if (req.url.endsWith('/cancel')) return { status: 200, body: { ...CONVERSION, status: 'CANCELED', cancelReason: 'canceled_by_tenant' } };
      if (req.url.startsWith('/v1/conversions?')) return { status: 200, body: { items: [CONVERSION], nextCursor: null } };
      return { status: req.method === 'POST' ? 201 : 200, body: CONVERSION };
    });
    vexpay = new VexPay('sk_test_conv', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('quotes then converts with an idempotency key', async () => {
    const quote = await vexpay.conversions.quotes.create({ sourceAmountVes: '10000.00' });
    expect(quote.targetAmountUsdt).toBe('10.01');
    expect(server.requests.at(-1)!.body).toEqual({ sourceAmountVes: '10000.00' });

    const conversion = await vexpay.conversions.create({ quoteId: quote.id }, { idempotencyKey: 'conv-1' });
    expect(conversion.status).toBe('PENDING');
    const req = server.requests.at(-1)!;
    expect(req.url).toBe('/v1/conversions');
    expect(req.headers['idempotency-key']).toBe('conv-1');
    expect(req.body).toEqual({ quoteId: 'q1' });
  });

  it('retrieves, lists and cancels', async () => {
    expect((await vexpay.conversions.retrieve(CONVERSION.id)).id).toBe(CONVERSION.id);
    const page = await vexpay.conversions.list({ status: 'PENDING', limit: 10 });
    expect(page.items).toHaveLength(1);
    expect(server.requests.at(-1)!.url).toBe('/v1/conversions?status=PENDING&limit=10');
    const canceled = await vexpay.conversions.cancel(CONVERSION.id);
    expect(canceled.status).toBe('CANCELED');
    expect(server.requests.at(-1)!.url).toBe(`/v1/conversions/${CONVERSION.id}/cancel`);
  });
});

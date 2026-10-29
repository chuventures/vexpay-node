import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VexPay } from '../src/index';
import { mockServer } from './mock-server';

const MERCHANT_ID = '5e0c7b1a-3333-4b7e-9a51-0f4a1e9a0003';
const BALANCE = {
  merchantId: MERCHANT_ID,
  accountId: 'acct_1',
  tenantId: '5e0c7b1a-4444-4b7e-9a51-0f4a1e9a0004',
  pendingVes: '21540.00',
  availableVes: '0.00',
  paidOutVes: '0.00',
  ledgerNetVes: '21540.00',
};
const movement = (id: string) => ({
  id,
  type: 'credit',
  amountVes: '21540.00',
  description: 'Credit',
  transferKey: 'q1-nov-u1',
  amountUsd: '100.00',
  rate: '215.4000',
  rateSource: 'bcv',
  createdAt: '2026-11-03T12:00:00.000Z',
});
const CSV = 'date,type,amountVes,balanceVes\n2026-11-03T12:00:00.000Z,credit,21540.00,21540.00\n';

describe('merchants: seller balances', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      if (req.url.endsWith('/transfers')) {
        return {
          status: 200,
          body: {
            ...BALANCE,
            transfer: { transferKey: 'q1-nov-u1', amountVes: '21540.00', amountUsd: '100.00', rate: '215.4000', rateSource: 'bcv', rateAsOf: '2026-11-03T00:00:00.000Z' },
          },
        };
      }
      if (req.url.includes('/transactions')) {
        return req.url.includes('cursor=c2')
          ? { status: 200, body: { items: [movement('m3')], nextCursor: null } }
          : { status: 200, body: { items: [movement('m1'), movement('m2')], nextCursor: 'c2' } };
      }
      if (req.url.includes('format=csv')) return { status: 200, body: CSV, headers: { 'content-type': 'text/csv' } };
      if (req.url.includes('/statement')) {
        return {
          status: 200,
          body: {
            merchantId: MERCHANT_ID, month: '2026-11', from: '2026-11-01T04:00:00.000Z', to: '2026-12-01T04:00:00.000Z',
            openingVes: '0.00', closingVes: '21540.00', movements: [movement('m1')],
          },
        };
      }
      return { status: 404, body: { message: 'not found' } };
    });
    vexpay = new VexPay('sk_test_merchants', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('transfers a USD amount and returns the balance with the transfer snapshot', async () => {
    const result = await vexpay.merchants.transfer(MERCHANT_ID, { amountUsd: '100.00', transferKey: 'q1-nov-u1' });
    expect(result.transfer.amountVes).toBe('21540.00');
    expect(result.transfer.rate).toBe('215.4000');
    expect(server.requests.at(-1)).toMatchObject({
      method: 'POST',
      url: `/v1/merchants/${MERCHANT_ID}/transfers`,
      body: { amountUsd: '100.00', transferKey: 'q1-nov-u1' },
    });
  });

  it('lists transactions one page at a time or across every page', async () => {
    const page = await vexpay.merchants.listTransactions(MERCHANT_ID, { limit: 2, from: '2026-11-01T00:00:00Z' });
    expect(page.items.map((m) => m.id)).toEqual(['m1', 'm2']);
    expect(page.nextCursor).toBe('c2');
    expect(server.requests.at(-1)?.url).toBe(
      `/v1/merchants/${MERCHANT_ID}/transactions?limit=2&from=2026-11-01T00%3A00%3A00Z`,
    );

    const ids: string[] = [];
    for await (const m of vexpay.merchants.listTransactions(MERCHANT_ID)) ids.push(m.id);
    expect(ids).toEqual(['m1', 'm2', 'm3']);
  });

  it('retrieves the monthly statement as JSON', async () => {
    const statement = await vexpay.merchants.retrieveStatement(MERCHANT_ID, { month: '2026-11' });
    expect(statement.closingVes).toBe('21540.00');
    expect(statement.movements).toHaveLength(1);
    expect(server.requests.at(-1)?.url).toBe(`/v1/merchants/${MERCHANT_ID}/statement?month=2026-11&format=json`);
  });

  it('retrieves the monthly statement as a CSV string', async () => {
    const csv = await vexpay.merchants.retrieveStatementCsv(MERCHANT_ID, { month: '2026-11' });
    expect(csv).toBe(CSV);
    expect(server.requests.at(-1)?.url).toBe(`/v1/merchants/${MERCHANT_ID}/statement?month=2026-11&format=csv`);
  });
});

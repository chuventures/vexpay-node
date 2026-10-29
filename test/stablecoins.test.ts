import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VexPay } from '../src/index';
import { mockServer } from './mock-server';

const USDC_PAYOUT = {
  id: 'po_1', object: 'crypto.payout', currency: 'USDC', status: 'processing', network: 'BASE',
  address: '0x' + 'a'.repeat(40), amount: '10.00', fee: '0.10', idempotencyKey: 'k1', internal: false,
  createdAt: '2026-10-02T00:00:00.000Z',
};

const SIMULATED = {
  paymentId: '3fd84b2d-9ad1-4f74-a2d9-0f2f56984db5', status: 'COMPLETED', method: 'USDT', currency: 'USDT',
  amount: '40.00', fee: '1.50', amountUsdt: '40.00', feeUsdt: '1.50', network: 'TRC20', customerRef: 'user_123',
  txHashes: [], livemode: false, simulated: true, createdAt: '2026-10-29T00:00:00.000Z',
};

describe('stablecoins (USDC)', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      if (req.url.startsWith('/v1/crypto/payouts')) return { status: 201, body: USDC_PAYOUT };
      if (req.url === '/v1/crypto/deposit-addresses/simulate') return { status: 201, body: SIMULATED };
      if (req.url.startsWith('/v1/crypto/balances')) {
        return { status: 200, body: { data: [
          { currency: 'USDT', available: '1.00', pendingPayout: '0.00', availableUsdt: '1.00', pendingPayoutUsdt: '0.00', asOf: '2026-10-02T00:00:00.000Z' },
          { currency: 'USDC', available: '4.37', pendingPayout: '0.00', asOf: '2026-10-02T00:00:00.000Z' },
        ] } };
      }
      return { status: 200, body: { currency: 'USDC', available: '4.37', pendingPayout: '0.00', asOf: '2026-10-02T00:00:00.000Z' } };
    });
    vexpay = new VexPay('sk_test_usdc', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('sends a USDC payout with currency and amount', async () => {
    const payout = await vexpay.crypto.payouts.create({
      currency: 'USDC', network: 'BASE', address: USDC_PAYOUT.address, amount: '10.00', idempotencyKey: 'k1',
    });
    expect(payout.currency).toBe('USDC');
    expect(payout.amount).toBe('10.00');
    expect(server.requests.at(-1)!.body).toMatchObject({ currency: 'USDC', network: 'BASE', amount: '10.00' });
  });

  it('reads a USDC balance with the currency query', async () => {
    const balance = await vexpay.crypto.balance.retrieve({ currency: 'USDC' });
    expect(balance.available).toBe('4.37');
    expect(server.requests.at(-1)!.url).toBe('/v1/crypto/balance?currency=USDC');
  });

  it('lists both balances', async () => {
    const res = await vexpay.crypto.balances.list();
    expect(res.data.map((b) => b.currency)).toEqual(['USDT', 'USDC']);
  });

  it('simulates a Test-mode deposit to a deposit address', async () => {
    const res = await vexpay.crypto.simulateDeposit({ customerRef: 'user_123', network: 'TRC20', currency: 'USDT', amount: '40.00' });
    expect(res).toMatchObject({ simulated: true, livemode: false, fee: '1.50' });
    const req = server.requests.at(-1)!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/v1/crypto/deposit-addresses/simulate');
    expect(req.body).toEqual({ customerRef: 'user_123', network: 'TRC20', currency: 'USDT', amount: '40.00' });
  });
});

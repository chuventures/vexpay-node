import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { VexPay } from '../src/index';
import { mockServer } from './mock-server';

const PAYMENT = {
  id: '5e0c7b1a-2222-4b7e-9a51-0f4a1e9a0002', status: 'pending', method: 'COP', channel: 'daviplata',
  amountCop: 50000, metadata: {}, createdAt: '2026-10-08T00:00:00.000Z', expiresAt: '2026-10-08T00:05:00.000Z',
};

describe('cop', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      if (req.url === '/v1/cop/balance') return { status: 200, body: { availableCop: 96500, pendingPayoutCop: 0, asOf: '2026-10-08T00:00:00.000Z' } };
      if (req.url.endsWith('/otp')) return { status: 200, body: { ...PAYMENT, status: 'completed', feeCop: 1750 } };
      if (req.url.endsWith('/cancel')) return { status: 200, body: { ...PAYMENT, status: 'canceled' } };
      if (req.url.endsWith('/refund')) return { status: 200, body: { ...PAYMENT, status: 'refunded' } };
      if (req.method === 'POST') return { status: 201, body: { ...PAYMENT, next: { type: 'submit_otp' } } };
      return { status: 200, body: PAYMENT };
    });
    vexpay = new VexPay('sk_test_cop', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('creates a Daviplata payment with an idempotency key, then submits the OTP', async () => {
    const payment = await vexpay.cop.payments.create(
      {
        amountCop: 50000,
        channel: 'daviplata',
        buyer: { email: 'juan@example.com', phone: '3001234567', documentType: 'CC', documentNumber: '1234567890' },
      },
      { idempotencyKey: 'cop-1' },
    );
    expect(payment.next?.type).toBe('submit_otp');
    const created = server.requests.at(-1)!;
    expect(created.url).toBe('/v1/cop/payments');
    expect(created.headers['idempotency-key']).toBe('cop-1');
    expect(created.body).toMatchObject({ amountCop: 50000, channel: 'daviplata' });

    const done = await vexpay.cop.payments.submitOtp(payment.id, { otp: '123456' });
    expect(done.status).toBe('completed');
    expect(server.requests.at(-1)!).toMatchObject({ url: `/v1/cop/payments/${PAYMENT.id}/otp`, body: { otp: '123456' } });
  });

  it('retrieves, cancels and refunds', async () => {
    expect((await vexpay.cop.payments.retrieve(PAYMENT.id)).channel).toBe('daviplata');
    expect((await vexpay.cop.payments.cancel(PAYMENT.id)).status).toBe('canceled');
    expect((await vexpay.cop.payments.refund(PAYMENT.id)).status).toBe('refunded');
    expect(server.requests.at(-1)!.url).toBe(`/v1/cop/payments/${PAYMENT.id}/refund`);
  });

  it('reads the COP balance', async () => {
    const balance = await vexpay.cop.balance.retrieve();
    expect(balance).toMatchObject({ availableCop: 96500 });
    expect(server.requests.at(-1)!.url).toBe('/v1/cop/balance');
  });
});

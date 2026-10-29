import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { VexPay, VexPayConflictError, VexPayInvalidRequestError, type Schemas } from '../src/index';
import { mockServer } from './mock-server';

const TOPUP = {
  id: 'tp_1', status: 'pending', amountVes: '100000.00', amountUsd: '500.00', bcvRate: '200.0000',
  feePercent: '3.5000', feeFixedUsd: '0.25', feeVes: null, creditedVes: null,
  sourceNote: 'Ingresos publicidad quincena 2', payerPhone: '04121234567', bankReference: null,
  expiresAt: '2026-10-28T00:15:00.000Z', completedAt: null, availableAt: null, heldVes: '0.00',
  instantFeePercent: '1.5000', instantFeeVes: '0.00', instantReleasedAt: null,
  receiver: { bankCode: '0169', phone: '04140000000', identification: 'J-000000000' },
  test: true, createdAt: '2026-10-28T00:00:00.000Z',
};
const COMPLETED = {
  ...TOPUP, status: 'completed', feeVes: '3550.00', creditedVes: '96450.00', bankReference: '123456',
  completedAt: '2026-10-28T00:05:00.000Z', availableAt: '2026-10-29T00:05:00.000Z', heldVes: '96450.00',
  instantFeeVes: '1446.75', receiver: null,
};
const CREATE = {
  amountVes: '100000.00', payerPhone: '04121234567', payerCedula: 'V12345678', sourceNote: 'Ingresos publicidad quincena 2',
};

describe('balance.topups', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      if (req.url === '/v1/balance/topups' && (req.body as { amountVes?: string } | undefined)?.amountVes === '999999999.00') {
        return {
          status: 422,
          body: {
            error: 'topup_cap_exceeded', message: 'Over the monthly limit',
            capUsd: '3000.00', usedUsd: '500.00', remainingUsd: '2500.00', remainingVes: '500000.00',
          },
        };
      }
      if (req.url === '/v1/balance/topups/tp_2/instant') return { status: 409, body: { error: 'not_held', message: 'Nothing held' } };
      if (req.url.endsWith('/instant')) {
        return { status: 200, body: { ...COMPLETED, heldVes: '0.00', availableAt: null, instantReleasedAt: '2026-10-28T00:06:00.000Z' } };
      }
      if (req.url.endsWith('/simulate')) return { status: 200, body: COMPLETED };
      if (req.method === 'GET' && req.url.split('?')[0] === '/v1/balance/topups') {
        return { status: 200, body: { data: [TOPUP], monthlyCapUsd: '3000.00', monthUsedUsd: '500.00', monthRemainingUsd: '2500.00' } };
      }
      return { status: req.method === 'POST' ? 201 : 200, body: TOPUP };
    });
    vexpay = new VexPay('sk_test_topups', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('creates a top-up with an idempotency key', async () => {
    const topup = await vexpay.balance.topups.create(CREATE, { idempotencyKey: 'tp-1' });
    expect(topup.receiver?.bankCode).toBe('0169');
    const req = server.requests.at(-1)!;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/v1/balance/topups');
    expect(req.headers['idempotency-key']).toBe('tp-1');
    expect(req.body).toEqual(CREATE);
  });

  it('lists with the monthly limit usage and retrieves one', async () => {
    const list = await vexpay.balance.topups.list({ limit: 5 });
    expect(list.data).toHaveLength(1);
    expect(list.monthRemainingUsd).toBe('2500.00');
    expect(server.requests.at(-1)!.url).toBe('/v1/balance/topups?limit=5');
    await vexpay.balance.topups.list();
    expect(server.requests.at(-1)!.url).toBe('/v1/balance/topups');
    expect((await vexpay.balance.topups.retrieve('tp_1')).id).toBe('tp_1');
    expect(server.requests.at(-1)).toMatchObject({ method: 'GET', url: '/v1/balance/topups/tp_1' });
  });

  it('simulates and releases instantly', async () => {
    const done = await vexpay.balance.topups.simulate('tp_1');
    expect(done.status).toBe('completed');
    expect(server.requests.at(-1)).toMatchObject({ method: 'POST', url: '/v1/balance/topups/tp_1/simulate' });
    const released = await vexpay.balance.topups.instant('tp_1');
    expect(released.heldVes).toBe('0.00');
    expect(server.requests.at(-1)).toMatchObject({ method: 'POST', url: '/v1/balance/topups/tp_1/instant' });
  });

  it('surfaces not_held and topup_cap_exceeded', async () => {
    const conflict = await vexpay.balance.topups.instant('tp_2').catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(VexPayConflictError);
    expect(conflict).toMatchObject({ code: 'not_held', status: 409 });

    const capped = await vexpay.balance.topups.create({ ...CREATE, amountVes: '999999999.00' }).catch((e: unknown) => e);
    expect(capped).toBeInstanceOf(VexPayInvalidRequestError);
    expect(capped).toMatchObject({ code: 'topup_cap_exceeded', status: 422, body: { remainingVes: '500000.00' } });
  });

  it('is typed against the generated schemas', () => {
    expectTypeOf(vexpay.balance.topups.create).parameter(0).toEqualTypeOf<Schemas['CreateTopupDto']>();
    expectTypeOf(vexpay.balance.topups.list).returns.resolves.toEqualTypeOf<Schemas['TopupListDto']>();
    expectTypeOf(vexpay.balance.topups.retrieve).returns.resolves.toEqualTypeOf<Schemas['TopupDto']>();
    expectTypeOf(vexpay.balance.topups.instant).returns.resolves.toEqualTypeOf<Schemas['TopupDto']>();
  });
});

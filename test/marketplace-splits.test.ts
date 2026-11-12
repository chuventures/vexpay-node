import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { VexPay, type Schemas } from '../src/index';
import { mockServer } from './mock-server';

const MERCHANT_A = '5e0c7b1a-3333-4b7e-9a51-0f4a1e9a0003';
const SPLITS = [
  { merchantId: MERCHANT_A, amount: '6000.00', applicationFeePercent: 20, reference: 'order-1042/a' },
  { merchantId: 'mrc_5e0c7b1a44444b7e9a510f4a1e9a0004', amount: '3000.00', applicationFeeVes: '600.00' },
];
const RECEIPT_SPLITS = [
  {
    merchantId: MERCHANT_A,
    accountId: 'acct_5e0c7b1a33334b7e9a510f4a1e9a0003',
    merchantExternalRef: 'comercio-17',
    amountVes: '6000.00',
    applicationFeeVes: '1200.00',
    applicationFeePercent: '20.0000',
    feeVes: '180.00',
    netVes: '4620.00',
    reference: 'order-1042/a',
  },
];
const SETTINGS = { merchantAutoPayoutDefault: true, merchantAutoPayoutMinUsd: '10.00' };

describe('marketplace: multi-merchant splits and comercio auto-payout settings', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer((req) => {
      if (req.url === '/v1/marketplace/settings') return { status: 200, body: SETTINGS };
      if (req.url.startsWith('/v1/payments/vpos')) return { status: 201, body: { id: 'p1', status: 'PENDING' } };
      return { status: 200, body: { id: 'p1', status: 'COMPLETED', vesAmount: '10000.00', splits: RECEIPT_SPLITS } };
    });
    vexpay = new VexPay('sk_test_splits', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('types splits on every payment request that can split', () => {
    expectTypeOf<Schemas['ImmediateDebitDto']['splits']>().toEqualTypeOf<Schemas['SplitShareDto'][] | undefined>();
    expectTypeOf<Schemas['C2pPaymentDto']['splits']>().toEqualTypeOf<Schemas['SplitShareDto'][] | undefined>();
    expectTypeOf<Schemas['C2pRequestDto']['splits']>().toEqualTypeOf<Schemas['SplitShareDto'][] | undefined>();
    expectTypeOf<Schemas['PagoMovilVerifyDto']['splits']>().toEqualTypeOf<Schemas['SplitShareDto'][] | undefined>();
    expectTypeOf<Schemas['VposPaymentDto']['splits']>().toEqualTypeOf<Schemas['SplitShareDto'][] | undefined>();
    expectTypeOf<Schemas['PaymentReceiptDto']['splits']>().toEqualTypeOf<Schemas['PaymentSplitViewDto'][] | undefined>();
  });

  it('sends splits as given on a VPOS charge', async () => {
    await vexpay.payments.vpos.create({
      cardNumber: '4111111111111111',
      cvv: '123',
      expirationMonth: 12,
      expirationYear: 2030,
      cardHolderId: 'V12345678',
      cardHolderName: 'Maria Perez',
      accountType: 0,
      cardType: 1,
      vesAmount: 10000,
      externalRef: 'order-1042',
      splits: SPLITS,
    });
    expect(server.requests.at(-1)).toMatchObject({ method: 'POST', body: expect.objectContaining({ splits: SPLITS }) });
  });

  it('reads each share back on the payment', async () => {
    const payment = await vexpay.payments.retrieve('p1');
    expect(payment.splits?.[0]).toMatchObject({ amountVes: '6000.00', feeVes: '180.00', netVes: '4620.00' });
  });

  it('reads and updates the marketplace settings', async () => {
    const read = await vexpay.merchants.marketplaceSettings.retrieve();
    expect(read).toEqual(SETTINGS);
    await vexpay.merchants.marketplaceSettings.update({ merchantAutoPayoutDefault: true, merchantAutoPayoutMinUsd: '10.00' });
    expect(server.requests.at(-1)).toMatchObject({
      method: 'PATCH',
      url: '/v1/marketplace/settings',
      body: { merchantAutoPayoutDefault: true, merchantAutoPayoutMinUsd: '10.00' },
    });
  });
});

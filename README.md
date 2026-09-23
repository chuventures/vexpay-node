# VEXPay Node.js SDK

The official Node.js / TypeScript library for the [VEXPay](https://vexwallet.co/vexpay) API: accept Venezuelan payments (Pago Móvil C2P, cards, débito inmediato), pay out to merchants, create checkout sessions, and verify signed webhooks.

- Fully typed from the VEXPay OpenAPI contract
- Safe retries: every `POST` carries an `Idempotency-Key`, so a retried charge never charges twice
- Auto-pagination with `for await`
- Webhook signature verification with replay protection
- Zero runtime dependencies, Node.js 20+, ESM and CommonJS

## Install

```sh
npm install @vexpay/node
```

## Quickstart

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!);

const quote = await vexpay.quotes.retrieve({ usdAmount: 25 });
console.log(`$25 = Bs ${quote.vesAmount} at BCV ${quote.bcvRate}`);
```

Keep your API key on the server. Use your test-mode key while you build; it runs against the sandbox provider.

## Collect a Pago Móvil C2P payment

C2P is two steps: create an intent (the payer's bank sends them a token by SMS), then charge with the token your customer types in.

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!);

const intent = await vexpay.payments.c2p.request({
  usdAmount: 25,
  debtorId: 'V12345678',
  debtorCellPhone: '584141234567',
  debtorBankCode: 102,
  externalRef: 'order-1042',
});

// …the customer reads the token from their bank SMS…
const token = '123456';

const payment = await vexpay.payments.c2p.execute({
  intentId: intent.intentId,
  usdAmount: 25,
  debtorId: 'V12345678',
  debtorCellPhone: '584141234567',
  debtorBankCode: 102,
  token,
});

console.log(payment.status); // "COMPLETED" or "PENDING" — confirm with the payment.* webhook
```

## Checkout sessions (hosted or embedded)

Let VEXPay collect the payment details. Redirect the buyer to `url`, or embed the checkout on your own site with [`@vexpay/js`](https://www.npmjs.com/package/@vexpay/js) and the one-time `clientSecret`.

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!);

const session = await vexpay.checkout.sessions.create({
  amountUsd: 25,
  reference: 'order-1042',
  description: 'Pedido #1042',
  allowedOrigins: ['https://shop.example'],
  successUrl: 'https://shop.example/gracias',
  metadata: { orderId: '1042' },
});

// Send session.clientSecret to the browser (never log or store it), or redirect:
console.log(session.url);

// Later — fulfil only after checking on the server:
const current = await vexpay.checkout.sessions.retrieve(session.id);
if (current.status === 'paid') {
  // ship order 1042
}
```

## Webhooks

VEXPay signs every delivery with a `VexPay-Signature` header. Verify it with the **raw** request body — parsing and re-serializing JSON changes the bytes and breaks the signature.

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!);

// Any Fetch-style handler (Next.js route handlers, Remix, Hono, Workers, …)
export async function POST(request: Request): Promise<Response> {
  const rawBody = await request.text();
  try {
    const event = vexpay.webhooks.constructEvent(
      rawBody,
      request.headers.get('vexpay-signature'),
      process.env.VEXPAY_WEBHOOK_SECRET!,
    );

    if (event.event === 'payment.completed') {
      const { paymentId, externalRef, checkoutSession } = event.data;
      console.log('paid', paymentId, externalRef ?? checkoutSession?.reference);
    }
    return new Response(null, { status: 204 });
  } catch {
    return new Response('invalid signature', { status: 400 });
  }
}
```

With Express, mount `express.raw({ type: 'application/json' })` on the webhook route and pass `req.body` (a Buffer) and `req.headers['vexpay-signature']`.

Deliveries older than 5 minutes are rejected as possible replays; pass `{ toleranceSeconds }` to change that. Each delivery also carries a `VexPay-Event-Id` header you can use to deduplicate. In your own tests, sign fixtures with `vexpay.webhooks.generateTestHeader({ payload, secret })`.

## Errors

Every error extends `VexPayError` and carries `status`, the API `code` (e.g. `insufficient_balance`), and the response `body`.

```ts
import VexPay, { VexPayConflictError, VexPayError, VexPayInvalidRequestError } from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!);

try {
  await vexpay.payouts.create({
    merchantId: '4f0c6f1e-2b7d-4c1a-9e3f-5a6b7c8d9e0f',
    monto: '1523.40',
    concepto: 'Liquidación semana 30',
    externalRef: 'po_2026_30_maria',
  });
} catch (error) {
  if (error instanceof VexPayInvalidRequestError && error.code === 'insufficient_balance') {
    // top up, then retry
  } else if (error instanceof VexPayConflictError) {
    console.error('externalRef reused with a different payload', error.body);
  } else if (error instanceof VexPayError) {
    console.error(error.status, error.code, error.message);
  } else {
    throw error;
  }
}
```

| Class | When |
|---|---|
| `VexPayAuthenticationError` | 401 — missing or invalid API key |
| `VexPayInvalidRequestError` | 400, 403, 410, 422 — fix the request |
| `VexPayNotFoundError` | 404 |
| `VexPayConflictError` | 409 — e.g. `external_ref_conflict`, `idempotency_key_reused` |
| `VexPayRateLimitError` | 429, after retries |
| `VexPayAPIError` | 5xx, after retries |
| `VexPayConnectionError` / `VexPayTimeoutError` | no HTTP answer, after retries |
| `VexPaySignatureVerificationError` | a webhook did not verify |

## Retries and idempotency

The SDK retries connection errors, timeouts, `429`, `5xx`, and `409 idempotency_request_in_progress` up to `maxNetworkRetries` times (default 2) with exponential backoff, honouring `Retry-After`. Every `POST` gets a random `Idempotency-Key` that stays the same across its retries, so VEXPay executes it at most once. Supply your own key to make retries safe across process restarts too:

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!, { maxNetworkRetries: 3, timeoutMs: 20_000 });

await vexpay.payments.c2p.execute(
  {
    intentId: '00000000-0000-4000-8000-000000000001',
    usdAmount: 25,
    debtorId: 'V12345678',
    debtorCellPhone: '584141234567',
    debtorBankCode: 102,
    token: '123456',
  },
  { idempotencyKey: 'order-1042-charge' },
);
```

## Pagination

`list()` methods on payouts, merchants, and products return the first page when awaited, and every item when iterated:

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!);

const firstPage = await vexpay.merchants.list({ limit: 100 });
console.log(firstPage.items.length, firstPage.nextCursor);

for await (const merchant of vexpay.merchants.list({ status: 'verified', isActive: 'true' })) {
  console.log(merchant.merchantId, merchant.name);
}

const recentPayouts = await vexpay.payouts.list({ limit: 50 }).autoPagingToArray({ limit: 200 });
console.log(recentPayouts.length);
```

## Configuration

```ts
import VexPay from '@vexpay/node';

const vexpay = new VexPay(process.env.VEXPAY_API_KEY!, {
  baseUrl: 'http://localhost:3010', // default: https://api.pay.vexwallet.co
  timeoutMs: 30_000,
  maxNetworkRetries: 2,
});

console.log(await vexpay.banks.list());
```

## TypeScript

Every request and response type is generated from the API contract:

```ts
import type { RequestBody, ResponseBody, Schemas } from '@vexpay/node';

type Receipt = Schemas['PaymentReceiptDto'];
type NewPayout = RequestBody<'Payouts_create'>;
type Session = ResponseBody<'CheckoutSessions_retrieve'>;

const describe = (receipt: Receipt) => `${receipt.paymentId}: ${receipt.status}`;
console.log(describe, {} as NewPayout, {} as Session);
```

## Resources

| Namespace | Methods |
|---|---|
| `banks` | `list` |
| `quotes` | `retrieve` |
| `balance` | `retrieve` |
| `payments` | `retrieve`, `retrieveByRef`, `reverse` |
| `payments.c2p` | `request`, `execute` |
| `payments.vpos` | `create` |
| `payments.pagoMovil` | `verify` |
| `payments.debit` · `credit` · `operations` · `dispersals` · `change` | débito/crédito inmediato and disbursements (R4) |
| `checkout.sessions` | `create`, `retrieve` |
| `merchants` | `create`, `list`, `retrieve`, `retrieveByRef`, `update`, `delete`, `retrieveBalance`, `transfer`, `listAuditEvents`, `startVerification`, `confirmVerification` |
| `merchants.payoutMethods` | `list`, `create`, `setDefault`, `delete`, `startVerification`, `confirmVerification` |
| `payouts` | `create`, `createInstant`, `createBatch`, `list`, `retrieve`, `retrieveByRef` |
| `products` | `create`, `list`, `retrieve`, `update`, `delete`, `createLink`, `listLinks` |
| `paymentLinks` | `retrieve`, `update`, `delete` |
| `tenantPayoutAccount` | `retrieve`, `upsert`, `create`, `startVerification`, `confirmVerification` |
| `webhookEndpoints` | `create`, `list`, `update`, `delete`, `sendTest` |
| `webhooks` | `constructEvent`, `generateTestHeader` (offline) |

Full API reference: [docs](https://pay.vexwallet.co/docs) · OpenAPI: `/openapi.json`.

## License

MIT

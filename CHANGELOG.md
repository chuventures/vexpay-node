# @vexpay/node

## 0.6.0

### Minor Changes

- Add `cop` — Colombian pesos through Bre-B, Nequi and Daviplata: `cop.payments.create()`, `retrieve()`, `submitOtp()`, `cancel()`, `refund()` and `cop.balance.retrieve()`. COP must be enabled on your account. New `CopPaymentWebhookData` type for `payment.*` events with `method: "COP"` (now part of the `method` union).

## 0.5.0

### Minor Changes

- ca0b969: Checkout sessions accept `"methods": ["cop"]` — Colombian pesos through Bre-B, Nequi and Daviplata on the hosted checkout, priced from `amountUsd` at VEX Pay's USDT/COP rate. `cop` is offered by default when COP is enabled on your account. COP payment reads and `payment.*` webhooks for checkout payments add `amountUsd` and `copRate`.

## 0.4.0

### Minor Changes

- 980fe3b: Add `balance.transactions.list()` — every movement in your VES balance (payments, fees, payouts, reversals, card chargebacks, adjustments, seller transfers, conversions), newest first and auto-paginating. The amounts sum to `ledgerNetVes` from `balance.retrieve()`, so your ledger can reconcile automatically. New webhook events `payment.chargeback` and `payment.chargeback_closed` report bank chargebacks on card payments (with `ledgerEntryIds` matching `balance.transactions`); `payment.reversed` adds `reversalType` (`reversal` | `chargeback`), and the balance adds `chargebackFeesVes`.

## 0.3.0

### Minor Changes

- 24c3d62: Add USDC (Polygon and Base) to `crypto`: `crypto.balance.retrieve()`, `crypto.depositAddresses.create()`, `crypto.networks.list()` and `crypto.payouts.create()` accept `currency: 'USDT' | 'USDC'` (default USDT, so existing calls are unchanged). New `crypto.balances.list()` returns every stablecoin balance. Payouts take `amount` (`amountUsdt` stays as a USDT-only alias), and crypto responses and `payment.completed` / `payout.*` events add `currency`, `amount` and `fee` for both coins. Checkout sessions accept `methods: ['usdc']`.
- 6bf806e: Add `conversions` to turn available VES into your USDT balance: `conversions.quotes.create()` locks a rate for 60 seconds (`sourceAmountVes` or `targetAmountUsdt`), `conversions.create({ quoteId })` debits the VES and returns a `PENDING` conversion, plus `conversions.retrieve()`, `conversions.list()` (auto-paginating) and `conversions.cancel()`. New webhook events `conversion.completed` and `conversion.canceled`; the VES balance adds `convertedVes`. Conversions are enabled per account (403 `conversions_not_enabled` otherwise).

## 0.2.1

### Patch Changes

- 176335f: `merchants.update()` accepts `applicationFeePercent` to set a merchant's negotiated marketplace commission (`null` returns the merchant to the tenant's default commission), and merchant responses include it. Charges that pass `merchantId` without `applicationFeeVes` / `applicationFeePercent` now apply that commission.

## 0.2.0

### Minor Changes

- Add `crypto` for USDT: `crypto.balance.retrieve()`, `crypto.depositAddresses.create()`, `crypto.networks.list()`, `crypto.payouts.create()` / `retrieve()`. USDT settles in USDT in its own balance; the calls answer 403 `method_not_allowed` when USDT isn't enabled on the account.
- Checkout sessions accept `methods: ['usdt']`; USDT `payment.completed` events add `amountUsdt`, `feeUsdt`, `network`, `txHashes`, `customerRef`, `underpaid` and `checkoutSession`.

## 0.1.1

### Patch Changes

- 06ca63c: Add `payments.pagoMovil.receivingAccount()` for `GET /v1/payments/pago-movil/receiving-account`: the Pago Móvil account your customers pay into (bank, phone, identification), resolved with the same routing as `verify`, plus `configured` / `missing`.

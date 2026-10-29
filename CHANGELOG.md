# @vexpay/node

## 0.14.0

### Minor Changes

- Test mode: `crypto.simulateDeposit({ customerRef, network, currency?, amount })` makes a deposit arrive at one of your stablecoin deposit addresses: the same payment, fee, balance hold and `payment.completed` webhook (with `customerRef` and `livemode: false`) as a real deposit. A Live key gets 403 `test_mode_only`; an address you have not requested gets 404 `not_found`.

## 0.13.0

### Minor Changes

- COP: new channels `pse`, `bancolombia_transfer` and `bancolombia_qr` (and `card`, taken only on the hosted checkout). `cop.channels()` lists the channels your account can use now, the PSE banks and the terms links. `cop.payments.create` takes `pse.bankCode`, `buyer.firstName`/`lastName`/`personType` and `buyer.termsAccepted`; `next` adds `redirect` (with `url`), `redirect_pending`, `processing` and `show_qr.qrSvgBase64`. Card payments carry `card: { brand, last4 }`; a card dispute sends `payment.reversed` with `reason: "chargeback"`. Refunds of channels without API refunds fail with `refund_not_supported`.
- Disbursements: `merchants.transfer(id, { amountUsd | amountVes, transferKey })` credits a seller from your balance (USD converted at the official BCV rate; `transfer` in the response carries the amounts and rate). `merchants.listTransactions(id)` lists the seller's balance movements (auto-paginates) and `merchants.retrieveStatement(id, { month })` / `retrieveStatementCsv` return the monthly statement. Payout webhooks report `feePaidByTenant` and `feeVes` when your balance pays a disbursement's withdrawal fee.
- Balance top-ups: `balance.topups.create / list / retrieve / instant / simulate` load your own Bs balance by Pago Móvil (money that is not a sale). `instant` makes a held top-up available now for its instant fee; `simulate` completes a top-up in test mode. Enabled per account by VEX Pay (`topups_not_enabled`); over the monthly limit fails with `topup_cap_exceeded`. Balance transactions add the types `topup`, `topup_fee`, `topup_instant_release` and `topup_instant_fee`.

## 0.12.0

### Minor Changes

- Billing: `customers` (`create`, `list`, `retrieve`, `update`, `delete`, `paymentMethods.list`), `prices` (`create`, `list`, `retrieve`, `update`), `subscriptions` (`create`, `list`, `retrieve`, `update`, `cancel`), `invoices` (`list`, `retrieve`, `void`, `markUncollectible`, `pay`), `setupSessions` (`create`, `retrieve`) and `paymentMethods` (`retrieve`, `detach`). Lists auto-paginate. Subscriptions bill a customer on a recurring USD price by hosted invoice (`send_invoice`) or domiciliación (`charge_automatically`).

## 0.11.0

### Minor Changes

- Checkout sessions can split the payment with one of your merchants: `merchantId` (UUID or `mrc_` id) and optional `applicationFeePercent` (0–100) on create, echoed on create and retrieve. Sessions with a merchant offer bolívar methods only (`c2p`, `pago_movil`, `vpos`); when the payment completes your commission stays with you and the seller's net goes to the merchant's balance. Sessions may also be refused with `invalid_data` for a method you turned off in Portal → Payment methods.

## 0.10.0

### Minor Changes

- Balances are held 24h before payouts can spend them (tenant balance hold). Balance reads add `heldVes`/`held`/`heldCop` and `nextReleaseAt`; `GET /v1/balance` adds `balanceHoldHours`; balance movements carry `availableAt` while held. Payout `insufficient_balance` errors include the held amount and `nextReleaseAt`. Onward payouts add the `waiting_release` status with `sendAfter` (converted, waiting for the hold to end before sending). All new fields are optional.

## 0.9.0

### Minor Changes

- Pay in bolívars, receive USDT: `payments.pagoMovil.verify()`, `payments.c2p.request()` and `payments.c2p.execute()` accept `onwardPayout: { network, address, tag? }`. Once the payment completes, its net VES is converted to USDT and sent to that wallet. Payment reads and `payment.*` webhooks carry `onwardPayout` (`status`: `pending` | `converting` | `sending` | `completed` | `held` | `failed` | `canceled`, plus `conversionId`, `payoutId`, `amountUsdt`, `feeUsdt`, `txHash`, `reason`). New webhook event `onward_payout.updated`.
- Quotes and payment receipts add `rate` and `rateSource` (`BCV` | `MARKET`): the Bolívar rate the amount was priced at, per your account's rate setting.
- VPOS payments accept an optional `beneficiary` (who the funds are for when it is not a merchant; shown to ops only).

## 0.8.0

### Minor Changes

- Add `payments.methods()` — the bolívar methods your account can take now (`pago_movil`, `c2p`, `vpos`), with a `reason` when unavailable.
- C2P accepts `vesAmount` on `payments.c2p.request()` and `execute()`: it locks the exact bolívars debited (USD derived at BCV); `usdAmount` is now optional. Executing an intent charges the bolívar amount stored on the intent; amounts sent on execute must match it.
- Checkout sessions accept `"methods": ["pago_movil"]` (Pago Móvil the buyer sends from their bank app).

## 0.7.0

### Minor Changes

- Conversions accept Colombian pesos: `conversions.quotes.create({ sourceCurrency: 'COP', sourceAmount: '1000000' })` (or `targetAmountUsdt`) converts COP to USDT at the market rate plus your COP spread. Quotes and conversions add `sourceCurrency`, `sourceAmount`, `origin` (`api` | `auto`) and `paymentId`; `sourceAmountVes` is `null` on COP conversions. `conversions.list()` filters by `sourceCurrency`.
- Add `conversions.settings.retrieve()` / `update()` — read your spreads, minimum and caps, and turn on auto-convert (`autoConvert.COP.percent`, a share of each completed COP payment converted to USDT).
- New webhook event `conversion.created`.

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

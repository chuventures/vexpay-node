# @vexpay/node

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

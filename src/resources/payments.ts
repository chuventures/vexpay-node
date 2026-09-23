import type { RequestOptions } from '../core';
import { APIResource } from '../resource';
import type { RequestBody } from '../types';

/** Pago Móvil C2P: request the bank OTP, then charge with the customer's token. */
export class C2p extends APIResource {
  /** Create a C2P intent; the payer's bank sends them a token (R4 also triggers the SMS). */
  request(params: RequestBody<'Payments_requestC2p'>, options?: RequestOptions) {
    return this.call('Payments_requestC2p', { body: params }, options);
  }

  /** Charge with the bank-issued token. Pass `intentId` from `request()`. */
  execute(params: RequestBody<'Payments_executeC2p'>, options?: RequestOptions) {
    return this.call('Payments_executeC2p', { body: params }, options);
  }
}

/** Card payments (VPOS). Prefer the hosted/embedded checkout so card data never touches your servers. */
export class Vpos extends APIResource {
  create(params: RequestBody<'Payments_executeVpos'>, options?: RequestOptions) {
    return this.call('Payments_executeVpos', { body: params }, options);
  }
}

/** Confirm a Pago Móvil the customer already sent to you. */
export class PagoMovil extends APIResource {
  /**
   * The account your customers must send the Pago Móvil to (bank, phone, identification).
   * Don't offer Pago Móvil while `configured` is false.
   */
  receivingAccount(options?: RequestOptions) {
    return this.call('Payments_getPagoMovilReceivingAccount', {}, options);
  }

  verify(params: RequestBody<'Payments_verifyPagoMovil'>, options?: RequestOptions) {
    return this.call('Payments_verifyPagoMovil', { body: params }, options);
  }
}

/** Débito inmediato (requires R4). */
export class Debit extends APIResource {
  requestOtp(params: RequestBody<'R4Operations_generarOtp'>, options?: RequestOptions) {
    return this.call('R4Operations_generarOtp', { body: params }, options);
  }

  execute(params: RequestBody<'R4Operations_debitoInmediato'>, options?: RequestOptions) {
    return this.call('R4Operations_debitoInmediato', { body: params }, options);
  }
}

/** Crédito inmediato and disbursements (requires R4). */
export class Credit extends APIResource {
  /** Instant credit to a Pago Móvil phone. */
  create(params: RequestBody<'R4Operations_creditoInmediato'>, options?: RequestOptions) {
    return this.call('R4Operations_creditoInmediato', { body: params }, options);
  }

  /** Instant credit to a bank account. */
  toAccount(params: RequestBody<'R4Operations_creditoCuentas'>, options?: RequestOptions) {
    return this.call('R4Operations_creditoCuentas', { body: params }, options);
  }

  /** Disburse one credit across several recipients. */
  disburse(params: RequestBody<'R4Operations_dispersarCredito'>, options?: RequestOptions) {
    return this.call('R4Operations_dispersarCredito', { body: params }, options);
  }
}

/** Bank operation status for débito/crédito (requires R4). */
export class Operations extends APIResource {
  retrieve(id: string, options?: RequestOptions) {
    return this.call('R4Operations_consultarOperacion', { path: { id } }, options);
  }

  /** Re-check a pending operation with the bank now. */
  poll(params: RequestBody<'R4Operations_pollOperation'>, options?: RequestOptions) {
    return this.call('R4Operations_pollOperation', { body: params }, options);
  }
}

/** Account payout dispersion (requires R4). */
export class Dispersals extends APIResource {
  create(params: RequestBody<'R4Operations_dispersarPagos'>, options?: RequestOptions) {
    return this.call('R4Operations_dispersarPagos', { body: params }, options);
  }
}

/** Vuelto / change payments (requires R4). */
export class Change extends APIResource {
  create(params: RequestBody<'R4Operations_ejecutarVuelto'>, options?: RequestOptions) {
    return this.call('R4Operations_ejecutarVuelto', { body: params }, options);
  }
}

export class Payments extends APIResource {
  readonly c2p = new C2p(this.http);
  readonly vpos = new Vpos(this.http);
  readonly pagoMovil = new PagoMovil(this.http);
  readonly debit = new Debit(this.http);
  readonly credit = new Credit(this.http);
  readonly operations = new Operations(this.http);
  readonly dispersals = new Dispersals(this.http);
  readonly change = new Change(this.http);

  retrieve(id: string, options?: RequestOptions) {
    return this.call('Payments_getPayment', { path: { id } }, options);
  }

  /** Look up a payment by the `externalRef` you sent. */
  retrieveByRef(externalRef: string, options?: RequestOptions) {
    return this.call('Payments_getPaymentByRef', { path: { externalRef } }, options);
  }

  /** Reverse a completed C2P payment. */
  reverse(id: string, options?: RequestOptions) {
    return this.call('Payments_reversePayment', { path: { id } }, options);
  }
}

import { createHmac, timingSafeEqual } from 'node:crypto';
import { VexPaySignatureVerificationError } from './errors';

export const WEBHOOK_EVENT_NAMES = [
  'payment.pending',
  'payment.completed',
  'payment.failed',
  'payment.canceled',
  'payment.reversed',
  'merchant.verified',
  'merchant.rejected',
  'merchant.deactivated',
  'merchant.reactivated',
  'merchant.balance.updated',
  'merchant.created',
  'merchant.activated',
  'merchant.updated',
  'merchant.kyb_required',
  'merchant.restricted',
  'merchant.capability.updated',
  'merchant.wallet_credit',
  'payout.completed',
  'payout.failed',
  'tenant.status_changed',
  'tenant.api_key.created',
  'tenant.api_key.rotated',
  'tenant.api_key.revoked',
  'notification.test',
] as const;

export type WebhookEventName = (typeof WEBHOOK_EVENT_NAMES)[number];

/** `data` of every `payment.*` event. */
export interface PaymentWebhookData {
  paymentId: string;
  externalRef?: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELED' | 'REVERSED';
  method: 'C2P' | 'VPOS' | 'PAGO_MOVIL' | 'DEBITO_INMEDIATO';
  usdAmount: number;
  vesAmount: number;
  bcvRate: number;
  feeUsd?: number;
  feeVes?: number;
  netVes?: number;
  bankReference?: string;
  bankTxId?: number;
  debtorId?: string;
  debtorPhone?: string;
  debtorBankCode?: number;
  debtorBankName?: string;
  cardLast4?: string;
  cardBrand?: string;
  cardProduct?: string;
  accountTypeLabel?: string;
  tenantName: string;
  createdAt: string;
  failureCode?: string;
  cancelReason?: 'superseded' | 'expired';
  reversedAt?: string;
  reversalRef?: string;
  reversalTxId?: number;
  livemode: boolean;
  /** Present when the payment came from a checkout session. */
  checkoutSession?: { id: string; reference: string | null; metadata: Record<string, string> };
}

type PaymentEventName = Extract<WebhookEventName, `payment.${string}`>;

/** A verified webhook delivery, discriminated by `event`. */
export type WebhookEvent =
  | { event: PaymentEventName; data: PaymentWebhookData; timestamp: string }
  | {
      event: Exclude<WebhookEventName, PaymentEventName>;
      data: Record<string, unknown> & { livemode: boolean };
      timestamp: string;
    };

export const SIGNATURE_HEADER = 'VexPay-Signature';
export const DEFAULT_TOLERANCE_SECONDS = 300;

const RAW_BODY_HINT =
  'Pass the raw request body exactly as received (string or Buffer). Parsing and re-serializing JSON — e.g. JSON.stringify(req.body) — changes the bytes and breaks the signature. In Express use express.raw({ type: "application/json" }) on the webhook route.';

function sign(secret: string, timestamp: number | string, payload: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${payload}`, 'utf8').digest('hex');
}

function parseHeader(header: string): { timestamp: number; signatures: string[] } | null {
  let timestamp: string | undefined;
  const signatures: string[] = [];
  for (const part of header.split(',')) {
    const index = part.indexOf('=');
    if (index <= 0) return null;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key === 't') timestamp = value;
    else if (key === 'v1') signatures.push(value);
    // Unknown schemes (v0, future v2…) are ignored.
  }
  if (!timestamp || !/^\d+$/.test(timestamp)) return null;
  return { timestamp: Number(timestamp), signatures };
}

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(actual, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export class Webhooks {
  /**
   * Verifies a delivery's `VexPay-Signature` header and returns the parsed event.
   * Throws VexPaySignatureVerificationError on a bad signature or a stale timestamp.
   */
  constructEvent(
    rawBody: string | Buffer | Uint8Array,
    signatureHeader: string | string[] | null | undefined,
    secret: string,
    options: { toleranceSeconds?: number; now?: number } = {},
  ): WebhookEvent {
    if (typeof rawBody !== 'string' && !(rawBody instanceof Uint8Array)) {
      throw new VexPaySignatureVerificationError(`Webhook payload must be the raw body. ${RAW_BODY_HINT}`);
    }
    if (!secret) {
      throw new VexPaySignatureVerificationError('A webhook signing secret is required.');
    }
    const payload = typeof rawBody === 'string' ? rawBody : Buffer.from(rawBody).toString('utf8');
    const header = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const parsed = header ? parseHeader(header) : null;
    if (!parsed) {
      throw new VexPaySignatureVerificationError(
        `Unable to parse the ${SIGNATURE_HEADER} header. Expected "t=<timestamp>,v1=<signature>".`,
      );
    }
    if (parsed.signatures.length === 0) {
      throw new VexPaySignatureVerificationError(`No v1 signatures found in the ${SIGNATURE_HEADER} header.`);
    }

    const tolerance = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
    const now = options.now ?? Math.floor(Date.now() / 1000);
    if (tolerance > 0 && Math.abs(now - parsed.timestamp) > tolerance) {
      throw new VexPaySignatureVerificationError(
        `Webhook timestamp is outside the ${tolerance}s tolerance — possible replay. Check your server clock if this repeats.`,
      );
    }

    const expected = sign(secret, parsed.timestamp, payload);
    if (!parsed.signatures.some((candidate) => safeEqualHex(expected, candidate))) {
      throw new VexPaySignatureVerificationError(
        `No signature matches the expected signature for this payload. Check the endpoint secret. ${RAW_BODY_HINT}`,
      );
    }

    try {
      return JSON.parse(payload) as WebhookEvent;
    } catch {
      throw new VexPaySignatureVerificationError('Webhook payload is not valid JSON.');
    }
  }

  /** Builds a valid `VexPay-Signature` value — for your own tests. */
  generateTestHeader({
    payload,
    secret,
    timestamp = Math.floor(Date.now() / 1000),
  }: {
    payload: string;
    secret: string;
    timestamp?: number;
  }): string {
    return `t=${timestamp},v1=${sign(secret, timestamp, payload)}`;
  }
}

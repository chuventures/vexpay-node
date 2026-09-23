import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, expectTypeOf, it } from 'vitest';
import { VexPay, VexPaySignatureVerificationError, WEBHOOK_EVENT_NAMES } from '../src/index';

type Vector = { name: string; body: string; header: string | null; valid: boolean; reason?: string };
const vectors = JSON.parse(
  readFileSync(resolve(__dirname, '../../sdk-spec/fixtures/webhook-signatures.json'), 'utf8'),
) as { secret: string; now: number; toleranceSeconds: number; cases: Vector[] };

const { webhooks } = new VexPay('sk_test_webhooks');
const verify = (vector: Vector) =>
  webhooks.constructEvent(vector.body, vector.header, vectors.secret, {
    now: vectors.now,
    toleranceSeconds: vectors.toleranceSeconds,
  });

describe('webhooks.constructEvent — shared conformance vectors', () => {
  it('loads the vector set', () => {
    expect(vectors.cases.length).toBeGreaterThanOrEqual(15);
  });

  for (const vector of vectors.cases) {
    it(`${vector.valid ? 'accepts' : 'rejects'}: ${vector.name}`, () => {
      if (vector.valid) {
        expect(verify(vector)).toMatchObject({ event: 'payment.completed' });
      } else {
        expect(() => verify(vector)).toThrow(VexPaySignatureVerificationError);
      }
    });
  }
});

describe('webhooks.constructEvent', () => {
  const valid = vectors.cases.find((v) => v.name === 'valid')!;

  it('accepts a Buffer body and returns a typed event', () => {
    const event = webhooks.constructEvent(Buffer.from(valid.body), valid.header, vectors.secret, {
      now: vectors.now,
    });
    expect(event.event).toBe('payment.completed');
    if (event.event === 'payment.completed') {
      expectTypeOf(event.data.paymentId).toEqualTypeOf<string>();
      expect(event.data.status).toBe('COMPLETED');
    }
  });

  it('explains that the raw body is required when the signature does not match', () => {
    const reserialized = vectors.cases.find((v) => v.name === 're-serialized body (key order changed)')!;
    expect(() => verify(reserialized)).toThrow(/raw request body/);
  });

  it('refuses an already-parsed object with the same hint', () => {
    expect(() =>
      webhooks.constructEvent(JSON.parse(valid.body) as never, valid.header, vectors.secret, { now: vectors.now }),
    ).toThrow(/raw body/);
  });

  it('mentions the tolerance for stale deliveries', () => {
    const stale = vectors.cases.find((v) => v.name === 'stale timestamp')!;
    expect(() => verify(stale)).toThrow(/outside the 300s tolerance/);
  });

  it('accepts a custom tolerance', () => {
    const stale = vectors.cases.find((v) => v.name === 'stale timestamp')!;
    expect(() =>
      webhooks.constructEvent(stale.body, stale.header, vectors.secret, { now: vectors.now, toleranceSeconds: 900 }),
    ).not.toThrow();
  });

  it('defaults to a 300s tolerance against the real clock', () => {
    const payload = JSON.stringify({ event: 'notification.test', data: { livemode: false }, timestamp: 'x' });
    const fresh = webhooks.generateTestHeader({ payload, secret: 's' });
    const old = webhooks.generateTestHeader({ payload, secret: 's', timestamp: Math.floor(Date.now() / 1000) - 600 });
    expect(webhooks.constructEvent(payload, fresh, 's').event).toBe('notification.test');
    expect(() => webhooks.constructEvent(payload, old, 's')).toThrow(VexPaySignatureVerificationError);
  });

  it('round-trips generateTestHeader', () => {
    const payload = '{"event":"payout.completed","data":{"livemode":true},"timestamp":"t"}';
    const header = webhooks.generateTestHeader({ payload, secret: 'whsec', timestamp: 1_790_000_000 });
    expect(header).toMatch(/^t=1790000000,v1=[0-9a-f]{64}$/);
    expect(webhooks.constructEvent(payload, header, 'whsec', { now: 1_790_000_000 }).event).toBe('payout.completed');
  });
});

describe('webhook event names', () => {
  it('match the API event list (packages/sdk-spec/fixtures/webhook-events.json)', () => {
    const { events } = JSON.parse(
      readFileSync(resolve(__dirname, '../../sdk-spec/fixtures/webhook-events.json'), 'utf8'),
    ) as { events: string[] };
    expect([...WEBHOOK_EVENT_NAMES]).toEqual(events);
  });
});

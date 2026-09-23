import { afterEach, describe, expect, it } from 'vitest';
import {
  VexPay,
  VexPayAPIError,
  VexPayAuthenticationError,
  VexPayConfigurationError,
  VexPayConflictError,
  VexPayConnectionError,
  VexPayError,
  VexPayInvalidRequestError,
  VexPayNotFoundError,
  VexPayRateLimitError,
  VexPayTimeoutError,
  VERSION,
} from '../src/index';
import { backoffDelay, HttpClient, parseRetryAfter } from '../src/core';
import { mockServer, type ScriptedResponse } from './mock-server';

type Server = Awaited<ReturnType<typeof mockServer>>;
let server: Server | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Client with recorded (not real) retry sleeps. */
async function setup(script: ScriptedResponse[], opts: { maxNetworkRetries?: number; timeoutMs?: number } = {}) {
  server = await mockServer(script);
  const sleeps: number[] = [];
  const http = new HttpClient({
    apiKey: 'sk_test_123',
    baseUrl: server.url,
    timeoutMs: opts.timeoutMs ?? 5_000,
    maxNetworkRetries: opts.maxNetworkRetries ?? 2,
    fetch: globalThis.fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { http, sleeps, server };
}

describe('client configuration', () => {
  it('refuses to construct without an API key, before any network call', () => {
    expect(() => new VexPay('')).toThrow(VexPayConfigurationError);
    expect(() => new VexPay('   ')).toThrow(/API key is required/);
  });

  it('sends requests to a custom baseUrl', async () => {
    server = await mockServer([{ status: 200, body: [] }]);
    const vexpay = new VexPay('sk_test_123', { baseUrl: server.url });
    await vexpay.http.request('GET', '/v1/banks');
    expect(server.requests[0]?.url).toBe('/v1/banks');
  });
});

describe('request core', () => {
  it('sends x-api-key, a versioned User-Agent, and JSON bodies', async () => {
    const { http, server } = await setup([{ status: 201, body: { ok: true } }]);
    const result = await http.request('POST', '/v1/quote', { body: { usdAmount: 10 } });

    expect(result).toEqual({ ok: true });
    const req = server.requests[0]!;
    expect(req.headers['x-api-key']).toBe('sk_test_123');
    expect(req.headers['user-agent']).toMatch(new RegExp(`^vexpay-node/${VERSION.replace(/\./g, '\\.')} node/v`));
    expect(req.headers['content-type']).toBe('application/json');
    expect(req.body).toEqual({ usdAmount: 10 });
  });

  it('serializes query params and skips undefined ones', async () => {
    const { http, server } = await setup([{ status: 200, body: {} }]);
    await http.request('GET', '/v1/merchants', { query: { limit: 25, cursor: undefined, isActive: true } });
    expect(server.requests[0]?.url).toBe('/v1/merchants?limit=25&isActive=true');
  });

  it('returns undefined for empty 2xx bodies', async () => {
    const { http } = await setup([{ status: 204 }]);
    await expect(http.request('DELETE', '/v1/webhooks/x')).resolves.toBeUndefined();
  });
});

describe('error mapping', () => {
  it.each([
    [400, { statusCode: 400, message: ['usdAmount must be positive'], error: 'Bad Request' }, VexPayInvalidRequestError, undefined, 'usdAmount must be positive'],
    [401, { statusCode: 401, message: 'Invalid or inactive API key', error: 'Unauthorized' }, VexPayAuthenticationError, undefined, 'Invalid or inactive API key'],
    [403, { message: 'Forbidden' }, VexPayInvalidRequestError, undefined, 'Forbidden'],
    [404, { error: 'not_found' }, VexPayNotFoundError, 'not_found', 'not_found'],
    [409, { error: 'external_ref_conflict', message: 'externalRef reused' }, VexPayConflictError, 'external_ref_conflict', 'externalRef reused'],
    [422, { error: 'insufficient_balance' }, VexPayInvalidRequestError, 'insufficient_balance', 'insufficient_balance'],
  ] as const)('HTTP %i → %s', async (status, body, ErrorClass, code, message) => {
    const { http, server } = await setup([{ status, body, headers: { 'x-request-id': 'req_42' } }]);
    const error = await http.request('POST', '/v1/payouts', { body: {} }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ErrorClass);
    expect(error).toBeInstanceOf(VexPayError);
    expect(error).toMatchObject({ status, code, body, requestId: 'req_42', message });
    expect(server.requests).toHaveLength(1); // non-retryable
  });

  it('surfaces 429 as VexPayRateLimitError once retries are exhausted', async () => {
    const { http, server } = await setup([{ status: 429, body: { message: 'slow down' } }], { maxNetworkRetries: 1 });
    await expect(http.request('GET', '/v1/banks')).rejects.toBeInstanceOf(VexPayRateLimitError);
    expect(server.requests).toHaveLength(2);
  });

  it('surfaces 5xx as VexPayAPIError once retries are exhausted', async () => {
    const { http, server } = await setup([{ status: 503, body: { message: 'bank down' } }]);
    const error = await http.request('GET', '/v1/banks').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VexPayAPIError);
    expect(error).toMatchObject({ status: 503, message: 'bank down' });
    expect(server.requests).toHaveLength(3); // 1 + 2 retries
  });

  it('maps an unreachable host to VexPayConnectionError after retrying', async () => {
    const sleeps: number[] = [];
    const http = new HttpClient({
      apiKey: 'k',
      baseUrl: 'http://127.0.0.1:1',
      timeoutMs: 2_000,
      maxNetworkRetries: 2,
      fetch: globalThis.fetch,
      sleep: async (ms) => void sleeps.push(ms),
    });
    const error = await http.request('GET', '/v1/banks').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VexPayConnectionError);
    expect(error).not.toBeInstanceOf(VexPayTimeoutError);
    expect(sleeps).toHaveLength(2);
  });

  it('maps a slow answer to VexPayTimeoutError', async () => {
    const { http } = await setup([{ status: 200, body: {}, delayMs: 500 }], { timeoutMs: 50, maxNetworkRetries: 0 });
    const error = await http.request('GET', '/v1/banks').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VexPayTimeoutError);
    expect(error).toBeInstanceOf(VexPayConnectionError);
  });
});

describe('idempotency and retries', () => {
  it('sends one auto-generated Idempotency-Key on every attempt of a POST', async () => {
    const { http, server } = await setup([{ status: 503 }, { status: 502 }, { status: 201, body: { paymentId: 'p1' } }]);
    await expect(http.request('POST', '/v1/payments/c2p', { body: { token: '123456' } })).resolves.toEqual({ paymentId: 'p1' });

    const keys = server.requests.map((r) => r.headers['idempotency-key']);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Set(keys).size).toBe(1);
  });

  it('uses a caller-supplied Idempotency-Key verbatim', async () => {
    const { http, server } = await setup([{ status: 201, body: {} }]);
    await http.request('POST', '/v1/payouts', { body: {} }, { idempotencyKey: 'order-1042-charge' });
    expect(server.requests[0]?.headers['idempotency-key']).toBe('order-1042-charge');
  });

  it('gives separate calls separate keys, and GETs none', async () => {
    const { http, server } = await setup([{ status: 201, body: {} }]);
    await http.request('POST', '/v1/payouts', { body: {} });
    await http.request('POST', '/v1/payouts', { body: {} });
    await http.request('GET', '/v1/payouts');
    const [a, b, get] = server.requests.map((r) => r.headers['idempotency-key']);
    expect(a).not.toBe(b);
    expect(get).toBeUndefined();
  });

  it('retries 409 idempotency_request_in_progress with the same key', async () => {
    const { http, server } = await setup([
      { status: 409, body: { error: 'idempotency_request_in_progress' } },
      { status: 201, body: { paymentId: 'p1' } },
    ]);
    await expect(http.request('POST', '/v1/payments/c2p', { body: {} })).resolves.toEqual({ paymentId: 'p1' });
    expect(server.requests).toHaveLength(2);
    expect(server.requests[0]?.headers['idempotency-key']).toBe(server.requests[1]?.headers['idempotency-key']);
  });

  it('does not retry other 409s', async () => {
    const { http, server } = await setup([{ status: 409, body: { error: 'idempotency_key_reused' } }]);
    await expect(http.request('POST', '/v1/payouts', { body: {} })).rejects.toMatchObject({ code: 'idempotency_key_reused' });
    expect(server.requests).toHaveLength(1);
  });

  it('honours Retry-After on 429', async () => {
    const { http, sleeps } = await setup([
      { status: 429, headers: { 'retry-after': '3' } },
      { status: 200, body: {} },
    ]);
    await http.request('GET', '/v1/banks');
    expect(sleeps).toEqual([3000]);
  });

  it('backs off exponentially with jitter when no Retry-After is sent', async () => {
    const { http, sleeps } = await setup([{ status: 500 }, { status: 500 }, { status: 200, body: {} }]);
    await http.request('GET', '/v1/banks');
    expect(sleeps).toHaveLength(2);
    expect(sleeps[0]).toBeGreaterThanOrEqual(250);
    expect(sleeps[0]).toBeLessThanOrEqual(500);
    expect(sleeps[1]).toBeGreaterThanOrEqual(500);
    expect(sleeps[1]).toBeLessThanOrEqual(1000);
  });

  it('respects maxNetworkRetries: 0', async () => {
    const { http, server } = await setup([{ status: 500 }], { maxNetworkRetries: 0 });
    await expect(http.request('GET', '/v1/banks')).rejects.toBeInstanceOf(VexPayAPIError);
    expect(server.requests).toHaveLength(1);
  });

  it('never retries 4xx validation errors', async () => {
    const { http, server } = await setup([{ status: 400, body: { message: 'bad' } }]);
    await expect(http.request('POST', '/v1/quote', { body: {} })).rejects.toBeInstanceOf(VexPayInvalidRequestError);
    expect(server.requests).toHaveLength(1);
  });
});

describe('retry helpers', () => {
  it('parses Retry-After seconds and HTTP dates, capped at 60s', () => {
    const now = Date.parse('2026-09-22T12:00:00Z');
    expect(parseRetryAfter('2', now)).toBe(2000);
    expect(parseRetryAfter('Tue, 22 Sep 2026 12:00:05 GMT', now)).toBe(5000);
    expect(parseRetryAfter('9999', now)).toBe(60_000);
    expect(parseRetryAfter('soon', now)).toBeUndefined();
    expect(parseRetryAfter(null, now)).toBeUndefined();
  });

  it('caps backoff at 8s', () => {
    expect(backoffDelay(10, () => 1)).toBe(8000);
    expect(backoffDelay(0, () => 0)).toBe(250);
  });
});

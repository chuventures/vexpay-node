/**
 * Shared conformance: error-mapping, pagination, and retry fixtures from
 * packages/sdk-spec/fixtures. Pass/fail must match the Python suite.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  VexPay,
  VexPayAPIError,
  VexPayAuthenticationError,
  VexPayConflictError,
  VexPayInvalidRequestError,
  VexPayNotFoundError,
  VexPayRateLimitError,
  VexPayError,
} from '../src/index';
import { HttpClient } from '../src/core';
import { mockServer, type RecordedRequest, type ScriptedResponse } from './mock-server';

const FIXTURES = resolve(__dirname, '../../sdk-spec/fixtures');

const ERROR_CLASS = {
  invalid_request: VexPayInvalidRequestError,
  authentication: VexPayAuthenticationError,
  not_found: VexPayNotFoundError,
  conflict: VexPayConflictError,
  rate_limit: VexPayRateLimitError,
  api: VexPayAPIError,
} as const;

type ErrorClassName = keyof typeof ERROR_CLASS;

function load<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(FIXTURES, name), 'utf8')) as T;
}

type Server = Awaited<ReturnType<typeof mockServer>>;
let server: Server | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

describe('conformance: error-mapping.json', () => {
  const fixture = load<{
    requestId: string;
    cases: Array<{
      name: string;
      status: number;
      body: unknown;
      errorClass: ErrorClassName;
      code: string | null;
      message: string;
      maxNetworkRetries?: number;
    }>;
  }>('error-mapping.json');

  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    server = await mockServer([
      { status: c.status, body: c.body, headers: { 'x-request-id': fixture.requestId } },
    ]);
    const http = new HttpClient({
      apiKey: 'sk_test',
      baseUrl: server.url,
      timeoutMs: 5_000,
      maxNetworkRetries: c.maxNetworkRetries ?? 2,
      fetch: globalThis.fetch,
      sleep: async () => {},
    });
    const error = await http.request('POST', '/v1/payouts', { body: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ERROR_CLASS[c.errorClass]);
    expect(error).toBeInstanceOf(VexPayError);
    expect(error).toMatchObject({
      status: c.status,
      code: c.code ?? undefined,
      body: c.body,
      requestId: fixture.requestId,
      message: c.message,
    });
    expect(server.requests).toHaveLength(1);
  });
});

describe('conformance: pagination.json', () => {
  const fixture = load<{
    cases: Array<{
      name: string;
      total: number;
      limit: number;
      startCursor: string | null;
      expect: { itemCount: number; firstId: string; lastId: string; paths: string[] };
    }>;
  }>('pagination.json');

  function paginated(total: number) {
    return (req: RecordedRequest) => {
      const url = new URL(req.url, 'http://x');
      const limit = Number(url.searchParams.get('limit') ?? 25);
      const start = Number(url.searchParams.get('cursor') ?? 0);
      const end = Math.min(start + limit, total);
      const items = Array.from({ length: end - start }, (_, i) => {
        const n = start + i;
        return {
          merchantId: `mrc_${n}`,
          accountId: `acct_${n}`,
          externalRef: `m-${n}`,
          status: 'verified',
          isActive: true,
          name: `Merchant ${n}`,
          identification: 'V12345678',
          createdAt: '2026-09-22T12:00:00.000Z',
        };
      });
      return { status: 200, body: { items, nextCursor: end < total ? String(end) : null } };
    };
  }

  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    server = await mockServer(paginated(c.total));
    const vexpay = new VexPay('sk_test', { baseUrl: server.url, maxNetworkRetries: 0 });
    const ids: string[] = [];
    const opts = { limit: c.limit, ...(c.startCursor ? { cursor: c.startCursor } : {}) };
    for await (const m of vexpay.merchants.list(opts)) ids.push(m.merchantId);

    expect(ids).toHaveLength(c.expect.itemCount);
    expect(ids[0]).toBe(c.expect.firstId);
    expect(ids[ids.length - 1]).toBe(c.expect.lastId);
    expect(server.requests.map((r) => r.url)).toEqual(c.expect.paths);
  });
});

describe('conformance: retries.json', () => {
  const fixture = load<{
    defaultMaxNetworkRetries: number;
    cases: Array<{
      name: string;
      method: 'GET' | 'POST';
      path: string;
      body?: unknown;
      idempotencyKey?: string;
      maxNetworkRetries?: number;
      responses: Array<{ status: number; body?: unknown; headers?: Record<string, string> }>;
      expect: {
        ok?: unknown;
        errorClass?: ErrorClassName;
        code?: string;
        requestCount: number;
        sameIdempotencyKey?: boolean;
        idempotencyKeyPresent?: boolean;
        idempotencyKey?: string;
        retryAfterSeconds?: number;
      };
    }>;
  }>('retries.json');

  it.each(fixture.cases.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    const script: ScriptedResponse[] = c.responses.map((r) => ({
      status: r.status,
      body: r.body,
      headers: r.headers,
    }));
    server = await mockServer(script);
    const sleeps: number[] = [];
    const http = new HttpClient({
      apiKey: 'sk_test',
      baseUrl: server.url,
      timeoutMs: 5_000,
      maxNetworkRetries: c.maxNetworkRetries ?? fixture.defaultMaxNetworkRetries,
      fetch: globalThis.fetch,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
    });

    const options = c.idempotencyKey ? { idempotencyKey: c.idempotencyKey } : undefined;
    const result = await http
      .request(c.method, c.path, c.body !== undefined ? { body: c.body } : undefined, options)
      .then((ok) => ({ ok }))
      .catch((error: unknown) => ({ error }));

    expect(server.requests).toHaveLength(c.expect.requestCount);

    if (c.expect.ok !== undefined) {
      expect(result).toEqual({ ok: c.expect.ok });
    }
    if (c.expect.errorClass) {
      expect((result as { error: unknown }).error).toBeInstanceOf(ERROR_CLASS[c.expect.errorClass]);
      if (c.expect.code) {
        expect((result as { error: VexPayError }).error).toMatchObject({ code: c.expect.code });
      }
    }

    const keys = server.requests.map((r) => r.headers['idempotency-key'] as string | undefined);
    if (c.expect.sameIdempotencyKey) {
      expect(new Set(keys).size).toBe(1);
      expect(keys[0]).toBeTruthy();
    }
    if (c.expect.idempotencyKeyPresent === true) {
      expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/i);
    }
    if (c.expect.idempotencyKeyPresent === false) {
      expect(keys[0]).toBeUndefined();
    }
    if (c.expect.idempotencyKey) {
      expect(keys[0]).toBe(c.expect.idempotencyKey);
    }
    if (c.expect.retryAfterSeconds !== undefined) {
      expect(sleeps).toEqual([c.expect.retryAfterSeconds * 1000]);
    }
  });
});

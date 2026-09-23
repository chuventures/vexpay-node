import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, expectTypeOf, it } from 'vitest';
import { VexPay, type Schemas } from '../src/index';
import { ROUTES, type OperationId } from '../src/generated/routes';
import { APIResource } from '../src/resource';
import { mockServer } from './mock-server';

const snapshot = JSON.parse(
  readFileSync(resolve(__dirname, '../../sdk-spec/openapi.json'), 'utf8'),
) as { paths: Record<string, Record<string, { operationId?: string }>> };

const snapshotOperations = new Set(
  Object.values(snapshot.paths).flatMap((item) =>
    Object.values(item).flatMap((op) => (op?.operationId ? [op.operationId] : [])),
  ),
);

/** Every public method on every resource, e.g. `payments.c2p.execute`. */
function resourceMethods(root: object, prefix = ''): Array<{ name: string; fn: (...args: unknown[]) => unknown }> {
  const found: Array<{ name: string; fn: (...args: unknown[]) => unknown }> = [];
  for (const [key, value] of Object.entries(root)) {
    if (!(value instanceof APIResource)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    const proto = Object.getPrototypeOf(value) as object;
    for (const method of Object.getOwnPropertyNames(proto)) {
      const fn = (value as unknown as Record<string, unknown>)[method];
      if (method === 'constructor' || typeof fn !== 'function') continue;
      found.push({ name: `${path}.${method}`, fn: (fn as (...args: unknown[]) => unknown).bind(value) });
    }
    found.push(...resourceMethods(value, path));
  }
  return found;
}

/** Most specific route (fewest path params) matching a recorded request. */
function operationFor(method: string, url: string): OperationId | undefined {
  const pathname = url.split('?')[0]!;
  const candidates = (Object.entries(ROUTES) as Array<[OperationId, { method: string; path: string }]>)
    .filter(([, route]) => route.method === method)
    .filter(([, route]) => new RegExp(`^${route.path.replace(/\{\w+\}/g, '[^/]+')}$`).test(pathname))
    .sort(([, a], [, b]) => (a.path.match(/\{/g)?.length ?? 0) - (b.path.match(/\{/g)?.length ?? 0));
  return candidates[0]?.[0];
}

describe('resource coverage', () => {
  let server: Awaited<ReturnType<typeof mockServer>>;
  let vexpay: VexPay;

  beforeAll(async () => {
    server = await mockServer([{ status: 200, body: {} }]);
    vexpay = new VexPay('sk_test_coverage', { baseUrl: server.url, maxNetworkRetries: 0 });
  });

  afterAll(() => server.close());

  it('the route table matches the SDK snapshot exactly', () => {
    expect(new Set(Object.keys(ROUTES))).toEqual(snapshotOperations);
  });

  it('every snapshot operation is reachable through a resource method', async () => {
    const hits = new Map<string, OperationId>();
    for (const { name, fn } of resourceMethods(vexpay)) {
      const before = server.requests.length;
      await fn('id_1', 'm_1', {}, {});
      expect(server.requests.length, `${name} should make exactly one request`).toBe(before + 1);
      const req = server.requests[before]!;
      const op = operationFor(req.method, req.url);
      expect(op, `${name} → ${req.method} ${req.url} matches no operation`).toBeDefined();
      hits.set(name, op!);
    }

    const covered = new Set(hits.values());
    const missing = [...snapshotOperations].filter((op) => !covered.has(op as OperationId));
    expect(missing, `operations without a resource method: ${missing.join(', ')}`).toEqual([]);
  });

  it('substitutes and encodes path parameters', async () => {
    await vexpay.merchants.payoutMethods.confirmVerification('mrc/1', 'pm 2', { amounts: ['0.11', '0.22'] } as never);
    expect(server.requests.at(-1)?.url).toBe('/v1/merchants/mrc%2F1/payout-methods/pm%202/verify');
  });

  it('rejects an empty path parameter before sending', async () => {
    const before = server.requests.length;
    await expect(vexpay.payments.retrieve('')).rejects.toThrow(/Missing required path parameter "id"/);
    expect(server.requests.length).toBe(before);
  });
});

describe('typed resources', () => {
  it('ties methods to the generated schemas', () => {
    const vexpay = new VexPay('sk_test_types');
    expectTypeOf(vexpay.payments.c2p.execute).parameter(0).toEqualTypeOf<Schemas['C2pPaymentDto']>();
    expectTypeOf(vexpay.payments.c2p.execute).returns.resolves.toEqualTypeOf<Schemas['PaymentReceiptDto']>();
    expectTypeOf(vexpay.payments.c2p.request).returns.resolves.toEqualTypeOf<Schemas['C2pIntentResponseDto']>();
    expectTypeOf(vexpay.checkout.sessions.create).returns.resolves.toEqualTypeOf<
      Schemas['CheckoutSessionResponseDto']
    >();
    expectTypeOf(vexpay.merchants.retrieveByRef).returns.resolves.toEqualTypeOf<Schemas['MerchantResponseDto']>();
    expectTypeOf(vexpay.payouts.retrieve).returns.resolves.toEqualTypeOf<Schemas['PayoutResponseDto']>();
    expectTypeOf(vexpay.products.delete).returns.resolves.toEqualTypeOf<void>();
  });
});

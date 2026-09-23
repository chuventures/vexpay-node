import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { VexPay, VexPayAPIError, type Schemas } from '../src/index';
import { mockServer, type RecordedRequest } from './mock-server';

type Server = Awaited<ReturnType<typeof mockServer>>;
let server: Server | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** Serves `total` merchants in pages of `?limit`, with numeric cursors. */
function paginated(total: number) {
  return (req: RecordedRequest) => {
    const url = new URL(req.url, 'http://x');
    const limit = Number(url.searchParams.get('limit') ?? 25);
    const start = Number(url.searchParams.get('cursor') ?? 0);
    const end = Math.min(start + limit, total);
    const items = Array.from({ length: end - start }, (_, i) => ({ merchantId: `mrc_${start + i}` }));
    return { status: 200, body: { items, nextCursor: end < total ? String(end) : null } };
  };
}

async function client(handler: Parameters<typeof mockServer>[0]) {
  server = await mockServer(handler);
  return new VexPay('sk_test_pages', { baseUrl: server.url, maxNetworkRetries: 0 });
}

describe('auto-pagination', () => {
  it('iterates 250 merchants across 3 requests with limit 100', async () => {
    const vexpay = await client(paginated(250));
    const ids: string[] = [];
    for await (const merchant of vexpay.merchants.list({ limit: 100 })) ids.push(merchant.merchantId);

    expect(ids).toHaveLength(250);
    expect(ids[0]).toBe('mrc_0');
    expect(ids[249]).toBe('mrc_249');
    expect(new Set(ids).size).toBe(250);
    expect(server!.requests.map((r) => r.url)).toEqual([
      '/v1/merchants?limit=100',
      '/v1/merchants?limit=100&cursor=100',
      '/v1/merchants?limit=100&cursor=200',
    ]);
  });

  it('awaiting list() returns only the first page', async () => {
    const vexpay = await client(paginated(250));
    const page = await vexpay.merchants.list({ limit: 100 });

    expect(page.items).toHaveLength(100);
    expect(page.nextCursor).toBe('100');
    expect(server!.requests).toHaveLength(1);
  });

  it('starts from a caller-supplied cursor', async () => {
    const vexpay = await client(paginated(250));
    const rest = await vexpay.merchants.list({ limit: 100, cursor: '200' }).autoPagingToArray();
    expect(rest).toHaveLength(50);
    expect(server!.requests).toHaveLength(1);
  });

  it('autoPagingToArray stops at the limit without fetching further pages', async () => {
    const vexpay = await client(paginated(250));
    const first120 = await vexpay.merchants.list({ limit: 100 }).autoPagingToArray({ limit: 120 });
    expect(first120).toHaveLength(120);
    expect(server!.requests).toHaveLength(2);
  });

  it('sends nothing until awaited or iterated', async () => {
    const vexpay = await client(paginated(10));
    const pending = vexpay.payouts.list();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(server!.requests).toHaveLength(0);
    await pending;
    expect(server!.requests).toHaveLength(1);
  });

  it('stops if the API repeats a cursor', async () => {
    const vexpay = await client(() => ({ status: 200, body: { items: [{ id: 'p' }], nextCursor: 'same' } }));
    const items = await vexpay.products.list().autoPagingToArray();
    expect(items).toHaveLength(2);
    expect(server!.requests).toHaveLength(2);
  });

  it('propagates an error from a later page', async () => {
    const vexpay = await client((req, index) =>
      index === 0
        ? { status: 200, body: { items: [{ payoutId: 'a' }], nextCursor: '1' } }
        : { status: 500, body: { message: 'bank down' } },
    );
    const seen: string[] = [];
    const run = async () => {
      for await (const payout of vexpay.payouts.list()) seen.push(payout.payoutId);
    };
    await expect(run()).rejects.toBeInstanceOf(VexPayAPIError);
    expect(seen).toEqual(['a']);
  });

  it('types items from the list schema', () => {
    const vexpay = new VexPay('sk_test_types');
    expectTypeOf(vexpay.merchants.list()).resolves.toEqualTypeOf<Schemas['MerchantListResponseDto']>();
    expectTypeOf<Awaited<ReturnType<typeof vexpay.payouts.list>>['items'][number]>().toEqualTypeOf<
      Schemas['PayoutListResponseDto']['items'][number]
    >();
  });
});

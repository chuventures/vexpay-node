export type CursorPage<Item> = { items: Item[]; nextCursor?: string | null };

/**
 * Result of a cursor-paginated `list()`.
 *
 *   const page = await vexpay.merchants.list({ limit: 100 });      // first page
 *   for await (const merchant of vexpay.merchants.list()) { … }    // every item, all pages
 *
 * The first request is sent when the result is awaited or iterated.
 */
export class PagePromise<Page extends CursorPage<Item>, Item = Page['items'][number]>
  implements PromiseLike<Page>, AsyncIterable<Item>
{
  private firstPage?: Promise<Page>;

  constructor(
    private readonly fetchPage: (cursor: string | undefined) => Promise<Page>,
    private readonly startCursor?: string,
  ) {}

  private first(): Promise<Page> {
    return (this.firstPage ??= this.fetchPage(this.startCursor));
  }

  then<TResult1 = Page, TResult2 = never>(
    onfulfilled?: ((value: Page) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.first().then(onfulfilled, onrejected);
  }

  catch<TResult = never>(
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): Promise<Page | TResult> {
    return this.first().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<Page> {
    return this.first().finally(onfinally);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Item> {
    let page = await this.first();
    let cursor = this.startCursor;
    for (;;) {
      for (const item of page.items) yield item;
      const next = page.nextCursor;
      // Stop on the last page, or if the API ever repeats a cursor.
      if (!next || next === cursor) return;
      cursor = next;
      page = await this.fetchPage(next);
    }
  }

  /** Collects items across pages, stopping after `limit` (default 10 000). */
  async autoPagingToArray({ limit = 10_000 }: { limit?: number } = {}): Promise<Item[]> {
    const items: Item[] = [];
    for await (const item of this) {
      items.push(item);
      if (items.length >= limit) break;
    }
    return items;
  }
}

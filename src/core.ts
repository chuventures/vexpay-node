import {
  VexPayConnectionError,
  VexPayError,
  VexPayTimeoutError,
  errorFromResponse,
} from './errors';
import { VERSION } from './version';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type QueryValue = string | number | boolean | null | undefined;

/** Per-request options accepted by every resource method. */
export interface RequestOptions {
  /** Sent as `Idempotency-Key` on POST. Defaults to a random UUID per call, reused across retries. */
  idempotencyKey?: string;
  /** Overrides the client's `timeoutMs` for this call. */
  timeoutMs?: number;
  /** Overrides the client's `maxNetworkRetries` for this call. */
  maxNetworkRetries?: number;
  /** Aborts the call (and any pending retry). */
  signal?: AbortSignal;
}

export interface CoreConfig {
  apiKey: string;
  baseUrl: string;
  timeoutMs: number;
  maxNetworkRetries: number;
  fetch: typeof fetch;
  /** Test hook — defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const INITIAL_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 8_000;
const MAX_RETRY_AFTER_MS = 60_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userAgent(): string {
  const runtime = typeof process !== 'undefined' && process.version ? ` node/${process.version}` : '';
  return `vexpay-node/${VERSION}${runtime}`;
}

/** Retry-After as seconds or an HTTP date → milliseconds, capped. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.min(Math.max(0, date - now), MAX_RETRY_AFTER_MS);
  return undefined;
}

/** Exponential backoff with full jitter: attempt 0 → [250, 500) ms, doubling, capped. */
export function backoffDelay(attempt: number, random = Math.random): number {
  const ceiling = Math.min(INITIAL_RETRY_DELAY_MS * 2 ** attempt, MAX_RETRY_DELAY_MS);
  return Math.round(ceiling / 2 + random() * (ceiling / 2));
}

function isRetryable(error: VexPayError): boolean {
  if (error instanceof VexPayConnectionError) return true;
  if (error.status === 429) return true;
  if (error.status !== undefined && error.status >= 500) return true;
  return error.status === 409 && error.code === 'idempotency_request_in_progress';
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path.replace(/^\//, ''), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class HttpClient {
  private readonly sleep: (ms: number) => Promise<void>;

  constructor(private readonly config: CoreConfig) {
    this.sleep = config.sleep ?? defaultSleep;
  }

  async request<T>(
    method: HttpMethod,
    path: string,
    params: { query?: Record<string, QueryValue>; body?: unknown } = {},
    options: RequestOptions = {},
  ): Promise<T> {
    const maxRetries = options.maxNetworkRetries ?? this.config.maxNetworkRetries;
    const timeoutMs = options.timeoutMs ?? this.config.timeoutMs;
    const url = buildUrl(this.config.baseUrl, path, params.query);

    const headers: Record<string, string> = {
      accept: 'application/json',
      'x-api-key': this.config.apiKey,
      'user-agent': userAgent(),
    };
    if (params.body !== undefined) headers['content-type'] = 'application/json';
    // One key for every attempt of this call: a retried POST can never charge twice.
    if (method === 'POST') headers['idempotency-key'] = options.idempotencyKey ?? crypto.randomUUID();
    const body = params.body === undefined ? undefined : JSON.stringify(params.body);

    for (let attempt = 0; ; attempt += 1) {
      let error: VexPayError;
      let retryAfterMs: number | undefined;

      try {
        const response = await this.send(url, { method, headers, body }, timeoutMs, options.signal);
        const parsed = await readBody(response);
        if (response.ok) return parsed as T;
        error = errorFromResponse(response.status, parsed, response.headers.get('x-request-id') ?? undefined);
        retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
      } catch (caught) {
        if (!(caught instanceof VexPayError)) throw caught;
        error = caught;
      }

      if (attempt >= maxRetries || !isRetryable(error) || options.signal?.aborted) throw error;
      await this.sleep(retryAfterMs ?? backoffDelay(attempt));
    }
  }

  private async send(
    url: string,
    init: { method: HttpMethod; headers: Record<string, string>; body?: string },
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<Response> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      return await this.config.fetch(url, { ...init, signal: controller.signal });
    } catch (caught) {
      if (timedOut) {
        throw new VexPayTimeoutError(`Request to VEXPay timed out after ${timeoutMs}ms`);
      }
      if (signal?.aborted) throw caught;
      const reason = caught instanceof Error ? caught.message : String(caught);
      throw new VexPayConnectionError(`Could not reach VEXPay: ${reason}`);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }
}

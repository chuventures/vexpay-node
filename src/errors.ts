/** Every error the SDK throws extends VexPayError. */
export class VexPayError extends Error {
  /** HTTP status, when the API answered. */
  readonly status?: number;
  /** Machine-readable API code, e.g. `insufficient_balance`. */
  readonly code?: string;
  /** Parsed response body, when the API answered. */
  readonly body?: unknown;
  /** Request id from the `x-request-id` response header, when present. */
  readonly requestId?: string;

  constructor(
    message: string,
    details: { status?: number; code?: string; body?: unknown; requestId?: string } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.status = details.status;
    this.code = details.code;
    this.body = details.body;
    this.requestId = details.requestId;
  }
}

/** Invalid client configuration (e.g. missing API key). Thrown before any request. */
export class VexPayConfigurationError extends VexPayError {}

/** 401 — missing, invalid, or revoked API key. */
export class VexPayAuthenticationError extends VexPayError {}

/** 400, 403, 410, 422 and other non-retryable 4xx — fix the request before retrying. */
export class VexPayInvalidRequestError extends VexPayError {}

/** 404 — the resource does not exist (or belongs to another account). */
export class VexPayNotFoundError extends VexPayError {}

/** 409 — e.g. `external_ref_conflict`, `idempotency_key_reused`. */
export class VexPayConflictError extends VexPayError {}

/** 429 — too many requests. Retried automatically before surfacing. */
export class VexPayRateLimitError extends VexPayError {}

/** 5xx — VEXPay or an upstream bank failed. Retried automatically before surfacing. */
export class VexPayAPIError extends VexPayError {}

/** The request never got an HTTP answer (DNS, refused, reset). */
export class VexPayConnectionError extends VexPayError {}

/** The request exceeded `timeoutMs`. */
export class VexPayTimeoutError extends VexPayConnectionError {}

/** A webhook signature did not verify (see `webhooks.constructEvent`). */
export class VexPaySignatureVerificationError extends VexPayError {}

const MACHINE_CODE = /^[a-z][a-z0-9_]*$/;

function messageFrom(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const { message, error } = body as { message?: unknown; error?: unknown };
    if (Array.isArray(message)) return message.join('; ');
    if (typeof message === 'string' && message) return message;
    if (typeof error === 'string' && error) return error;
  }
  if (typeof body === 'string' && body) return body;
  return `VEXPay API responded with HTTP ${status}`;
}

/** Maps an HTTP error response to the matching error class. */
export function errorFromResponse(status: number, body: unknown, requestId?: string): VexPayError {
  const rawCode = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined;
  const code = typeof rawCode === 'string' && MACHINE_CODE.test(rawCode) ? rawCode : undefined;
  const details = { status, code, body, requestId };
  const message = messageFrom(body, status);

  if (status === 401) return new VexPayAuthenticationError(message, details);
  if (status === 404) return new VexPayNotFoundError(message, details);
  if (status === 409) return new VexPayConflictError(message, details);
  if (status === 429) return new VexPayRateLimitError(message, details);
  if (status >= 500) return new VexPayAPIError(message, details);
  return new VexPayInvalidRequestError(message, details);
}

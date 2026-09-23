import type { HttpClient, QueryValue, RequestOptions } from './core';
import { VexPayInvalidRequestError } from './errors';
import { ROUTES } from './generated/routes';
import type { OperationId, ResponseBody } from './types';

export type CallArgs = {
  path?: Record<string, string>;
  query?: object;
  body?: unknown;
};

/** Base class for resources: turns an operationId + args into a typed HTTP call. */
export abstract class APIResource {
  constructor(protected readonly http: HttpClient) {}

  /** Async so a bad argument surfaces as a rejected promise, never a synchronous throw. */
  protected async call<O extends OperationId>(
    operationId: O,
    args: CallArgs = {},
    options?: RequestOptions,
  ): Promise<ResponseBody<O>> {
    const route = ROUTES[operationId];
    const path = route.path.replace(/\{(\w+)\}/g, (_match, name: string) => {
      const value = args.path?.[name];
      if (typeof value !== 'string' || value === '') {
        throw new VexPayInvalidRequestError(`Missing required path parameter "${name}" for ${operationId}.`);
      }
      return encodeURIComponent(value);
    });
    return this.http.request<ResponseBody<O>>(
      route.method,
      path,
      { query: args.query as Record<string, QueryValue> | undefined, body: args.body },
      options,
    );
  }
}

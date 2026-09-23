import type { components, operations } from './generated/openapi';
import type { OperationId } from './generated/routes';

export type { OperationId };

/** Every request/response schema in the VEXPay API, e.g. `Schemas['PaymentReceiptDto']`. */
export type Schemas = components['schemas'];

type Params<O extends OperationId> = operations[O]['parameters'];

export type PathParams<O extends OperationId> = NonNullable<Params<O>['path']>;
export type QueryParams<O extends OperationId> = NonNullable<Params<O>['query']>;

export type RequestBody<O extends OperationId> = operations[O] extends { requestBody?: infer RB }
  ? NonNullable<RB> extends { content: { 'application/json': infer B } }
    ? B
    : never
  : never;

type Responses<O extends OperationId> = operations[O]['responses'];
type SuccessCode<R> = Extract<keyof R, 200 | 201 | 202 | 204>;

/** The JSON body of the operation's success response (`void` when none is documented). */
export type ResponseBody<O extends OperationId> = [SuccessCode<Responses<O>>] extends [never]
  ? void
  : Responses<O>[SuccessCode<Responses<O>>] extends { content: { 'application/json': infer J } }
    ? J
    : void;

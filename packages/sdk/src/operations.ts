// Operation/Command contract. See /docs/operations.md.

export interface Operation<TPayload = unknown> {
  id: string;
  type: string;
  modelId: string;
  payload: TPayload;
  inverse: Operation;
  actorId: string;
  timestamp: number;
  parentOperationId?: string;
}

export interface JsonPatchOp {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

export interface OperationResult {
  operation: Operation;
  patch: JsonPatchOp[];
}

export interface Transaction {
  id: string;
  operations: Operation[];
  label: string;
}

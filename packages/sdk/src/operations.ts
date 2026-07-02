// Operation/Command contract. See /docs/operations.md.

// The inverse only needs enough information to be dispatched through the same
// applyOperation(model, { type, payload }) reducer used for replay/undo — it is not a
// full Operation (no id/actorId/timestamp of its own), which avoids a circular structure.
export interface InverseOperation<TPayload = unknown> {
  type: string;
  payload: TPayload;
}

export interface Operation<TPayload = unknown> {
  id: string;
  type: string;
  modelId: string;
  payload: TPayload;
  inverse: InverseOperation;
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

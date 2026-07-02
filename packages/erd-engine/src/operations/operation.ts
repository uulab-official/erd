import type { InverseOperation, Operation } from "@modelforge/sdk";
import type { OperationPayloadMap, OperationType } from "./types.js";

export type TypedOperation<K extends OperationType> = Operation<OperationPayloadMap[K]> & {
  type: K;
};

export type TypedInverse<K extends OperationType> = InverseOperation<OperationPayloadMap[K]> & {
  type: K;
};

let counter = 0;

// Deterministic-enough id generator: avoids a hard dependency on crypto.randomUUID so this
// also runs in older test/SSR environments.
export function nextOperationId(): string {
  counter += 1;
  return `op_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

export function buildOperation<K extends OperationType>(
  type: K,
  modelId: string,
  payload: OperationPayloadMap[K],
  inverse: TypedInverse<OperationType>,
  actorId: string,
): TypedOperation<K> {
  return {
    id: nextOperationId(),
    type,
    modelId,
    payload,
    inverse,
    actorId,
    timestamp: Date.now(),
  };
}

export function inverseOf<K extends OperationType>(
  type: K,
  payload: OperationPayloadMap[K],
): TypedInverse<K> {
  return { type, payload };
}

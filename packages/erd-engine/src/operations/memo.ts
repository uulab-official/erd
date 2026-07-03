import type { Memo, Model } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  CreateMemoPayload,
  DeleteMemoPayload,
  MoveMemoPayload,
  UpdateMemoTextPayload,
} from "./types.js";

export interface MemoOpResult<
  K extends "CreateMemo" | "UpdateMemoText" | "MoveMemo" | "DeleteMemo",
> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireMemo(model: Model, memoId: string): Memo {
  const memo = (model.memos ?? []).find((m) => m.id === memoId);
  if (!memo) throw new Error(`Memo "${memoId}" not found`);
  return memo;
}

export function createMemo(
  model: Model,
  payload: CreateMemoPayload,
  actorId: string,
): MemoOpResult<"CreateMemo"> {
  if ((model.memos ?? []).some((m) => m.id === payload.memo.id)) {
    throw new Error(`Memo "${payload.memo.id}" already exists`);
  }
  const nextModel: Model = { ...model, memos: [...(model.memos ?? []), payload.memo] };
  const inverse = inverseOf("DeleteMemo", { memoId: payload.memo.id });
  const operation = buildOperation("CreateMemo", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function updateMemoText(
  model: Model,
  payload: UpdateMemoTextPayload,
  actorId: string,
): MemoOpResult<"UpdateMemoText"> {
  const memo = requireMemo(model, payload.memoId);
  const nextModel: Model = {
    ...model,
    memos: (model.memos ?? []).map((m) => (m.id === memo.id ? { ...m, text: payload.text } : m)),
  };
  const inverse = inverseOf("UpdateMemoText", { memoId: memo.id, text: memo.text });
  const operation = buildOperation("UpdateMemoText", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function moveMemo(
  model: Model,
  payload: MoveMemoPayload,
  actorId: string,
): MemoOpResult<"MoveMemo"> {
  const memo = requireMemo(model, payload.memoId);
  const nextModel: Model = {
    ...model,
    memos: (model.memos ?? []).map((m) =>
      m.id === memo.id ? { ...m, x: payload.x, y: payload.y } : m,
    ),
  };
  const inverse = inverseOf("MoveMemo", { memoId: memo.id, x: memo.x, y: memo.y });
  const operation = buildOperation("MoveMemo", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function deleteMemo(
  model: Model,
  payload: DeleteMemoPayload,
  actorId: string,
): MemoOpResult<"DeleteMemo"> {
  const memo = requireMemo(model, payload.memoId);
  const nextModel: Model = {
    ...model,
    memos: (model.memos ?? []).filter((m) => m.id !== memo.id),
  };
  const inverse = inverseOf("CreateMemo", { memo });
  const operation = buildOperation("DeleteMemo", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

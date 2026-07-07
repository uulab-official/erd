import type { Model, Sequence, View } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  CreateSequencePayload,
  CreateViewPayload,
  DeleteSequencePayload,
  DeleteViewPayload,
  UpdateSequencePayload,
  UpdateViewPayload,
} from "./types.js";

export interface DatabaseOpResult<
  K extends
    | "CreateSequence"
    | "UpdateSequence"
    | "DeleteSequence"
    | "CreateView"
    | "UpdateView"
    | "DeleteView",
> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireSequence(model: Model, sequenceId: string): Sequence {
  const sequence = model.sequences.find((s) => s.id === sequenceId);
  if (!sequence) throw new Error(`Sequence "${sequenceId}" not found`);
  return sequence;
}

function requireView(model: Model, viewId: string): View {
  const view = model.views.find((v) => v.id === viewId);
  if (!view) throw new Error(`View "${viewId}" not found`);
  return view;
}

export function createSequence(
  model: Model,
  payload: CreateSequencePayload,
  actorId: string,
): DatabaseOpResult<"CreateSequence"> {
  if (model.sequences.some((s) => s.id === payload.sequence.id)) {
    throw new Error(`Sequence "${payload.sequence.id}" already exists`);
  }
  if (model.sequences.some((s) => s.name === payload.sequence.name)) {
    throw new Error(`Sequence named "${payload.sequence.name}" already exists`);
  }
  const nextModel: Model = { ...model, sequences: [...model.sequences, payload.sequence] };
  const inverse = inverseOf("DeleteSequence", { sequenceId: payload.sequence.id });
  const operation = buildOperation("CreateSequence", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function updateSequence(
  model: Model,
  payload: UpdateSequencePayload,
  actorId: string,
): DatabaseOpResult<"UpdateSequence"> {
  const sequence = requireSequence(model, payload.sequenceId);
  if (
    payload.changes.name !== undefined &&
    model.sequences.some((s) => s.id !== sequence.id && s.name === payload.changes.name)
  ) {
    throw new Error(`Sequence named "${payload.changes.name}" already exists`);
  }
  const previousChanges: UpdateSequencePayload["changes"] = {};
  for (const key of Object.keys(payload.changes) as (keyof typeof payload.changes)[]) {
    (previousChanges as Record<string, unknown>)[key] = sequence[key];
  }
  const nextModel: Model = {
    ...model,
    sequences: model.sequences.map((s) =>
      s.id === sequence.id ? { ...s, ...payload.changes } : s,
    ),
  };
  const inverse = inverseOf("UpdateSequence", {
    sequenceId: sequence.id,
    changes: previousChanges,
  });
  const operation = buildOperation("UpdateSequence", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function deleteSequence(
  model: Model,
  payload: DeleteSequencePayload,
  actorId: string,
): DatabaseOpResult<"DeleteSequence"> {
  const sequence = requireSequence(model, payload.sequenceId);
  const nextModel: Model = {
    ...model,
    sequences: model.sequences.filter((s) => s.id !== sequence.id),
  };
  const inverse = inverseOf("CreateSequence", { sequence });
  const operation = buildOperation("DeleteSequence", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function createView(
  model: Model,
  payload: CreateViewPayload,
  actorId: string,
): DatabaseOpResult<"CreateView"> {
  if (model.views.some((v) => v.id === payload.view.id)) {
    throw new Error(`View "${payload.view.id}" already exists`);
  }
  if (model.views.some((v) => v.name === payload.view.name)) {
    throw new Error(`View named "${payload.view.name}" already exists`);
  }
  const nextModel: Model = { ...model, views: [...model.views, payload.view] };
  const inverse = inverseOf("DeleteView", { viewId: payload.view.id });
  const operation = buildOperation("CreateView", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function updateView(
  model: Model,
  payload: UpdateViewPayload,
  actorId: string,
): DatabaseOpResult<"UpdateView"> {
  const view = requireView(model, payload.viewId);
  if (
    payload.changes.name !== undefined &&
    model.views.some((v) => v.id !== view.id && v.name === payload.changes.name)
  ) {
    throw new Error(`View named "${payload.changes.name}" already exists`);
  }
  const previousChanges: UpdateViewPayload["changes"] = {};
  for (const key of Object.keys(payload.changes) as (keyof typeof payload.changes)[]) {
    (previousChanges as Record<string, unknown>)[key] = view[key];
  }
  const nextModel: Model = {
    ...model,
    views: model.views.map((v) => (v.id === view.id ? { ...v, ...payload.changes } : v)),
  };
  const inverse = inverseOf("UpdateView", { viewId: view.id, changes: previousChanges });
  const operation = buildOperation("UpdateView", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function deleteView(
  model: Model,
  payload: DeleteViewPayload,
  actorId: string,
): DatabaseOpResult<"DeleteView"> {
  const view = requireView(model, payload.viewId);
  const nextModel: Model = { ...model, views: model.views.filter((v) => v.id !== view.id) };
  const inverse = inverseOf("CreateView", { view });
  const operation = buildOperation("DeleteView", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

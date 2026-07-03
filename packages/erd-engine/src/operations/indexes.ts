import type { Entity, Index, Model } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type { CreateIndexPayload, DeleteIndexPayload } from "./types.js";

export interface IndexOpResult<K extends "CreateIndex" | "DeleteIndex"> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireEntity(model: Model, entityId: string): Entity {
  const entity = model.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error(`Entity "${entityId}" not found`);
  return entity;
}

function requireIndex(entity: Entity, indexId: string): Index {
  const index = entity.indexes.find((i) => i.id === indexId);
  if (!index) throw new Error(`Index "${indexId}" not found on entity "${entity.id}"`);
  return index;
}

function updateEntityIndexes(
  model: Model,
  entityId: string,
  updater: (indexes: Index[]) => Index[],
): Model {
  return {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entityId ? { ...e, indexes: updater(e.indexes) } : e,
    ),
  };
}

export function createIndex(
  model: Model,
  payload: CreateIndexPayload,
  actorId: string,
): IndexOpResult<"CreateIndex"> {
  const entity = requireEntity(model, payload.entityId);
  if (entity.indexes.some((i) => i.id === payload.index.id)) {
    throw new Error(`Index "${payload.index.id}" already exists on entity "${entity.id}"`);
  }
  const nextModel = updateEntityIndexes(model, entity.id, (indexes) => {
    const insertAt = payload.position ?? indexes.length;
    return [...indexes.slice(0, insertAt), payload.index, ...indexes.slice(insertAt)];
  });
  const inverse = inverseOf("DeleteIndex", { entityId: entity.id, indexId: payload.index.id });
  const operation = buildOperation("CreateIndex", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function deleteIndex(
  model: Model,
  payload: DeleteIndexPayload,
  actorId: string,
): IndexOpResult<"DeleteIndex"> {
  const entity = requireEntity(model, payload.entityId);
  const index = requireIndex(entity, payload.indexId);
  const position = entity.indexes.findIndex((i) => i.id === index.id);
  const nextModel = updateEntityIndexes(model, entity.id, (indexes) =>
    indexes.filter((i) => i.id !== index.id),
  );
  const inverse = inverseOf("CreateIndex", { entityId: entity.id, index, position });
  const operation = buildOperation("DeleteIndex", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

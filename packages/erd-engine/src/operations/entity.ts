import type { Entity, Model } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  DeleteEntityPayload,
  MoveEntityPayload,
  RenameEntityPayload,
  SetEntityMetaPayload,
} from "./types.js";

function requireEntity(model: Model, entityId: string): Entity {
  const entity = model.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error(`Entity "${entityId}" not found`);
  return entity;
}

export interface EntityOpResult<
  K extends "CreateEntity" | "DeleteEntity" | "RenameEntity" | "MoveEntity" | "SetEntityMeta",
> {
  model: Model;
  operation: TypedOperation<K>;
}

export function createEntity(
  model: Model,
  entity: Entity,
  actorId: string,
  index?: number,
): EntityOpResult<"CreateEntity"> {
  if (model.entities.some((e) => e.id === entity.id)) {
    throw new Error(`Entity "${entity.id}" already exists`);
  }
  const insertAt = index ?? model.entities.length;
  const nextModel: Model = {
    ...model,
    entities: [...model.entities.slice(0, insertAt), entity, ...model.entities.slice(insertAt)],
  };
  const inverse = inverseOf("DeleteEntity", { entityId: entity.id });
  const operation = buildOperation("CreateEntity", model.id, { entity, index }, inverse, actorId);
  return { model: nextModel, operation };
}

export function deleteEntity(
  model: Model,
  payload: DeleteEntityPayload,
  actorId: string,
): EntityOpResult<"DeleteEntity"> {
  const entity = requireEntity(model, payload.entityId);
  const stillReferenced = model.relationships.some(
    (r) => r.sourceEntityId === entity.id || r.targetEntityId === entity.id,
  );
  if (stillReferenced) {
    throw new Error(
      `Entity "${entity.id}" is still referenced by a relationship — use deleteEntityCascade`,
    );
  }
  const index = model.entities.findIndex((e) => e.id === entity.id);
  const nextModel: Model = {
    ...model,
    entities: model.entities.filter((e) => e.id !== entity.id),
  };
  const inverse = inverseOf("CreateEntity", { entity, index });
  const operation = buildOperation("DeleteEntity", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function renameEntity(
  model: Model,
  payload: RenameEntityPayload,
  actorId: string,
): EntityOpResult<"RenameEntity"> {
  const entity = requireEntity(model, payload.entityId);
  const nextModel: Model = {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entity.id
        ? {
            ...e,
            logicalName: payload.logicalName ?? e.logicalName,
            physicalName: payload.physicalName ?? e.physicalName,
          }
        : e,
    ),
  };
  const inverse = inverseOf("RenameEntity", {
    entityId: entity.id,
    logicalName: payload.logicalName !== undefined ? entity.logicalName : undefined,
    physicalName: payload.physicalName !== undefined ? entity.physicalName : undefined,
  });
  const operation = buildOperation("RenameEntity", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function moveEntity(
  model: Model,
  payload: MoveEntityPayload,
  actorId: string,
): EntityOpResult<"MoveEntity"> {
  const entity = requireEntity(model, payload.entityId);
  const nextModel: Model = {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entity.id ? { ...e, ui: { ...e.ui, x: payload.x, y: payload.y } } : e,
    ),
  };
  const inverse = inverseOf("MoveEntity", { entityId: entity.id, x: entity.ui.x, y: entity.ui.y });
  const operation = buildOperation("MoveEntity", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function setEntityMeta(
  model: Model,
  payload: SetEntityMetaPayload,
  actorId: string,
): EntityOpResult<"SetEntityMeta"> {
  const entity = requireEntity(model, payload.entityId);
  const previousMeta: SetEntityMetaPayload["meta"] = {};
  for (const key of Object.keys(payload.meta) as (keyof typeof payload.meta)[]) {
    (previousMeta as Record<string, unknown>)[key] = entity[key];
  }
  const nextModel: Model = {
    ...model,
    entities: model.entities.map((e) => (e.id === entity.id ? { ...e, ...payload.meta } : e)),
  };
  const inverse = inverseOf("SetEntityMeta", { entityId: entity.id, meta: previousMeta });
  const operation = buildOperation("SetEntityMeta", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

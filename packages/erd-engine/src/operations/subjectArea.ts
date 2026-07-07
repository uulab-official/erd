import type { Entity, Model, SubjectArea } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  AssignEntityToSubjectAreaPayload,
  CreateSubjectAreaPayload,
  DeleteSubjectAreaPayload,
  UnassignEntityFromSubjectAreaPayload,
  UpdateSubjectAreaPayload,
} from "./types.js";

export interface SubjectAreaOpResult<
  K extends
    | "CreateSubjectArea"
    | "UpdateSubjectArea"
    | "DeleteSubjectArea"
    | "AssignEntityToSubjectArea"
    | "UnassignEntityFromSubjectArea",
> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireSubjectArea(model: Model, subjectAreaId: string): SubjectArea {
  const subjectArea = (model.subjectAreas ?? []).find((s) => s.id === subjectAreaId);
  if (!subjectArea) throw new Error(`Subject Area "${subjectAreaId}" not found`);
  return subjectArea;
}

function requireEntity(model: Model, entityId: string): Entity {
  const entity = model.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error(`Entity "${entityId}" not found`);
  return entity;
}

export function createSubjectArea(
  model: Model,
  payload: CreateSubjectAreaPayload,
  actorId: string,
): SubjectAreaOpResult<"CreateSubjectArea"> {
  if ((model.subjectAreas ?? []).some((s) => s.id === payload.subjectArea.id)) {
    throw new Error(`Subject Area "${payload.subjectArea.id}" already exists`);
  }
  if ((model.subjectAreas ?? []).some((s) => s.name === payload.subjectArea.name)) {
    throw new Error(`Subject Area named "${payload.subjectArea.name}" already exists`);
  }
  const nextModel: Model = {
    ...model,
    subjectAreas: [...(model.subjectAreas ?? []), payload.subjectArea],
  };
  const inverse = inverseOf("DeleteSubjectArea", { subjectAreaId: payload.subjectArea.id });
  const operation = buildOperation("CreateSubjectArea", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function updateSubjectArea(
  model: Model,
  payload: UpdateSubjectAreaPayload,
  actorId: string,
): SubjectAreaOpResult<"UpdateSubjectArea"> {
  const subjectArea = requireSubjectArea(model, payload.subjectAreaId);
  if (
    payload.changes.name !== undefined &&
    (model.subjectAreas ?? []).some(
      (s) => s.id !== subjectArea.id && s.name === payload.changes.name,
    )
  ) {
    throw new Error(`Subject Area named "${payload.changes.name}" already exists`);
  }
  const previousChanges: UpdateSubjectAreaPayload["changes"] = {};
  for (const key of Object.keys(payload.changes) as (keyof typeof payload.changes)[]) {
    (previousChanges as Record<string, unknown>)[key] = subjectArea[key];
  }
  const nextModel: Model = {
    ...model,
    subjectAreas: (model.subjectAreas ?? []).map((s) =>
      s.id === subjectArea.id ? { ...s, ...payload.changes } : s,
    ),
  };
  const inverse = inverseOf("UpdateSubjectArea", {
    subjectAreaId: subjectArea.id,
    changes: previousChanges,
  });
  const operation = buildOperation("UpdateSubjectArea", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Throws if any Entity is still assigned to this Subject Area — use
// deleteSubjectAreaCascade (transaction.ts) to unassign them first, mirroring
// deleteDomain/deleteDomainCascade.
export function deleteSubjectArea(
  model: Model,
  payload: DeleteSubjectAreaPayload,
  actorId: string,
): SubjectAreaOpResult<"DeleteSubjectArea"> {
  const subjectArea = requireSubjectArea(model, payload.subjectAreaId);
  if (subjectArea.entityIds.length > 0) {
    throw new Error(
      `Subject Area "${subjectArea.id}" still has entities — use deleteSubjectAreaCascade`,
    );
  }
  const nextModel: Model = {
    ...model,
    subjectAreas: (model.subjectAreas ?? []).filter((s) => s.id !== subjectArea.id),
  };
  const inverse = inverseOf("CreateSubjectArea", { subjectArea });
  const operation = buildOperation("DeleteSubjectArea", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// An Entity belongs to at most one Subject Area at a time (mirrors Attribute.domainId).
// Assigning to a new one implicitly removes it from whatever Subject Area it was in
// before, keeping SubjectArea.entityIds and Entity.subjectAreaId always in sync — the
// two fields are never written independently, so they can't drift apart.
export function assignEntityToSubjectArea(
  model: Model,
  payload: AssignEntityToSubjectAreaPayload,
  actorId: string,
): SubjectAreaOpResult<"AssignEntityToSubjectArea"> {
  const entity = requireEntity(model, payload.entityId);
  const subjectArea = requireSubjectArea(model, payload.subjectAreaId);
  const previousSubjectAreaId = entity.subjectAreaId;

  const nextModel: Model = {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entity.id ? { ...e, subjectAreaId: subjectArea.id } : e,
    ),
    subjectAreas: (model.subjectAreas ?? []).map((s) => {
      if (s.id === subjectArea.id) {
        return s.entityIds.includes(entity.id)
          ? s
          : { ...s, entityIds: [...s.entityIds, entity.id] };
      }
      if (s.id === previousSubjectAreaId) {
        return { ...s, entityIds: s.entityIds.filter((id) => id !== entity.id) };
      }
      return s;
    }),
  };
  const inverse = inverseOf("UnassignEntityFromSubjectArea", {
    entityId: entity.id,
    subjectAreaId: previousSubjectAreaId,
  });
  const operation = buildOperation(
    "AssignEntityToSubjectArea",
    model.id,
    payload,
    inverse,
    actorId,
  );
  return { model: nextModel, operation };
}

// A plain user-triggered unassign passes no subjectAreaId — it just clears the
// Entity's membership. `subjectAreaId` on the payload otherwise exists purely so this
// Operation can also serve as the inverse of AssignEntityToSubjectArea, restoring an
// Entity's exact prior Subject Area.
export function unassignEntityFromSubjectArea(
  model: Model,
  payload: UnassignEntityFromSubjectAreaPayload,
  actorId: string,
): SubjectAreaOpResult<"UnassignEntityFromSubjectArea"> {
  const entity = requireEntity(model, payload.entityId);
  const previousSubjectAreaId = entity.subjectAreaId;

  const nextModel: Model = {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entity.id ? { ...e, subjectAreaId: payload.subjectAreaId } : e,
    ),
    subjectAreas: (model.subjectAreas ?? []).map((s) => {
      if (payload.subjectAreaId && s.id === payload.subjectAreaId) {
        return s.entityIds.includes(entity.id)
          ? s
          : { ...s, entityIds: [...s.entityIds, entity.id] };
      }
      if (s.id === previousSubjectAreaId) {
        return { ...s, entityIds: s.entityIds.filter((id) => id !== entity.id) };
      }
      return s;
    }),
  };
  const inverse = inverseOf("UnassignEntityFromSubjectArea", {
    entityId: entity.id,
    subjectAreaId: previousSubjectAreaId,
  });
  const operation = buildOperation(
    "UnassignEntityFromSubjectArea",
    model.id,
    payload,
    inverse,
    actorId,
  );
  return { model: nextModel, operation };
}

import type { Model, Relationship } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  ChangeRelationshipCardinalityPayload,
  ChangeRelationshipKindPayload,
  DeleteRelationshipPayload,
} from "./types.js";

export interface RelationshipOpResult<
  K extends
    | "CreateRelationship"
    | "DeleteRelationship"
    | "ChangeRelationshipCardinality"
    | "ChangeRelationshipKind",
> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireRelationship(model: Model, relationshipId: string): Relationship {
  const relationship = model.relationships.find((r) => r.id === relationshipId);
  if (!relationship) throw new Error(`Relationship "${relationshipId}" not found`);
  return relationship;
}

export function createRelationship(
  model: Model,
  relationship: Relationship,
  actorId: string,
  index?: number,
): RelationshipOpResult<"CreateRelationship"> {
  if (model.relationships.some((r) => r.id === relationship.id)) {
    throw new Error(`Relationship "${relationship.id}" already exists`);
  }
  for (const entityId of [relationship.sourceEntityId, relationship.targetEntityId]) {
    if (!model.entities.some((e) => e.id === entityId)) {
      throw new Error(`Relationship references unknown entity "${entityId}"`);
    }
  }
  const insertAt = index ?? model.relationships.length;
  const nextModel: Model = {
    ...model,
    relationships: [
      ...model.relationships.slice(0, insertAt),
      relationship,
      ...model.relationships.slice(insertAt),
    ],
  };
  const inverse = inverseOf("DeleteRelationship", { relationshipId: relationship.id });
  const operation = buildOperation(
    "CreateRelationship",
    model.id,
    { relationship, index },
    inverse,
    actorId,
  );
  return { model: nextModel, operation };
}

export function deleteRelationship(
  model: Model,
  payload: DeleteRelationshipPayload,
  actorId: string,
): RelationshipOpResult<"DeleteRelationship"> {
  const relationship = requireRelationship(model, payload.relationshipId);
  const index = model.relationships.findIndex((r) => r.id === relationship.id);
  const nextModel: Model = {
    ...model,
    relationships: model.relationships.filter((r) => r.id !== relationship.id),
  };
  const inverse = inverseOf("CreateRelationship", { relationship, index });
  const operation = buildOperation("DeleteRelationship", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function changeRelationshipCardinality(
  model: Model,
  payload: ChangeRelationshipCardinalityPayload,
  actorId: string,
): RelationshipOpResult<"ChangeRelationshipCardinality"> {
  const relationship = requireRelationship(model, payload.relationshipId);
  const nextModel: Model = {
    ...model,
    relationships: model.relationships.map((r) =>
      r.id === relationship.id ? { ...r, cardinality: payload.cardinality } : r,
    ),
  };
  const inverse = inverseOf("ChangeRelationshipCardinality", {
    relationshipId: relationship.id,
    cardinality: relationship.cardinality,
  });
  const operation = buildOperation(
    "ChangeRelationshipCardinality",
    model.id,
    payload,
    inverse,
    actorId,
  );
  return { model: nextModel, operation };
}

export function changeRelationshipKind(
  model: Model,
  payload: ChangeRelationshipKindPayload,
  actorId: string,
): RelationshipOpResult<"ChangeRelationshipKind"> {
  const relationship = requireRelationship(model, payload.relationshipId);
  const nextModel: Model = {
    ...model,
    relationships: model.relationships.map((r) =>
      r.id === relationship.id ? { ...r, kind: payload.kind } : r,
    ),
  };
  const inverse = inverseOf("ChangeRelationshipKind", {
    relationshipId: relationship.id,
    kind: relationship.kind,
  });
  const operation = buildOperation("ChangeRelationshipKind", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

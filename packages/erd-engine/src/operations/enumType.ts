import type { Attribute, Entity, EnumType, Model } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  AssignEnumToAttributePayload,
  CreateEnumPayload,
  DeleteEnumPayload,
  UnassignEnumFromAttributePayload,
  UpdateEnumValuesPayload,
} from "./types.js";

export interface EnumOpResult<
  K extends
    | "CreateEnum"
    | "UpdateEnumValues"
    | "DeleteEnum"
    | "AssignEnumToAttribute"
    | "UnassignEnumFromAttribute",
> {
  model: Model;
  operation: TypedOperation<K>;
}

function requireEnum(model: Model, enumId: string): EnumType {
  const enumType = model.enums.find((e) => e.id === enumId);
  if (!enumType) throw new Error(`Enum "${enumId}" not found`);
  return enumType;
}

function requireEntity(model: Model, entityId: string): Entity {
  const entity = model.entities.find((e) => e.id === entityId);
  if (!entity) throw new Error(`Entity "${entityId}" not found`);
  return entity;
}

function requireAttribute(entity: Entity, attributeId: string): Attribute {
  const attribute = entity.attributes.find((a) => a.id === attributeId);
  if (!attribute) throw new Error(`Attribute "${attributeId}" not found on entity "${entity.id}"`);
  return attribute;
}

function updateAttribute(
  model: Model,
  entityId: string,
  attributeId: string,
  updater: (attribute: Attribute) => Attribute,
): Model {
  return {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entityId
        ? { ...e, attributes: e.attributes.map((a) => (a.id === attributeId ? updater(a) : a)) }
        : e,
    ),
  };
}

export function createEnum(
  model: Model,
  payload: CreateEnumPayload,
  actorId: string,
): EnumOpResult<"CreateEnum"> {
  if (model.enums.some((e) => e.id === payload.enumType.id)) {
    throw new Error(`Enum "${payload.enumType.id}" already exists`);
  }
  if (model.enums.some((e) => e.name === payload.enumType.name)) {
    throw new Error(`Enum named "${payload.enumType.name}" already exists`);
  }
  const nextModel: Model = { ...model, enums: [...model.enums, payload.enumType] };
  const inverse = inverseOf("DeleteEnum", { enumId: payload.enumType.id });
  const operation = buildOperation("CreateEnum", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function updateEnumValues(
  model: Model,
  payload: UpdateEnumValuesPayload,
  actorId: string,
): EnumOpResult<"UpdateEnumValues"> {
  const enumType = requireEnum(model, payload.enumId);
  const nextModel: Model = {
    ...model,
    enums: model.enums.map((e) => (e.id === enumType.id ? { ...e, values: payload.values } : e)),
  };
  const inverse = inverseOf("UpdateEnumValues", { enumId: enumType.id, values: enumType.values });
  const operation = buildOperation("UpdateEnumValues", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Throws if any Attribute still references this Enum — use deleteEnumCascade
// (transaction.ts) to unassign them first, mirroring deleteDomain/deleteDomainCascade.
export function deleteEnum(
  model: Model,
  payload: DeleteEnumPayload,
  actorId: string,
): EnumOpResult<"DeleteEnum"> {
  const enumType = requireEnum(model, payload.enumId);
  const stillReferenced = model.entities.some((e) =>
    e.attributes.some((a) => a.enumId === enumType.id),
  );
  if (stillReferenced) {
    throw new Error(`Enum "${enumType.id}" is still assigned — use deleteEnumCascade`);
  }
  const nextModel: Model = { ...model, enums: model.enums.filter((e) => e.id !== enumType.id) };
  const inverse = inverseOf("CreateEnum", { enumType });
  const operation = buildOperation("DeleteEnum", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Both assign and unassign always invert to an UnassignEnumFromAttribute carrying the
// attribute's exact prior enumId+type, never a re-derived AssignEnumToAttribute —
// mirrors attribute.ts's priorDomainState for exactly the same reason: an inverse that
// re-assigns "the Enum with this id" would read whatever that Enum looks like AT UNDO
// TIME, not what it was when this Operation was first applied (matters when the Enum
// itself is deleted/changed in the same undo pass via a cascade).
function priorEnumState(attribute: Attribute) {
  return { enumId: attribute.enumId, type: attribute.type };
}

// Assigning an Enum also forces the Attribute's type to "enum" — mirrors assignDomain
// syncing type/length/scale so the Attribute always reflects what it's linked to.
export function assignEnumToAttribute(
  model: Model,
  payload: AssignEnumToAttributePayload,
  actorId: string,
): EnumOpResult<"AssignEnumToAttribute"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  requireEnum(model, payload.enumId);

  const nextModel = updateAttribute(model, entity.id, attribute.id, (a) => ({
    ...a,
    enumId: payload.enumId,
    type: "enum",
  }));
  const inverse = inverseOf("UnassignEnumFromAttribute", {
    entityId: entity.id,
    attributeId: attribute.id,
    ...priorEnumState(attribute),
  });
  const operation = buildOperation("AssignEnumToAttribute", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// A plain user-triggered unassign passes no enumId/type — it just clears the enum link
// and leaves the Attribute's current type untouched (the user picks a real type
// afterward via ChangeAttributeType). `enumId`/`type` on the payload otherwise exist
// purely so this Operation can also serve as the inverse of AssignEnumToAttribute or of
// itself, restoring an Attribute's exact prior Enum link and type.
export function unassignEnumFromAttribute(
  model: Model,
  payload: UnassignEnumFromAttributePayload,
  actorId: string,
): EnumOpResult<"UnassignEnumFromAttribute"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);

  const nextModel = updateAttribute(model, entity.id, attribute.id, (a) => ({
    ...a,
    enumId: payload.enumId,
    type: payload.type ?? a.type,
  }));
  const inverse = inverseOf("UnassignEnumFromAttribute", {
    entityId: entity.id,
    attributeId: attribute.id,
    ...priorEnumState(attribute),
  });
  const operation = buildOperation(
    "UnassignEnumFromAttribute",
    model.id,
    payload,
    inverse,
    actorId,
  );
  return { model: nextModel, operation };
}

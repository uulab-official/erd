import type { Attribute, Entity, Model } from "@modelforge/schema-engine";
import { buildOperation, inverseOf, type TypedOperation } from "./operation.js";
import type {
  AddAttributePayload,
  AssignDomainPayload,
  ChangeAttributeTypePayload,
  RemoveAttributePayload,
  RenameAttributePayload,
  SetAttributeCommentPayload,
  SetAttributeDefaultPayload,
  SetAttributeFlagsPayload,
  UnassignDomainPayload,
} from "./types.js";

export interface AttributeOpResult<
  K extends
    | "AddAttribute"
    | "RemoveAttribute"
    | "RenameAttribute"
    | "ChangeAttributeType"
    | "SetAttributeFlags"
    | "SetAttributeDefault"
    | "SetAttributeComment"
    | "AssignDomain"
    | "UnassignDomain",
> {
  model: Model;
  operation: TypedOperation<K>;
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

function updateEntityAttributes(
  model: Model,
  entityId: string,
  updater: (attributes: Attribute[]) => Attribute[],
): Model {
  return {
    ...model,
    entities: model.entities.map((e) =>
      e.id === entityId ? { ...e, attributes: updater(e.attributes) } : e,
    ),
  };
}

export function addAttribute(
  model: Model,
  payload: AddAttributePayload,
  actorId: string,
): AttributeOpResult<"AddAttribute"> {
  const entity = requireEntity(model, payload.entityId);
  if (entity.attributes.some((a) => a.id === payload.attribute.id)) {
    throw new Error(`Attribute "${payload.attribute.id}" already exists on "${entity.id}"`);
  }
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) => {
    const index = payload.index ?? attrs.length;
    return [...attrs.slice(0, index), payload.attribute, ...attrs.slice(index)];
  });
  const inverse = inverseOf("RemoveAttribute", {
    entityId: entity.id,
    attributeId: payload.attribute.id,
  });
  const operation = buildOperation("AddAttribute", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function removeAttribute(
  model: Model,
  payload: RemoveAttributePayload,
  actorId: string,
): AttributeOpResult<"RemoveAttribute"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const index = entity.attributes.findIndex((a) => a.id === attribute.id);
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.filter((a) => a.id !== attribute.id),
  );
  const inverse = inverseOf("AddAttribute", { entityId: entity.id, attribute, index });
  const operation = buildOperation("RemoveAttribute", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function renameAttribute(
  model: Model,
  payload: RenameAttributePayload,
  actorId: string,
): AttributeOpResult<"RenameAttribute"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) =>
      a.id === attribute.id
        ? {
            ...a,
            name: payload.name ?? a.name,
            logicalName: payload.logicalName ?? a.logicalName,
          }
        : a,
    ),
  );
  const inverse = inverseOf("RenameAttribute", {
    entityId: entity.id,
    attributeId: attribute.id,
    name: payload.name !== undefined ? attribute.name : undefined,
    logicalName: payload.logicalName !== undefined ? attribute.logicalName : undefined,
  });
  const operation = buildOperation("RenameAttribute", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function changeAttributeType(
  model: Model,
  payload: ChangeAttributeTypePayload,
  actorId: string,
): AttributeOpResult<"ChangeAttributeType"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) =>
      a.id === attribute.id
        ? { ...a, type: payload.type, length: payload.length, scale: payload.scale }
        : a,
    ),
  );
  const inverse = inverseOf("ChangeAttributeType", {
    entityId: entity.id,
    attributeId: attribute.id,
    type: attribute.type,
    length: attribute.length,
    scale: attribute.scale,
  });
  const operation = buildOperation("ChangeAttributeType", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function setAttributeFlags(
  model: Model,
  payload: SetAttributeFlagsPayload,
  actorId: string,
): AttributeOpResult<"SetAttributeFlags"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const previousFlags: SetAttributeFlagsPayload["flags"] = {};
  for (const key of Object.keys(payload.flags) as (keyof typeof payload.flags)[]) {
    (previousFlags as Record<string, unknown>)[key] = attribute[key];
  }
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) => (a.id === attribute.id ? { ...a, ...payload.flags } : a)),
  );
  const inverse = inverseOf("SetAttributeFlags", {
    entityId: entity.id,
    attributeId: attribute.id,
    flags: previousFlags,
  });
  const operation = buildOperation("SetAttributeFlags", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// Both assignDomain and unassignDomain invert to an UnassignDomain payload that captures
// the attribute's exact prior domainId/type/length/scale — never to "re-assign domain X",
// since a Domain's own fields can change (or the Domain itself be deleted) between the
// forward call and undo. This matters most inside a Transaction like updateDomainCascade,
// where the Domain and its assigned Attributes are reverted in the same undo pass — if the
// Attribute's inverse re-derived values from the Domain, it would read whatever state the
// Domain is in AT UNDO TIME, not what it was when this Operation was first applied.
function priorDomainState(attribute: Attribute) {
  return {
    domainId: attribute.domainId,
    type: attribute.type,
    length: attribute.length,
    scale: attribute.scale,
  };
}

// Assigning a Domain immediately syncs the Attribute's type/length/scale to match it
// (erwin-style "typed attribute group") — they stay linked until explicitly unassigned or
// until ChangeAttributeType is called directly, which schema-engine's validateModel flags
// as "domain-drift" rather than this Operation silently re-syncing on every read.
export function assignDomain(
  model: Model,
  payload: AssignDomainPayload,
  actorId: string,
): AttributeOpResult<"AssignDomain"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const domain = (model.domains ?? []).find((d) => d.id === payload.domainId);
  if (!domain) throw new Error(`Domain "${payload.domainId}" not found`);

  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) =>
      a.id === attribute.id
        ? {
            ...a,
            domainId: domain.id,
            type: domain.type,
            length: domain.length,
            scale: domain.scale,
          }
        : a,
    ),
  );
  const inverse = inverseOf("UnassignDomain", {
    entityId: entity.id,
    attributeId: attribute.id,
    ...priorDomainState(attribute),
  });
  const operation = buildOperation("AssignDomain", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

// A plain user-triggered unassign passes no domainId/type override — it just clears
// domainId and leaves type/length/scale exactly as they are. `domainId`/`type`/`length`/
// `scale` on the payload otherwise exist purely so this Operation can also serve as the
// inverse of AssignDomain (or of itself), restoring an attribute's exact prior domain
// state rather than truly detaching it.
export function unassignDomain(
  model: Model,
  payload: UnassignDomainPayload,
  actorId: string,
): AttributeOpResult<"UnassignDomain"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);

  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) =>
      a.id === attribute.id
        ? {
            ...a,
            domainId: payload.domainId,
            type: payload.type ?? a.type,
            length: payload.type !== undefined ? payload.length : a.length,
            scale: payload.type !== undefined ? payload.scale : a.scale,
          }
        : a,
    ),
  );
  const inverse = inverseOf("UnassignDomain", {
    entityId: entity.id,
    attributeId: attribute.id,
    ...priorDomainState(attribute),
  });
  const operation = buildOperation("UnassignDomain", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function setAttributeDefault(
  model: Model,
  payload: SetAttributeDefaultPayload,
  actorId: string,
): AttributeOpResult<"SetAttributeDefault"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) => (a.id === attribute.id ? { ...a, default: payload.default } : a)),
  );
  const inverse = inverseOf("SetAttributeDefault", {
    entityId: entity.id,
    attributeId: attribute.id,
    default: attribute.default,
  });
  const operation = buildOperation("SetAttributeDefault", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

export function setAttributeComment(
  model: Model,
  payload: SetAttributeCommentPayload,
  actorId: string,
): AttributeOpResult<"SetAttributeComment"> {
  const entity = requireEntity(model, payload.entityId);
  const attribute = requireAttribute(entity, payload.attributeId);
  const nextModel = updateEntityAttributes(model, entity.id, (attrs) =>
    attrs.map((a) => (a.id === attribute.id ? { ...a, comment: payload.comment } : a)),
  );
  const inverse = inverseOf("SetAttributeComment", {
    entityId: entity.id,
    attributeId: attribute.id,
    comment: attribute.comment,
  });
  const operation = buildOperation("SetAttributeComment", model.id, payload, inverse, actorId);
  return { model: nextModel, operation };
}

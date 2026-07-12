import type { Attribute, Model, Relationship } from "@modelforge/schema-engine";
import type { Operation, Transaction } from "@modelforge/sdk";
import { applyInverse, applyOperation, toDispatchable } from "./apply.js";
import { addAttribute, assignDomain, removeAttribute, unassignDomain } from "./attribute.js";
import { deleteEntity, moveEntity } from "./entity.js";
import { deleteEnum, unassignEnumFromAttribute } from "./enumType.js";
import { deleteDomain, updateDomain } from "./governance.js";
import { deleteIndex } from "./indexes.js";
import { nextOperationId } from "./operation.js";
import { createRelationship, deleteRelationship } from "./relationship.js";
import { deleteSubjectArea, unassignEntityFromSubjectArea } from "./subjectArea.js";
import type { UpdateDomainPayload } from "./types.js";

// Compound edit: deleting an Entity that still has Relationships must remove those
// Relationships first, then the Entity, as one atomically-undoable Transaction.
// See "복합 동작" in /docs/operations.md.
export function deleteEntityCascade(
  model: Model,
  entityId: string,
  actorId: string,
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  const relationships = model.relationships.filter(
    (r) => r.sourceEntityId === entityId || r.targetEntityId === entityId,
  );
  for (const relationship of relationships) {
    const result = deleteRelationship(currentModel, { relationshipId: relationship.id }, actorId);
    currentModel = result.model;
    operations.push(result.operation);
  }

  const entityResult = deleteEntity(currentModel, { entityId }, actorId);
  currentModel = entityResult.model;
  operations.push(entityResult.operation);

  return {
    model: currentModel,
    transaction: { id: nextOperationId(), operations, label: `Delete entity "${entityId}"` },
  };
}

// Compound edit: removing an Attribute still referenced by a Relationship or an Index
// must remove those first, then the Attribute, as one atomically-undoable Transaction —
// mirrors deleteEntityCascade's relationship-then-entity ordering. A referencing Index is
// deleted outright rather than shrunk to its remaining columns, matching this codebase's
// existing "no partial Index edit" rule (see docs/operations.md — recreate instead).
export function removeAttributeCascade(
  model: Model,
  entityId: string,
  attributeId: string,
  actorId: string,
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  const relationships = model.relationships.filter(
    (r) => r.sourceAttributeIds.includes(attributeId) || r.targetAttributeIds.includes(attributeId),
  );
  for (const relationship of relationships) {
    const result = deleteRelationship(currentModel, { relationshipId: relationship.id }, actorId);
    currentModel = result.model;
    operations.push(result.operation);
  }

  const entity = currentModel.entities.find((e) => e.id === entityId);
  const indexes = entity?.indexes.filter((i) => i.attributeIds.includes(attributeId)) ?? [];
  for (const index of indexes) {
    const result = deleteIndex(currentModel, { entityId, indexId: index.id }, actorId);
    currentModel = result.model;
    operations.push(result.operation);
  }

  const attributeResult = removeAttribute(currentModel, { entityId, attributeId }, actorId);
  currentModel = attributeResult.model;
  operations.push(attributeResult.operation);

  return {
    model: currentModel,
    transaction: { id: nextOperationId(), operations, label: `Remove attribute "${attributeId}"` },
  };
}

// Compound edit: updating a Domain's type/length/scale must re-sync every Attribute
// currently assigned to it, so none of them drift out of sync the moment the Domain
// changes. Reuses assignDomain per affected Attribute (re-applying the now-updated
// Domain) rather than duplicating the sync logic here.
export function updateDomainCascade(
  model: Model,
  domainId: string,
  changes: UpdateDomainPayload["changes"],
  actorId: string,
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  const domainResult = updateDomain(currentModel, { domainId, changes }, actorId);
  currentModel = domainResult.model;
  operations.push(domainResult.operation);

  const typeChanged = "type" in changes || "length" in changes || "scale" in changes;
  if (typeChanged) {
    for (const entity of currentModel.entities) {
      for (const attribute of entity.attributes) {
        if (attribute.domainId !== domainId) continue;
        const result = assignDomain(
          currentModel,
          { entityId: entity.id, attributeId: attribute.id, domainId },
          actorId,
        );
        currentModel = result.model;
        operations.push(result.operation);
      }
    }
  }

  return {
    model: currentModel,
    transaction: { id: nextOperationId(), operations, label: `Update domain "${domainId}"` },
  };
}

// Compound edit: deleting a Domain that's still assigned to Attributes must unassign it
// from each of them first, then delete the Domain, as one atomically-undoable Transaction
// — mirrors deleteEntityCascade's relationship-then-entity ordering.
export function deleteDomainCascade(
  model: Model,
  domainId: string,
  actorId: string,
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  for (const entity of model.entities) {
    for (const attribute of entity.attributes) {
      if (attribute.domainId !== domainId) continue;
      const result = unassignDomain(
        currentModel,
        { entityId: entity.id, attributeId: attribute.id },
        actorId,
      );
      currentModel = result.model;
      operations.push(result.operation);
    }
  }

  const domainResult = deleteDomain(currentModel, { domainId }, actorId);
  currentModel = domainResult.model;
  operations.push(domainResult.operation);

  return {
    model: currentModel,
    transaction: { id: nextOperationId(), operations, label: `Delete domain "${domainId}"` },
  };
}

// Compound edit: deleting a Subject Area that still has Entities assigned must unassign
// each of them first, then delete the Subject Area, as one atomically-undoable
// Transaction — mirrors deleteDomainCascade's unassign-then-delete ordering.
export function deleteSubjectAreaCascade(
  model: Model,
  subjectAreaId: string,
  actorId: string,
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  for (const entity of model.entities) {
    if (entity.subjectAreaId !== subjectAreaId) continue;
    const result = unassignEntityFromSubjectArea(currentModel, { entityId: entity.id }, actorId);
    currentModel = result.model;
    operations.push(result.operation);
  }

  const subjectAreaResult = deleteSubjectArea(currentModel, { subjectAreaId }, actorId);
  currentModel = subjectAreaResult.model;
  operations.push(subjectAreaResult.operation);

  return {
    model: currentModel,
    transaction: {
      id: nextOperationId(),
      operations,
      label: `Delete subject area "${subjectAreaId}"`,
    },
  };
}

// Compound edit: deleting an Enum that's still assigned to Attributes must unassign it
// from each of them first, then delete the Enum, as one atomically-undoable
// Transaction — mirrors deleteDomainCascade/deleteSubjectAreaCascade's
// unassign-then-delete ordering.
export function deleteEnumCascade(
  model: Model,
  enumId: string,
  actorId: string,
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  for (const entity of model.entities) {
    for (const attribute of entity.attributes) {
      if (attribute.enumId !== enumId) continue;
      const result = unassignEnumFromAttribute(
        currentModel,
        { entityId: entity.id, attributeId: attribute.id },
        actorId,
      );
      currentModel = result.model;
      operations.push(result.operation);
    }
  }

  const enumResult = deleteEnum(currentModel, { enumId }, actorId);
  currentModel = enumResult.model;
  operations.push(enumResult.operation);

  return {
    model: currentModel,
    transaction: { id: nextOperationId(), operations, label: `Delete enum "${enumId}"` },
  };
}

export interface ConnectEntitiesInput {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipId: string;
  // Id for the new foreign-key Attribute this creates on the target entity — callers
  // decide ids (crypto.randomUUID() in apps/web), erd-engine never generates entity-level
  // ids itself.
  foreignKeyAttributeId: string;
  name?: string;
  cardinality?: Relationship["cardinality"];
  kind?: Relationship["kind"];
  optionality?: Relationship["optionality"];
}

// Compound edit: drawing a relationship between two entities (e.g. dragging a connection
// on the Canvas) needs a foreign-key Attribute to exist on the target before
// CreateRelationship can reference it — this creates that Attribute (mirroring the
// source's primary key's type) and the Relationship together as one atomically-undoable
// Transaction, the same "create the thing being referenced first" ordering
// updateDomainCascade/deleteDomainCascade use for Domains.
export function connectEntitiesCascade(
  model: Model,
  input: ConnectEntitiesInput,
  actorId: string,
): { model: Model; transaction: Transaction } {
  const source = model.entities.find((e) => e.id === input.sourceEntityId);
  if (!source) throw new Error(`Entity "${input.sourceEntityId}" not found`);
  const target = model.entities.find((e) => e.id === input.targetEntityId);
  if (!target) throw new Error(`Entity "${input.targetEntityId}" not found`);

  const sourcePrimaryKeys = source.attributes.filter((a) => a.isPrimaryKey);
  if (sourcePrimaryKeys.length === 0) {
    throw new Error(`Entity "${source.logicalName}" has no primary key to reference`);
  }
  if (sourcePrimaryKeys.length > 1) {
    throw new Error(
      `Entity "${source.logicalName}" has a composite primary key — add the foreign key attributes manually`,
    );
  }
  const primaryKey = sourcePrimaryKeys[0]!;

  const cardinality = input.cardinality ?? "one-to-many";
  const kind = input.kind ?? "non-identifying";
  const optionality = input.optionality ?? "mandatory";

  const foreignKeyAttribute: Attribute = {
    id: input.foreignKeyAttributeId,
    name: `${source.physicalName}_${primaryKey.name}`,
    logicalName: `${source.logicalName} ${primaryKey.logicalName}`,
    type: primaryKey.type,
    length: primaryKey.length,
    scale: primaryKey.scale,
    nullable: optionality === "optional",
    isPrimaryKey: false,
    isForeignKey: true,
    isUnique: cardinality === "one-to-one",
  };

  let currentModel = model;
  const operations: Operation[] = [];

  const attributeResult = addAttribute(
    currentModel,
    { entityId: target.id, attribute: foreignKeyAttribute },
    actorId,
  );
  currentModel = attributeResult.model;
  operations.push(attributeResult.operation);

  const relationship: Relationship = {
    id: input.relationshipId,
    name: input.name,
    sourceEntityId: source.id,
    targetEntityId: target.id,
    cardinality,
    kind,
    optionality,
    sourceAttributeIds: [primaryKey.id],
    targetAttributeIds: [foreignKeyAttribute.id],
  };
  const relationshipResult = createRelationship(currentModel, relationship, actorId);
  currentModel = relationshipResult.model;
  operations.push(relationshipResult.operation);

  return {
    model: currentModel,
    transaction: {
      id: nextOperationId(),
      operations,
      label: `Connect "${source.logicalName}" to "${target.logicalName}"`,
    },
  };
}

// Compound edit: repositioning many entities at once (an auto-layout run) is one user
// gesture, so it must undo as one — a single Ctrl+Z restores the entire previous
// arrangement instead of walking back one entity at a time. Entities already at their
// target position are skipped; ids the positions map doesn't cover are left untouched.
export function moveEntitiesTransaction(
  model: Model,
  positions: Record<string, { x: number; y: number }>,
  actorId: string,
  label = "Auto layout",
): { model: Model; transaction: Transaction } {
  let currentModel = model;
  const operations: Operation[] = [];

  for (const entity of model.entities) {
    const target = positions[entity.id];
    if (!target || (entity.ui.x === target.x && entity.ui.y === target.y)) continue;
    const result = moveEntity(
      currentModel,
      { entityId: entity.id, x: target.x, y: target.y },
      actorId,
    );
    currentModel = result.model;
    operations.push(result.operation);
  }

  return {
    model: currentModel,
    transaction: { id: nextOperationId(), operations, label },
  };
}

export function undoTransaction(model: Model, transaction: Transaction): Model {
  let currentModel = model;
  for (const operation of [...transaction.operations].reverse()) {
    currentModel = applyInverse(currentModel, operation);
  }
  return currentModel;
}

export function redoTransaction(model: Model, transaction: Transaction): Model {
  let currentModel = model;
  for (const operation of transaction.operations) {
    currentModel = applyOperation(currentModel, toDispatchable(operation));
  }
  return currentModel;
}

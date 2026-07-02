import type { Model } from "@modelforge/schema-engine";
import type { Operation, Transaction } from "@modelforge/sdk";
import { applyInverse, applyOperation, toDispatchable } from "./apply.js";
import { assignDomain, unassignDomain } from "./attribute.js";
import { deleteEntity } from "./entity.js";
import { deleteDomain, updateDomain } from "./governance.js";
import { nextOperationId } from "./operation.js";
import { deleteRelationship } from "./relationship.js";
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

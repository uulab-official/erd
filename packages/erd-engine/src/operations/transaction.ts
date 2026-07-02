import type { Model } from "@modelforge/schema-engine";
import type { Operation, Transaction } from "@modelforge/sdk";
import { applyInverse, applyOperation, toDispatchable } from "./apply.js";
import { deleteEntity } from "./entity.js";
import { nextOperationId } from "./operation.js";
import { deleteRelationship } from "./relationship.js";

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

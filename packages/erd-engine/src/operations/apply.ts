import type { Model } from "@modelforge/schema-engine";
import type { Operation } from "@modelforge/sdk";
import * as attributeOps from "./attribute.js";
import * as entityOps from "./entity.js";
import * as governanceOps from "./governance.js";
import * as indexOps from "./indexes.js";
import * as relationshipOps from "./relationship.js";
import type { OperationPayloadMap, OperationType } from "./types.js";

export interface DispatchableOperation<K extends OperationType = OperationType> {
  type: K;
  payload: OperationPayloadMap[K];
}

// Replays don't produce a loggable Operation of their own — the caller already has one
// (from history, from Diff Engine, from a Realtime broadcast).
const REPLAY_ACTOR = "replay";

// Generic reducer: forward-applies any operation type by type+payload alone. Used to
// replay history (undo/redo), Diff Engine output, and Realtime broadcasts, all through
// the same code path as the interactive create/delete/rename functions.
export function applyOperation(model: Model, op: DispatchableOperation): Model {
  switch (op.type) {
    case "CreateEntity": {
      const payload = op.payload as OperationPayloadMap["CreateEntity"];
      return entityOps.createEntity(model, payload.entity, REPLAY_ACTOR, payload.index).model;
    }
    case "DeleteEntity":
      return entityOps.deleteEntity(
        model,
        op.payload as OperationPayloadMap["DeleteEntity"],
        REPLAY_ACTOR,
      ).model;
    case "RenameEntity":
      return entityOps.renameEntity(
        model,
        op.payload as OperationPayloadMap["RenameEntity"],
        REPLAY_ACTOR,
      ).model;
    case "MoveEntity":
      return entityOps.moveEntity(
        model,
        op.payload as OperationPayloadMap["MoveEntity"],
        REPLAY_ACTOR,
      ).model;
    case "SetEntityMeta":
      return entityOps.setEntityMeta(
        model,
        op.payload as OperationPayloadMap["SetEntityMeta"],
        REPLAY_ACTOR,
      ).model;
    case "AddAttribute":
      return attributeOps.addAttribute(
        model,
        op.payload as OperationPayloadMap["AddAttribute"],
        REPLAY_ACTOR,
      ).model;
    case "RemoveAttribute":
      return attributeOps.removeAttribute(
        model,
        op.payload as OperationPayloadMap["RemoveAttribute"],
        REPLAY_ACTOR,
      ).model;
    case "RenameAttribute":
      return attributeOps.renameAttribute(
        model,
        op.payload as OperationPayloadMap["RenameAttribute"],
        REPLAY_ACTOR,
      ).model;
    case "ChangeAttributeType":
      return attributeOps.changeAttributeType(
        model,
        op.payload as OperationPayloadMap["ChangeAttributeType"],
        REPLAY_ACTOR,
      ).model;
    case "SetAttributeFlags":
      return attributeOps.setAttributeFlags(
        model,
        op.payload as OperationPayloadMap["SetAttributeFlags"],
        REPLAY_ACTOR,
      ).model;
    case "SetAttributeDefault":
      return attributeOps.setAttributeDefault(
        model,
        op.payload as OperationPayloadMap["SetAttributeDefault"],
        REPLAY_ACTOR,
      ).model;
    case "AssignDomain":
      return attributeOps.assignDomain(
        model,
        op.payload as OperationPayloadMap["AssignDomain"],
        REPLAY_ACTOR,
      ).model;
    case "UnassignDomain":
      return attributeOps.unassignDomain(
        model,
        op.payload as OperationPayloadMap["UnassignDomain"],
        REPLAY_ACTOR,
      ).model;
    case "CreateIndex":
      return indexOps.createIndex(
        model,
        op.payload as OperationPayloadMap["CreateIndex"],
        REPLAY_ACTOR,
      ).model;
    case "DeleteIndex":
      return indexOps.deleteIndex(
        model,
        op.payload as OperationPayloadMap["DeleteIndex"],
        REPLAY_ACTOR,
      ).model;
    case "CreateRelationship": {
      const payload = op.payload as OperationPayloadMap["CreateRelationship"];
      return relationshipOps.createRelationship(
        model,
        payload.relationship,
        REPLAY_ACTOR,
        payload.index,
      ).model;
    }
    case "DeleteRelationship":
      return relationshipOps.deleteRelationship(
        model,
        op.payload as OperationPayloadMap["DeleteRelationship"],
        REPLAY_ACTOR,
      ).model;
    case "ChangeRelationshipCardinality":
      return relationshipOps.changeRelationshipCardinality(
        model,
        op.payload as OperationPayloadMap["ChangeRelationshipCardinality"],
        REPLAY_ACTOR,
      ).model;
    case "ChangeRelationshipKind":
      return relationshipOps.changeRelationshipKind(
        model,
        op.payload as OperationPayloadMap["ChangeRelationshipKind"],
        REPLAY_ACTOR,
      ).model;
    case "CreateDomain":
      return governanceOps.createDomain(
        model,
        op.payload as OperationPayloadMap["CreateDomain"],
        REPLAY_ACTOR,
      ).model;
    case "UpdateDomain":
      return governanceOps.updateDomain(
        model,
        op.payload as OperationPayloadMap["UpdateDomain"],
        REPLAY_ACTOR,
      ).model;
    case "DeleteDomain":
      return governanceOps.deleteDomain(
        model,
        op.payload as OperationPayloadMap["DeleteDomain"],
        REPLAY_ACTOR,
      ).model;
    case "AddDictionaryEntry":
      return governanceOps.addDictionaryEntry(
        model,
        op.payload as OperationPayloadMap["AddDictionaryEntry"],
        REPLAY_ACTOR,
      ).model;
    case "UpdateDictionaryEntry":
      return governanceOps.updateDictionaryEntry(
        model,
        op.payload as OperationPayloadMap["UpdateDictionaryEntry"],
        REPLAY_ACTOR,
      ).model;
    case "DeleteDictionaryEntry":
      return governanceOps.deleteDictionaryEntry(
        model,
        op.payload as OperationPayloadMap["DeleteDictionaryEntry"],
        REPLAY_ACTOR,
      ).model;
    case "UpdateNamingRuleSet":
      return governanceOps.updateNamingRuleSet(
        model,
        op.payload as OperationPayloadMap["UpdateNamingRuleSet"],
        REPLAY_ACTOR,
      ).model;
    default: {
      const exhaustive: never = op.type;
      throw new Error(`Unknown operation type "${String(exhaustive)}"`);
    }
  }
}

// Narrows an untyped Operation/InverseOperation (as stored in history/network payloads)
// back into a DispatchableOperation. The cast is the trust boundary: callers are
// responsible for only ever constructing these from the erd-engine operation factories.
export function toDispatchable(op: { type: string; payload: unknown }): DispatchableOperation {
  return op as DispatchableOperation;
}

export function applyInverse(model: Model, operation: Operation): Model {
  return applyOperation(model, toDispatchable(operation.inverse));
}

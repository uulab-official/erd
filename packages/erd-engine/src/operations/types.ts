// Payload shapes for the Phase 1 Operation set. See /docs/operations.md.
import type { Attribute, ColumnType, Entity, Relationship } from "@modelforge/schema-engine";

export interface CreateEntityPayload {
  entity: Entity;
  index?: number;
}
export interface DeleteEntityPayload {
  entityId: string;
}
export interface RenameEntityPayload {
  entityId: string;
  logicalName?: string;
  physicalName?: string;
}
export interface MoveEntityPayload {
  entityId: string;
  x: number;
  y: number;
}
export interface SetEntityMetaPayload {
  entityId: string;
  meta: Partial<Pick<Entity, "description" | "color" | "icon" | "category" | "owner" | "tags">>;
}

export interface AddAttributePayload {
  entityId: string;
  attribute: Attribute;
  index?: number;
}
export interface RemoveAttributePayload {
  entityId: string;
  attributeId: string;
}
export interface RenameAttributePayload {
  entityId: string;
  attributeId: string;
  name?: string;
  logicalName?: string;
}
export interface ChangeAttributeTypePayload {
  entityId: string;
  attributeId: string;
  type: ColumnType;
  length?: number;
  scale?: number;
}
export interface SetAttributeFlagsPayload {
  entityId: string;
  attributeId: string;
  flags: Partial<Pick<Attribute, "nullable" | "isPrimaryKey" | "isForeignKey" | "isUnique">>;
}
export interface SetAttributeDefaultPayload {
  entityId: string;
  attributeId: string;
  default: Attribute["default"];
}

export interface CreateRelationshipPayload {
  relationship: Relationship;
  index?: number;
}
export interface DeleteRelationshipPayload {
  relationshipId: string;
}
export interface ChangeRelationshipCardinalityPayload {
  relationshipId: string;
  cardinality: Relationship["cardinality"];
}
export interface ChangeRelationshipKindPayload {
  relationshipId: string;
  kind: Relationship["kind"];
}

export interface OperationPayloadMap {
  CreateEntity: CreateEntityPayload;
  DeleteEntity: DeleteEntityPayload;
  RenameEntity: RenameEntityPayload;
  MoveEntity: MoveEntityPayload;
  SetEntityMeta: SetEntityMetaPayload;
  AddAttribute: AddAttributePayload;
  RemoveAttribute: RemoveAttributePayload;
  RenameAttribute: RenameAttributePayload;
  ChangeAttributeType: ChangeAttributeTypePayload;
  SetAttributeFlags: SetAttributeFlagsPayload;
  SetAttributeDefault: SetAttributeDefaultPayload;
  CreateRelationship: CreateRelationshipPayload;
  DeleteRelationship: DeleteRelationshipPayload;
  ChangeRelationshipCardinality: ChangeRelationshipCardinalityPayload;
  ChangeRelationshipKind: ChangeRelationshipKindPayload;
}

export type OperationType = keyof OperationPayloadMap;

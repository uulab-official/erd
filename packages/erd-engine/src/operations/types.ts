// Payload shapes for the Phase 1 Operation set. See /docs/operations.md.
import type {
  Attribute,
  ColumnType,
  DictionaryEntry,
  Domain,
  Entity,
  Index,
  NamingRuleSet,
  Relationship,
} from "@modelforge/schema-engine";

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

export interface AssignDomainPayload {
  entityId: string;
  attributeId: string;
  domainId: string;
}
export interface UnassignDomainPayload {
  entityId: string;
  attributeId: string;
  // Only set when this payload is restoring a prior domain link (as the inverse of
  // AssignDomain/UnassignDomain) rather than performing a real user-triggered unassign.
  domainId?: string;
  // Only set alongside `domainId` above, to restore the attribute's exact prior
  // type/length/scale. A user-triggered unassign omits these and just clears domainId,
  // leaving the attribute's current type/length/scale untouched.
  type?: ColumnType;
  length?: number;
  scale?: number;
}

export interface CreateIndexPayload {
  entityId: string;
  index: Index;
  // Position within the entity's indexes array — named `position` (not `index`, unlike
  // AddAttributePayload's `index`) since `index` here already means the Index being added.
  position?: number;
}
export interface DeleteIndexPayload {
  entityId: string;
  indexId: string;
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

export interface CreateDomainPayload {
  domain: Domain;
}
export interface UpdateDomainPayload {
  domainId: string;
  changes: Partial<
    Pick<Domain, "name" | "type" | "length" | "scale" | "defaultValidation" | "description">
  >;
}
export interface DeleteDomainPayload {
  domainId: string;
}

export interface AddDictionaryEntryPayload {
  entry: DictionaryEntry;
}
export interface UpdateDictionaryEntryPayload {
  entryId: string;
  changes: Partial<
    Pick<DictionaryEntry, "logicalTerm" | "standardName" | "abbreviation" | "domainId">
  >;
}
export interface DeleteDictionaryEntryPayload {
  entryId: string;
}

export interface UpdateNamingRuleSetPayload {
  // Undefined clears the Model's NamingRuleSet entirely (back to "no rules configured").
  namingRules: NamingRuleSet | undefined;
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
  AssignDomain: AssignDomainPayload;
  UnassignDomain: UnassignDomainPayload;
  CreateIndex: CreateIndexPayload;
  DeleteIndex: DeleteIndexPayload;
  CreateRelationship: CreateRelationshipPayload;
  DeleteRelationship: DeleteRelationshipPayload;
  ChangeRelationshipCardinality: ChangeRelationshipCardinalityPayload;
  ChangeRelationshipKind: ChangeRelationshipKindPayload;
  CreateDomain: CreateDomainPayload;
  UpdateDomain: UpdateDomainPayload;
  DeleteDomain: DeleteDomainPayload;
  AddDictionaryEntry: AddDictionaryEntryPayload;
  UpdateDictionaryEntry: UpdateDictionaryEntryPayload;
  DeleteDictionaryEntry: DeleteDictionaryEntryPayload;
  UpdateNamingRuleSet: UpdateNamingRuleSetPayload;
}

export type OperationType = keyof OperationPayloadMap;

// Minimal standalone copies of the shapes this Function needs from
// @modelforge/sdk's MigrationStep and @modelforge/deploy-engine's Appwrite native
// schema types. Deliberately NOT imported via a workspace dependency — Appwrite's
// build container runs a plain `npm install` on this folder alone, so it can't resolve
// `workspace:*` protocol deps. Keep in sync by hand with:
//   packages/sdk/src/adapter.ts (MigrationStep)
//   packages/deploy-engine/src/adapters/appwrite/types.ts (Appwrite*Def)

export type ReferentialAction = "cascade" | "restrict" | "set-null" | "no-action";

export interface MigrationStep {
  action:
    | "create-collection"
    | "drop-collection"
    | "create-table"
    | "drop-table"
    | "add-attribute"
    | "drop-attribute"
    | "alter-attribute"
    | "create-index"
    | "drop-index"
    | "create-relationship"
    | "drop-relationship";
  target: string;
  sql?: string;
  appwriteCall?: unknown;
  destructive: boolean;
  warning?: string;
}

export interface MigrationPlan {
  id: string;
  adapterKind: string;
  steps: MigrationStep[];
}

export interface DeployResult {
  planId: string;
  appliedSteps: string[];
  failedStep?: { step: MigrationStep; error: string };
}

export type AppwriteAttributeType =
  "string" | "integer" | "float" | "boolean" | "datetime" | "enum";

export interface AppwriteAttributeDef {
  key: string;
  type: AppwriteAttributeType;
  required: boolean;
  array: boolean;
  size?: number;
  default?: string | number | boolean | null;
  elements?: string[];
}

export type AppwriteRelationType = "oneToOne" | "oneToMany" | "manyToOne" | "manyToMany";

export interface AppwriteRelationshipAttributeDef {
  key: string;
  type: "relationship";
  relatedCollection: string;
  relationType: AppwriteRelationType;
  twoWay: boolean;
  onDelete: ReferentialAction;
}

export type AppwriteAnyAttributeDef = AppwriteAttributeDef | AppwriteRelationshipAttributeDef;

export interface AppwriteIndexDef {
  key: string;
  type: "key" | "unique" | "fulltext";
  attributes: string[];
}

export interface AppwriteCollectionDef {
  id: string;
  name: string;
  attributes: AppwriteAnyAttributeDef[];
  indexes: AppwriteIndexDef[];
}

export function isRelationshipAttribute(
  attr: AppwriteAnyAttributeDef,
): attr is AppwriteRelationshipAttributeDef {
  return attr.type === "relationship";
}

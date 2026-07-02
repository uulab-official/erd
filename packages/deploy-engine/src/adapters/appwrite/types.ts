// Appwrite native schema shapes. See /docs/adapters.md.

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
export type AppwriteOnDelete = "cascade" | "restrict" | "setNull";

export interface AppwriteRelationshipAttributeDef {
  key: string;
  type: "relationship";
  relatedCollection: string;
  relationType: AppwriteRelationType;
  twoWay: boolean;
  onDelete: AppwriteOnDelete;
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

export interface AppwriteNativeSchema {
  collections: AppwriteCollectionDef[];
}

export function isRelationshipAttribute(
  attr: AppwriteAnyAttributeDef,
): attr is AppwriteRelationshipAttributeDef {
  return attr.type === "relationship";
}

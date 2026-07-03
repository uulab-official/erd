// Core data model. See /docs/schema-engine.md for the full spec.
// Canvas (React Flow) renders this; it never owns it.

export type AdapterKind = "appwrite" | "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";

export type ColumnType =
  "string" | "integer" | "bigint" | "float" | "boolean" | "datetime" | "json" | "enum" | "uuid";

export interface NodeUiState {
  x: number;
  y: number;
  width?: number;
  height?: number;
  collapsed?: boolean;
}

export interface Attribute {
  id: string;
  name: string;
  logicalName: string;
  type: ColumnType;
  length?: number;
  scale?: number;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  default?: string | number | boolean | null;
  domainId?: string;
  comment?: string;
}

export interface Index {
  id: string;
  name: string;
  attributeIds: string[];
  unique: boolean;
  type?: "btree" | "hash" | "gin" | "gist" | "fulltext";
}

export interface Entity {
  id: string;
  logicalName: string;
  physicalName: string;
  description?: string;
  category?: string;
  owner?: string;
  tags: string[];
  color?: string;
  icon?: string;
  attributes: Attribute[];
  indexes: Index[];
  subjectAreaId?: string;
  ui: NodeUiState;
}

export interface Relationship {
  id: string;
  name?: string;
  sourceEntityId: string;
  targetEntityId: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-many";
  kind: "identifying" | "non-identifying";
  optionality: "mandatory" | "optional";
  sourceAttributeIds: string[];
  targetAttributeIds: string[];
  onDelete?: "cascade" | "restrict" | "set-null" | "no-action";
  onUpdate?: "cascade" | "restrict" | "set-null" | "no-action";
}

export interface EnumType {
  id: string;
  name: string;
  values: string[];
}

export interface Sequence {
  id: string;
  name: string;
  start: number;
  increment: number;
}

export interface View {
  id: string;
  name: string;
  sql?: string;
  definition?: unknown;
}

export interface Domain {
  id: string;
  name: string;
  type: ColumnType;
  length?: number;
  scale?: number;
  defaultValidation?: string;
  description?: string;
}

export interface NamingRuleSet {
  case: "camel" | "snake" | "pascal" | "upper" | "lower";
  entityPrefix?: string;
  entitySuffix?: string;
  attributePrefix?: string;
  attributeSuffix?: string;
  reservedWords: string[];
  abbreviations: Record<string, string>;
}

export interface DictionaryEntry {
  id: string;
  logicalTerm: string;
  standardName: string;
  abbreviation?: string;
  domainId?: string;
}

export interface SubjectArea {
  id: string;
  name: string;
  entityIds: string[];
  color?: string;
}

// A freeform sticky note on the canvas — not attached to any Entity, purely
// documentation (e.g. "this table gets rewritten in the v2 migration"). See
// docs/operations.md's "Subject Area / Canvas 주석" Operation list.
export interface Memo {
  id: string;
  text: string;
  x: number;
  y: number;
  color?: string;
}

export interface Model {
  id: string;
  name: string;
  adapter: AdapterKind;
  entities: Entity[];
  relationships: Relationship[];
  views: View[];
  sequences: Sequence[];
  enums: EnumType[];
  // Governance (erwin-style): typed attribute groups, a standard-term glossary, and
  // naming enforcement. Optional so older persisted Models (saved before this field
  // existed) still satisfy the type — readers should treat a missing value as "none
  // configured" (`[]`/no rules), not as a data error.
  domains?: Domain[];
  dictionary?: DictionaryEntry[];
  namingRules?: NamingRuleSet;
  // erwin-style Subject Areas — named groups of Entities for large-diagram organization.
  // Same optionality rationale as domains/dictionary/namingRules above.
  subjectAreas?: SubjectArea[];
  memos?: Memo[];
}

export interface Project {
  id: string;
  name: string;
  models: Model[];
  subjectAreas: SubjectArea[];
}

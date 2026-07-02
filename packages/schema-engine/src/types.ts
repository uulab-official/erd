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

export interface Model {
  id: string;
  name: string;
  adapter: AdapterKind;
  entities: Entity[];
  relationships: Relationship[];
  views: View[];
  sequences: Sequence[];
  enums: EnumType[];
}

export interface Project {
  id: string;
  name: string;
  models: Model[];
  dictionary: DictionaryEntry[];
  domains: Domain[];
  namingRules: NamingRuleSet;
  subjectAreas: SubjectArea[];
}

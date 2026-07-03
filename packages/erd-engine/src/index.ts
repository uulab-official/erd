// Owns Entity/Attribute/Relationship CRUD via Operations. See /docs/operations.md.
import type { Model } from "@modelforge/schema-engine";

export function createEmptyModel(id: string, name: string, adapter: Model["adapter"]): Model {
  return {
    id,
    name,
    adapter,
    entities: [],
    relationships: [],
    views: [],
    sequences: [],
    enums: [],
  };
}

export * from "./operations/types.js";
export * from "./operations/operation.js";
export * from "./operations/entity.js";
export * from "./operations/attribute.js";
export * from "./operations/indexes.js";
export * from "./operations/enumType.js";
export * from "./operations/memo.js";
export * from "./operations/relationship.js";
export * from "./operations/subjectArea.js";
export * from "./operations/governance.js";
export * from "./operations/apply.js";
export * from "./operations/transaction.js";
export * from "./operations/history.js";
export * from "./operations/describe.js";

// Owns Entity/Attribute/Relationship/Index/Enum/Domain/Sequence/View/SubjectArea CRUD via Operations.
// Phase 1: implemented as apply(model, Operation) -> { model, inverse }. See /docs/operations.md.
import type { Model } from "@modelforge/schema-engine";
import type { Operation } from "@modelforge/sdk";

export interface ApplyResult {
  model: Model;
  inverse: Operation;
}

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

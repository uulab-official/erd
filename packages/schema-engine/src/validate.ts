import type { Model } from "./types.js";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
  attributeId?: string;
}

// A reasonably complete cross-dialect SQL reserved word list, used as the default until
// a Project's NamingRuleSet.reservedWords (docs/schema-engine.md) is wired through. Callers
// that already have a NamingRuleSet should pass its reservedWords to override this default.
export const DEFAULT_RESERVED_WORDS = [
  "select",
  "insert",
  "update",
  "delete",
  "table",
  "from",
  "where",
  "order",
  "group",
  "join",
  "index",
  "primary",
  "foreign",
  "key",
  "values",
  "into",
  "drop",
  "alter",
  "create",
  "default",
  "null",
  "unique",
  "constraint",
  "references",
  "and",
  "or",
  "not",
  "as",
  "on",
  "in",
  "is",
  "like",
  "between",
  "case",
  "when",
  "then",
  "else",
  "end",
  "union",
  "all",
  "distinct",
  "having",
  "limit",
  "offset",
  "set",
  "user",
  "type",
  "date",
  "time",
  "timestamp",
];

function checkStructural(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of model.entities) {
    if (!entity.attributes.some((a) => a.isPrimaryKey)) {
      issues.push({
        severity: "error",
        code: "no-primary-key",
        message: `Entity "${entity.logicalName}" has no primary key attribute.`,
        entityId: entity.id,
      });
    }

    const seen = new Set<string>();
    for (const attr of entity.attributes) {
      if (seen.has(attr.name)) {
        issues.push({
          severity: "error",
          code: "duplicate-attribute-name",
          message: `Duplicate attribute name "${attr.name}" in entity "${entity.logicalName}".`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
      seen.add(attr.name);
    }
  }

  const referencedEntityIds = new Set<string>();
  for (const rel of model.relationships) {
    referencedEntityIds.add(rel.sourceEntityId);
    referencedEntityIds.add(rel.targetEntityId);
    if (rel.sourceAttributeIds.length !== rel.targetAttributeIds.length) {
      issues.push({
        severity: "error",
        code: "relationship-attribute-count-mismatch",
        message: `Relationship "${rel.name ?? rel.id}" has mismatched source/target attribute counts.`,
      });
    }
  }

  for (const entity of model.entities) {
    if (!referencedEntityIds.has(entity.id)) {
      issues.push({
        severity: "warning",
        code: "orphan-entity",
        message: `Entity "${entity.logicalName}" has no relationships.`,
        entityId: entity.id,
      });
    }
  }

  return issues;
}

function checkDuplicateIndexes(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of model.entities) {
    const seenNames = new Set<string>();
    const seenSignatures = new Map<string, string>();

    for (const index of entity.indexes) {
      if (seenNames.has(index.name)) {
        issues.push({
          severity: "error",
          code: "duplicate-index-name",
          message: `Duplicate index name "${index.name}" on entity "${entity.logicalName}".`,
          entityId: entity.id,
        });
      }
      seenNames.add(index.name);

      const signature = [...index.attributeIds].sort().join(",");
      const existing = seenSignatures.get(signature);
      if (existing && existing !== index.name) {
        issues.push({
          severity: "warning",
          code: "duplicate-index-columns",
          message: `Index "${index.name}" on entity "${entity.logicalName}" covers the same columns as "${existing}".`,
          entityId: entity.id,
        });
      } else {
        seenSignatures.set(signature, index.name);
      }
    }
  }

  return issues;
}

function checkReservedWords(model: Model, reservedWords: string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const reserved = new Set(reservedWords.map((w) => w.toLowerCase()));

  for (const entity of model.entities) {
    if (reserved.has(entity.physicalName.toLowerCase())) {
      issues.push({
        severity: "error",
        code: "reserved-word",
        message: `Entity physical name "${entity.physicalName}" is a reserved word.`,
        entityId: entity.id,
      });
    }
    for (const attr of entity.attributes) {
      if (reserved.has(attr.name.toLowerCase())) {
        issues.push({
          severity: "error",
          code: "reserved-word",
          message: `Attribute "${attr.name}" on entity "${entity.logicalName}" is a reserved word.`,
          entityId: entity.id,
          attributeId: attr.id,
        });
      }
    }
  }

  return issues;
}

// Identifying relationships form a parent -> child dependency: the child's primary key
// includes the parent's. A cycle in that graph means no entity's PK could ever be
// resolved, so it's a hard error, not just a modeling smell.
function checkCircularIdentifyingRelationships(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const edges = new Map<string, string[]>();
  for (const rel of model.relationships) {
    if (rel.kind !== "identifying") continue;
    const children = edges.get(rel.sourceEntityId) ?? [];
    children.push(rel.targetEntityId);
    edges.set(rel.sourceEntityId, children);
  }

  const state = new Map<string, "visiting" | "done">();
  const reportedCycles = new Set<string>();

  function visit(entityId: string, path: string[]): void {
    const status = state.get(entityId);
    if (status === "done") return;
    if (status === "visiting") {
      const cycleStart = path.indexOf(entityId);
      const cycle = [...path.slice(cycleStart), entityId];
      const signature = [...new Set(cycle)].sort().join(",");
      if (!reportedCycles.has(signature)) {
        reportedCycles.add(signature);
        const byId = new Map(model.entities.map((e) => [e.id, e.logicalName]));
        issues.push({
          severity: "error",
          code: "circular-identifying-relationship",
          message: `Circular identifying relationship: ${cycle.map((id) => byId.get(id) ?? id).join(" -> ")}.`,
        });
      }
      return;
    }

    state.set(entityId, "visiting");
    for (const child of edges.get(entityId) ?? []) {
      visit(child, [...path, entityId]);
    }
    state.set(entityId, "done");
  }

  for (const entity of model.entities) {
    if (!state.has(entity.id)) visit(entity.id, []);
  }

  return issues;
}

// Structural invariants from /docs/schema-engine.md. Extend as new rules land.
export function validateModel(
  model: Model,
  reservedWords: string[] = DEFAULT_RESERVED_WORDS,
): ValidationIssue[] {
  return [
    ...checkStructural(model),
    ...checkDuplicateIndexes(model),
    ...checkReservedWords(model, reservedWords),
    ...checkCircularIdentifyingRelationships(model),
  ];
}

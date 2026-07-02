import type { Model } from "./types.js";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
  attributeId?: string;
}

// Structural invariants from /docs/schema-engine.md. Extend as new rules land.
export function validateModel(model: Model): ValidationIssue[] {
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

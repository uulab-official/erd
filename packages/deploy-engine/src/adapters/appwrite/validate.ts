import type { Model } from "@modelforge/schema-engine";
import type { ValidationIssue } from "@modelforge/sdk";

const APPWRITE_RESERVED_KEYS = new Set([
  "$id",
  "$createdAt",
  "$updatedAt",
  "$permissions",
  "$collectionId",
  "$databaseId",
  "$sequence",
]);

// Appwrite-specific constraints beyond the generic ones in schema-engine's validateModel.
// See "플랫폼 제약 검증" in /docs/adapters.md.
export function validateForAppwrite(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of model.entities) {
    for (const attr of entity.attributes) {
      if (APPWRITE_RESERVED_KEYS.has(attr.name)) {
        issues.push({
          severity: "error",
          code: "appwrite-reserved-key",
          message: `Attribute "${attr.name}" on "${entity.logicalName}" collides with an Appwrite system field.`,
        });
      }
    }

    if (entity.attributes.filter((a) => a.isPrimaryKey).length > 1) {
      issues.push({
        severity: "warning",
        code: "appwrite-composite-pk",
        message: `Entity "${entity.logicalName}" has a composite primary key — Appwrite will enforce it via a unique index instead of a native composite key.`,
      });
    }
  }

  return issues;
}

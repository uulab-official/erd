import type { Model } from "@modelforge/schema-engine";
import type { ValidationIssue } from "@modelforge/sdk";

const POSTGRES_IDENTIFIER_LIMIT = 63;

// PostgreSQL-specific constraints beyond the generic ones in schema-engine's
// validateModel. See "플랫폼 제약 검증" in /docs/adapters.md.
export function validateForPostgres(model: Model): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const entity of model.entities) {
    if (entity.physicalName.length > POSTGRES_IDENTIFIER_LIMIT) {
      issues.push({
        severity: "error",
        code: "postgres-identifier-too-long",
        message: `Table name "${entity.physicalName}" exceeds PostgreSQL's ${POSTGRES_IDENTIFIER_LIMIT}-character identifier limit.`,
      });
    }
    for (const attr of entity.attributes) {
      if (attr.name.length > POSTGRES_IDENTIFIER_LIMIT) {
        issues.push({
          severity: "error",
          code: "postgres-identifier-too-long",
          message: `Column name "${attr.name}" on "${entity.logicalName}" exceeds PostgreSQL's ${POSTGRES_IDENTIFIER_LIMIT}-character identifier limit.`,
        });
      }
    }
  }

  return issues;
}

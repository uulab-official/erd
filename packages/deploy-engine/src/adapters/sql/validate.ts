import type { Model } from "@modelforge/schema-engine";
import type { ValidationIssue } from "@modelforge/sdk";

// Dialect-specific constraints beyond the generic ones in schema-engine's validateModel.
// See "플랫폼 제약 검증" in /docs/adapters.md.
function createIdentifierLengthValidator(
  dialectName: string,
  limit: number,
): (model: Model) => ValidationIssue[] {
  return (model) => {
    const issues: ValidationIssue[] = [];
    for (const entity of model.entities) {
      if (entity.physicalName.length > limit) {
        issues.push({
          severity: "error",
          code: `${dialectName}-identifier-too-long`,
          message: `Table name "${entity.physicalName}" exceeds ${dialectName}'s ${limit}-character identifier limit.`,
        });
      }
      for (const attr of entity.attributes) {
        if (attr.name.length > limit) {
          issues.push({
            severity: "error",
            code: `${dialectName}-identifier-too-long`,
            message: `Column name "${attr.name}" on "${entity.logicalName}" exceeds ${dialectName}'s ${limit}-character identifier limit.`,
          });
        }
      }
    }
    return issues;
  };
}

export const validateForPostgres = createIdentifierLengthValidator("postgres", 63);
export const validateForMySql = createIdentifierLengthValidator("mysql", 64);
// SQLite doesn't meaningfully limit identifier length, so there's nothing dialect-specific
// to check beyond the generic validateModel rules.
export function validateForSQLite(_model: Model): ValidationIssue[] {
  return [];
}

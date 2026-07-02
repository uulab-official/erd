import type { Model } from "@modelforge/schema-engine";
import type { MigrationPlan, MigrationStep } from "@modelforge/sdk";
import type { SqlDialect } from "./dialect.js";
import { toNativeSchema } from "./toNativeSchema.js";

let counter = 0;
function nextPlanId(): string {
  counter += 1;
  return `sql_plan_${counter}`;
}

// Structural diff between the current model and the last deployed snapshot, expressed
// as an ordered MigrationPlan with rendered SQL per step. Mirrors planAppwriteDeployment's
// shape so both adapters plug into the same Deploy Plan UI.
export function planSqlDeployment(
  current: Model,
  deployedSnapshot: Model | null,
  dialect: SqlDialect,
): MigrationPlan {
  const currentSchema = toNativeSchema(current, dialect);
  const deployedSchema = deployedSnapshot
    ? toNativeSchema(deployedSnapshot, dialect)
    : { tables: [] };
  const steps: MigrationStep[] = [];
  const q = dialect.quoteIdentifier;

  const deployedByName = new Map(deployedSchema.tables.map((t) => [t.name, t]));

  for (const table of currentSchema.tables) {
    const deployed = deployedByName.get(table.name);
    if (!deployed) {
      steps.push({
        action: "create-table",
        target: table.name,
        sql: dialect.createTableDDL(table),
        destructive: false,
      });
      for (const index of table.indexes) {
        steps.push({
          action: "create-index",
          target: `${table.name}.${index.name}`,
          sql: dialect.createIndexDDL(index, table.name),
          destructive: false,
        });
      }
      for (const fk of table.foreignKeys) {
        steps.push({
          action: "create-relationship",
          target: `${table.name}.${fk.name}`,
          sql: dialect.foreignKeyDDL(fk, table.name),
          destructive: false,
        });
      }
      continue;
    }

    const deployedColumns = new Map(deployed.columns.map((c) => [c.name, c]));
    for (const column of table.columns) {
      const existing = deployedColumns.get(column.name);
      if (!existing) {
        steps.push({
          action: "add-attribute",
          target: `${table.name}.${column.name}`,
          sql: `ALTER TABLE ${q(table.name)} ADD COLUMN ${dialect.columnDDL(column)};`,
          destructive: false,
        });
      } else if (JSON.stringify(existing) !== JSON.stringify(column)) {
        steps.push({
          action: "alter-attribute",
          target: `${table.name}.${column.name}`,
          sql: `ALTER TABLE ${q(table.name)} ALTER COLUMN ${q(column.name)} TYPE ${column.type};`,
          destructive: false,
          warning: "Narrowing an existing column's type can fail or truncate data",
        });
      }
    }
    const currentColumnNames = new Set(table.columns.map((c) => c.name));
    for (const column of deployed.columns) {
      if (!currentColumnNames.has(column.name)) {
        steps.push({
          action: "drop-attribute",
          target: `${table.name}.${column.name}`,
          sql: `ALTER TABLE ${q(table.name)} DROP COLUMN ${q(column.name)};`,
          destructive: true,
          warning: "This permanently deletes any data stored in this column",
        });
      }
    }

    const deployedIndexes = new Map(deployed.indexes.map((i) => [i.name, i]));
    for (const index of table.indexes) {
      if (!deployedIndexes.has(index.name)) {
        steps.push({
          action: "create-index",
          target: `${table.name}.${index.name}`,
          sql: dialect.createIndexDDL(index, table.name),
          destructive: false,
        });
      }
    }
    const currentIndexNames = new Set(table.indexes.map((i) => i.name));
    for (const index of deployed.indexes) {
      if (!currentIndexNames.has(index.name)) {
        steps.push({
          action: "drop-index",
          target: `${table.name}.${index.name}`,
          sql: `DROP INDEX ${q(index.name)};`,
          destructive: true,
        });
      }
    }

    const deployedFks = new Map(deployed.foreignKeys.map((fk) => [fk.name, fk]));
    for (const fk of table.foreignKeys) {
      if (!deployedFks.has(fk.name)) {
        steps.push({
          action: "create-relationship",
          target: `${table.name}.${fk.name}`,
          sql: dialect.foreignKeyDDL(fk, table.name),
          destructive: false,
        });
      }
    }
    const currentFkNames = new Set(table.foreignKeys.map((fk) => fk.name));
    for (const fk of deployed.foreignKeys) {
      if (!currentFkNames.has(fk.name)) {
        steps.push({
          action: "drop-relationship",
          target: `${table.name}.${fk.name}`,
          sql: `ALTER TABLE ${q(table.name)} DROP CONSTRAINT ${q(fk.name)};`,
          destructive: true,
        });
      }
    }
  }

  const currentTableNames = new Set(currentSchema.tables.map((t) => t.name));
  for (const table of deployedSchema.tables) {
    if (!currentTableNames.has(table.name)) {
      steps.push({
        action: "drop-table",
        target: table.name,
        sql: `DROP TABLE ${q(table.name)};`,
        destructive: true,
        warning: "This permanently deletes the table and all its data",
      });
    }
  }

  return { id: nextPlanId(), adapterKind: "postgresql", steps };
}

// Best-effort inverse, same policy as rollbackAppwritePlan: creates invert cleanly to
// their matching drop; drops/alters are flagged for manual restore since data can't be
// un-deleted automatically.
export function rollbackSqlPlan(plan: MigrationPlan): MigrationPlan {
  const steps = [...plan.steps].reverse().map(rollbackStep);
  return { id: nextPlanId(), adapterKind: "postgresql", steps };
}

function rollbackStep(step: MigrationStep): MigrationStep {
  switch (step.action) {
    case "create-table":
      return {
        action: "drop-table",
        target: step.target,
        destructive: true,
        warning: "Rolling back a create-table permanently deletes the table and its data",
      };
    case "add-attribute":
      return { action: "drop-attribute", target: step.target, destructive: true };
    case "create-relationship":
      return { action: "drop-relationship", target: step.target, destructive: true };
    case "create-index":
      return { action: "drop-index", target: step.target, destructive: false };
    default:
      return {
        ...step,
        destructive: false,
        warning: [
          step.warning,
          "Cannot be automatically rolled back — restore from a Baseline/History snapshot instead.",
        ]
          .filter(Boolean)
          .join(" "),
      };
  }
}

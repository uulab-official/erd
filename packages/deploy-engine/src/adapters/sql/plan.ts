import type { AdapterKind } from "@modelforge/schema-engine";
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
      // When the dialect can't ALTER TABLE ADD CONSTRAINT (SQLite), the FK is already
      // inlined into the CREATE TABLE statement above — a separate step would just
      // duplicate it with an empty .sql.
      if (dialect.supportsAlterForeignKey) {
        for (const fk of table.foreignKeys) {
          steps.push({
            action: "create-relationship",
            target: `${table.name}.${fk.name}`,
            sql: dialect.foreignKeyDDL(fk, table.name),
            destructive: false,
          });
        }
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
        const warnings = ["Narrowing an existing column's type can fail or truncate data"];
        // The generic ALTER COLUMN ... TYPE statement below only ever carries the bare
        // dialect type (e.g. "integer") — it can't express turning auto-increment on or
        // off, since that's not a type change in any of the three dialects (PostgreSQL:
        // swap the type to/from serial and wire up a sequence; MySQL: MODIFY COLUMN ...
        // AUTO_INCREMENT; SQLite: column defs are immutable, requires rebuilding the
        // table). Flag it rather than silently emitting a no-op-for-that-purpose ALTER,
        // the same "don't guess, warn" policy already used for SQLite's FK ALTER
        // limitation below.
        if (Boolean(existing.autoIncrement) !== Boolean(column.autoIncrement)) {
          warnings.push(
            `Toggling auto-increment on an existing column isn't captured by this statement — apply it manually (${
              dialect.name === "postgresql"
                ? "create a sequence and set it as the column's default"
                : dialect.name === "mysql"
                  ? "ALTER TABLE ... MODIFY COLUMN ... AUTO_INCREMENT"
                  : "SQLite requires rebuilding the table to change a column definition"
            }).`,
          );
        }
        steps.push({
          action: "alter-attribute",
          target: `${table.name}.${column.name}`,
          sql: `ALTER TABLE ${q(table.name)} ALTER COLUMN ${q(column.name)} TYPE ${column.type};`,
          destructive: false,
          warning: warnings.join(" "),
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
        steps.push(
          dialect.supportsAlterForeignKey
            ? {
                action: "create-relationship",
                target: `${table.name}.${fk.name}`,
                sql: dialect.foreignKeyDDL(fk, table.name),
                destructive: false,
              }
            : {
                action: "create-relationship",
                target: `${table.name}.${fk.name}`,
                destructive: false,
                warning: `${dialect.name} does not support adding foreign keys via ALTER TABLE — recreate "${table.name}" to add this constraint`,
              },
        );
      }
    }
    const currentFkNames = new Set(table.foreignKeys.map((fk) => fk.name));
    for (const fk of deployed.foreignKeys) {
      if (!currentFkNames.has(fk.name)) {
        steps.push(
          dialect.supportsAlterForeignKey
            ? {
                action: "drop-relationship",
                target: `${table.name}.${fk.name}`,
                sql: `ALTER TABLE ${q(table.name)} DROP CONSTRAINT ${q(fk.name)};`,
                destructive: true,
              }
            : {
                action: "drop-relationship",
                target: `${table.name}.${fk.name}`,
                destructive: true,
                warning: `${dialect.name} does not support dropping foreign keys via ALTER TABLE — recreate "${table.name}" without this constraint`,
              },
        );
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

  return { id: nextPlanId(), adapterKind: dialect.name as AdapterKind, steps };
}

// Best-effort inverse, same policy as rollbackAppwritePlan: creates invert cleanly to
// their matching drop; drops/alters are flagged for manual restore since data can't be
// un-deleted automatically.
export function rollbackSqlPlan(plan: MigrationPlan): MigrationPlan {
  const steps = [...plan.steps].reverse().map(rollbackStep);
  return { id: nextPlanId(), adapterKind: plan.adapterKind, steps };
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

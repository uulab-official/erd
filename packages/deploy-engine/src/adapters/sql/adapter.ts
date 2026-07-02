import type { AdapterKind, Model } from "@modelforge/schema-engine";
import type {
  AdapterCredentials,
  DatabaseAdapter,
  DeployResult,
  MigrationPlan,
  MigrationStep,
  ValidationIssue,
} from "@modelforge/sdk";
import { createMySqlDialect } from "./mysql.js";
import { createPostgresDialect, type SqlDialect } from "./dialect.js";
import { createSQLiteDialect } from "./sqlite.js";
import { fromNativeSchema } from "./fromNativeSchema.js";
import { planSqlDeployment, rollbackSqlPlan } from "./plan.js";
import { toNativeSchema } from "./toNativeSchema.js";
import type { SqlNativeSchema } from "./types.js";
import { validateForMySql, validateForPostgres, validateForSQLite } from "./validate.js";

// Same trust boundary as AppwriteAdminAPI (packages/deploy-engine/src/adapters/appwrite/
// adapter.ts): executing DDL against a real database instance needs a server-side
// connection (credentials, network access to the DB) that never belongs in the browser.
// createSqlAdapter never runs SQL itself — it only drives whatever SqlExecutor the
// caller injects.
export interface SqlExecutor {
  execute(sql: string, step: MigrationStep): Promise<void>;
}

function createSqlAdapter(
  kind: AdapterKind,
  dialect: SqlDialect,
  executor: SqlExecutor,
  validate: (model: Model) => ValidationIssue[],
): DatabaseAdapter<SqlNativeSchema> {
  return {
    kind,
    toNativeSchema: (model) => toNativeSchema(model, dialect),
    fromNativeSchema: (native) => fromNativeSchema(native, dialect),
    plan: (current, deployedSnapshot) => planSqlDeployment(current, deployedSnapshot, dialect),
    rollbackPlan: rollbackSqlPlan,
    mapType: (type, length, scale) => dialect.mapType(type, length, scale),
    validate,
    async apply(plan: MigrationPlan, _credentials: AdapterCredentials): Promise<DeployResult> {
      const appliedSteps: string[] = [];
      for (const step of plan.steps) {
        if (!step.sql) continue;
        try {
          await executor.execute(step.sql, step);
          appliedSteps.push(step.target);
        } catch (error) {
          return {
            planId: plan.id,
            appliedSteps,
            failedStep: { step, error: error instanceof Error ? error.message : String(error) },
          };
        }
      }
      return { planId: plan.id, appliedSteps };
    },
  };
}

export function createPostgreSQLAdapter(
  executor: SqlExecutor,
  dialect: SqlDialect = createPostgresDialect(),
): DatabaseAdapter<SqlNativeSchema> {
  return createSqlAdapter("postgresql", dialect, executor, validateForPostgres);
}

export function createMySQLAdapter(
  executor: SqlExecutor,
  dialect: SqlDialect = createMySqlDialect(),
): DatabaseAdapter<SqlNativeSchema> {
  return createSqlAdapter("mysql", dialect, executor, validateForMySql);
}

export function createSQLiteAdapter(
  executor: SqlExecutor,
  dialect: SqlDialect = createSQLiteDialect(),
): DatabaseAdapter<SqlNativeSchema> {
  return createSqlAdapter("sqlite", dialect, executor, validateForSQLite);
}

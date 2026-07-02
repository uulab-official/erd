import type {
  AdapterCredentials,
  DatabaseAdapter,
  DeployResult,
  MigrationPlan,
  MigrationStep,
} from "@modelforge/sdk";
import { createPostgresDialect, type SqlDialect } from "./dialect.js";
import { fromNativeSchema } from "./fromNativeSchema.js";
import { planSqlDeployment, rollbackSqlPlan } from "./plan.js";
import { toNativeSchema } from "./toNativeSchema.js";
import type { SqlNativeSchema } from "./types.js";
import { validateForPostgres } from "./validate.js";

// Same trust boundary as AppwriteAdminAPI (packages/deploy-engine/src/adapters/appwrite/
// adapter.ts): executing DDL against a real Postgres instance needs a server-side
// connection (credentials, network access to the DB) that never belongs in the browser.
// createPostgreSQLAdapter never runs SQL itself — it only drives whatever SqlExecutor the
// caller injects.
export interface SqlExecutor {
  execute(sql: string, step: MigrationStep): Promise<void>;
}

export function createPostgreSQLAdapter(
  executor: SqlExecutor,
  dialect: SqlDialect = createPostgresDialect(),
): DatabaseAdapter<SqlNativeSchema> {
  return {
    kind: "postgresql",
    toNativeSchema: (model) => toNativeSchema(model, dialect),
    fromNativeSchema: (native) => fromNativeSchema(native, dialect),
    plan: (current, deployedSnapshot) => planSqlDeployment(current, deployedSnapshot, dialect),
    rollbackPlan: rollbackSqlPlan,
    mapType: (type, length, scale) => dialect.mapType(type, length, scale),
    validate: validateForPostgres,
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

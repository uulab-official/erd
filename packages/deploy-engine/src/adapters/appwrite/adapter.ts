import type {
  AdapterCredentials,
  DatabaseAdapter,
  DeployResult,
  MigrationPlan,
  MigrationStep,
} from "@modelforge/sdk";
import { fromNativeSchema } from "./fromNativeSchema.js";
import { planAppwriteDeployment, rollbackAppwritePlan } from "./plan.js";
import { toNativeSchema } from "./toNativeSchema.js";
import { mapColumnTypeToAppwrite } from "./typeMap.js";
import type { AppwriteNativeSchema } from "./types.js";
import { validateForAppwrite } from "./validate.js";

// The actual Appwrite SDK calls (createCollection, createStringAttribute, ...) must run
// server-side with an API key — typically inside an Appwrite Function — never from the
// browser. This interface is that trust boundary: createAppwriteAdapter never talks to
// Appwrite directly, it only drives whatever AppwriteAdminAPI implementation the caller
// injects (a real one backed by node-appwrite in production, a fake one in tests).
export interface AppwriteAdminAPI {
  createCollection(step: MigrationStep): Promise<void>;
  dropCollection(step: MigrationStep): Promise<void>;
  addAttribute(step: MigrationStep): Promise<void>;
  dropAttribute(step: MigrationStep): Promise<void>;
  alterAttribute(step: MigrationStep): Promise<void>;
  createRelationship(step: MigrationStep): Promise<void>;
  dropRelationship(step: MigrationStep): Promise<void>;
  createIndex(step: MigrationStep): Promise<void>;
  dropIndex(step: MigrationStep): Promise<void>;
}

async function dispatchStep(api: AppwriteAdminAPI, step: MigrationStep): Promise<void> {
  switch (step.action) {
    case "create-collection":
      return api.createCollection(step);
    case "drop-collection":
      return api.dropCollection(step);
    case "add-attribute":
      return api.addAttribute(step);
    case "drop-attribute":
      return api.dropAttribute(step);
    case "alter-attribute":
      return api.alterAttribute(step);
    case "create-relationship":
      return api.createRelationship(step);
    case "drop-relationship":
      return api.dropRelationship(step);
    case "create-index":
      return api.createIndex(step);
    case "drop-index":
      return api.dropIndex(step);
    case "create-table":
      throw new Error(
        '"create-table" is not a valid Appwrite step — this indicates a planning bug',
      );
  }
}

export function createAppwriteAdapter(
  adminApi: AppwriteAdminAPI,
): DatabaseAdapter<AppwriteNativeSchema> {
  return {
    kind: "appwrite",
    toNativeSchema,
    fromNativeSchema,
    plan: planAppwriteDeployment,
    rollbackPlan: rollbackAppwritePlan,
    mapType: (type) => mapColumnTypeToAppwrite(type),
    validate: validateForAppwrite,
    async apply(plan: MigrationPlan, _credentials: AdapterCredentials): Promise<DeployResult> {
      const appliedSteps: string[] = [];
      for (const step of plan.steps) {
        try {
          await dispatchStep(adminApi, step);
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

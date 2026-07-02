import type { Client } from "node-appwrite";
import { createAdminApi, createAttributeOrRelationship } from "./adminApi.js";
import type {
  AppwriteCollectionDef,
  AppwriteIndexDef,
  AppwriteRelationshipAttributeDef,
  DeployResult,
  MigrationPlan,
  MigrationStep,
} from "./types.js";
import { isRelationshipAttribute } from "./types.js";

interface WorkItem {
  target: string;
  step: MigrationStep;
  run: () => Promise<void>;
}

// Appwrite has no "create these two collections and link them atomically" primitive, so
// a brand-new schema with relationships must be applied in dependency order by hand:
//
//   1. every collection shell + its plain (non-relationship) attributes + indexes
//   2. independent per-collection edits (add/alter/drop attribute, create/drop index,
//      drop-relationship — none of these depend on another collection existing)
//   3. every relationship attribute — both standalone create-relationship steps and the
//      ones bundled inside a brand-new collection's attribute list — now safe because
//      every collection from phase 1 exists
//   4. drop-collection last, so nothing in this same plan still points at a collection
//      being removed
//
// planAppwriteDeployment (packages/deploy-engine) bundles a new collection's relationship
// attributes into its single create-collection step rather than emitting them as separate
// steps — phase 1 below is what splits them back out into deferred phase-3 work.
function buildExecutionPlan(
  steps: MigrationStep[],
  api: ReturnType<typeof createAdminApi>,
): WorkItem[] {
  const phase1: WorkItem[] = [];
  const phase2: WorkItem[] = [];
  const phase3: WorkItem[] = [];
  const phase4: WorkItem[] = [];

  for (const step of steps) {
    switch (step.action) {
      case "create-collection": {
        const collection = step.appwriteCall as AppwriteCollectionDef;
        phase1.push({
          target: step.target,
          step,
          run: () => api.createCollectionShell(collection),
        });
        for (const attr of collection.attributes) {
          if (isRelationshipAttribute(attr)) {
            phase3.push({
              target: `${collection.id}.${attr.key}`,
              step,
              run: () => api.createRelationshipAttribute(collection.id, attr),
            });
          } else {
            phase1.push({
              target: `${collection.id}.${attr.key}`,
              step,
              run: () => api.createPlainAttribute(collection.id, attr),
            });
          }
        }
        for (const index of collection.indexes) {
          phase1.push({
            target: `${collection.id}.${index.key}`,
            step,
            run: () => api.createIndex(collection.id, index),
          });
        }
        break;
      }
      case "add-attribute": {
        const [collectionId] = step.target.split(".");
        phase2.push({
          target: step.target,
          step,
          run: () => createAttributeOrRelationship(api, collectionId!, step.appwriteCall as never),
        });
        break;
      }
      case "alter-attribute": {
        const [collectionId, key] = step.target.split(".");
        phase2.push({
          target: step.target,
          step,
          run: () => api.alterAttribute(collectionId!, step.appwriteCall as never),
        });
        void key;
        break;
      }
      case "drop-attribute":
      case "drop-relationship": {
        const [collectionId, key] = step.target.split(".");
        phase2.push({
          target: step.target,
          step,
          run: () => api.deleteAttribute(collectionId!, key!),
        });
        break;
      }
      case "create-index": {
        const [collectionId] = step.target.split(".");
        phase2.push({
          target: step.target,
          step,
          run: () => api.createIndex(collectionId!, step.appwriteCall as AppwriteIndexDef),
        });
        break;
      }
      case "drop-index": {
        const [collectionId, key] = step.target.split(".");
        phase2.push({
          target: step.target,
          step,
          run: () => api.deleteIndex(collectionId!, key!),
        });
        break;
      }
      case "create-relationship": {
        const [collectionId] = step.target.split(".");
        phase3.push({
          target: step.target,
          step,
          run: () =>
            api.createRelationshipAttribute(
              collectionId!,
              step.appwriteCall as AppwriteRelationshipAttributeDef,
            ),
        });
        break;
      }
      case "drop-collection": {
        phase4.push({
          target: step.target,
          step,
          run: () => api.deleteCollection(step.target),
        });
        break;
      }
      case "create-table":
      case "drop-table":
        // SQL-only actions — this Function only speaks Appwrite's Databases API.
        break;
    }
  }

  return [...phase1, ...phase2, ...phase3, ...phase4];
}

export async function applyPlan(
  client: Client,
  databaseId: string,
  plan: MigrationPlan,
): Promise<DeployResult> {
  const api = createAdminApi(client, databaseId);
  const workItems = buildExecutionPlan(plan.steps, api);

  const appliedSteps: string[] = [];
  for (const item of workItems) {
    try {
      await item.run();
      appliedSteps.push(item.target);
    } catch (error) {
      return {
        planId: plan.id,
        appliedSteps,
        failedStep: {
          step: item.step,
          error: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }

  return { planId: plan.id, appliedSteps };
}

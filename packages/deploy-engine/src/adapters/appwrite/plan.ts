import type { Model } from "@modelforge/schema-engine";
import type { MigrationPlan, MigrationStep } from "@modelforge/sdk";
import { toNativeSchema } from "./toNativeSchema.js";
import { isRelationshipAttribute } from "./types.js";

let counter = 0;
function nextPlanId(): string {
  counter += 1;
  return `plan_${counter}`;
}

// Structural diff between the current model and the last deployed snapshot, expressed
// as an ordered MigrationPlan. See "Diff Engine 결과를 플랫폼 실행 계획으로 변환" in
// /docs/adapters.md — this is the Appwrite-specific half of that translation.
export function planAppwriteDeployment(
  current: Model,
  deployedSnapshot: Model | null,
): MigrationPlan {
  const currentSchema = toNativeSchema(current);
  const deployedSchema = deployedSnapshot ? toNativeSchema(deployedSnapshot) : { collections: [] };
  const steps: MigrationStep[] = [];

  const deployedById = new Map(deployedSchema.collections.map((c) => [c.id, c]));

  for (const collection of currentSchema.collections) {
    const deployed = deployedById.get(collection.id);
    if (!deployed) {
      steps.push({
        action: "create-collection",
        target: collection.id,
        appwriteCall: collection,
        destructive: false,
      });
      continue;
    }

    const deployedAttrs = new Map(deployed.attributes.map((a) => [a.key, a]));
    for (const attr of collection.attributes) {
      const existing = deployedAttrs.get(attr.key);
      if (!existing) {
        steps.push({
          action: isRelationshipAttribute(attr) ? "create-relationship" : "add-attribute",
          target: `${collection.id}.${attr.key}`,
          appwriteCall: attr,
          destructive: false,
        });
      } else if (JSON.stringify(existing) !== JSON.stringify(attr)) {
        steps.push({
          action: "alter-attribute",
          target: `${collection.id}.${attr.key}`,
          appwriteCall: attr,
          destructive: false,
          warning:
            "Appwrite may require dropping and recreating this attribute for some type changes",
        });
      }
    }
    const currentAttrKeys = new Set(collection.attributes.map((a) => a.key));
    for (const attr of deployed.attributes) {
      if (!currentAttrKeys.has(attr.key)) {
        steps.push({
          action: isRelationshipAttribute(attr) ? "drop-relationship" : "drop-attribute",
          target: `${collection.id}.${attr.key}`,
          destructive: true,
          warning: "This permanently deletes any data stored in this attribute",
        });
      }
    }

    const deployedIndexes = new Map(deployed.indexes.map((i) => [i.key, i]));
    for (const index of collection.indexes) {
      if (!deployedIndexes.has(index.key)) {
        steps.push({
          action: "create-index",
          target: `${collection.id}.${index.key}`,
          appwriteCall: index,
          destructive: false,
        });
      }
    }
    const currentIndexKeys = new Set(collection.indexes.map((i) => i.key));
    for (const index of deployed.indexes) {
      if (!currentIndexKeys.has(index.key)) {
        steps.push({
          action: "drop-index",
          target: `${collection.id}.${index.key}`,
          destructive: true,
        });
      }
    }
  }

  return { id: nextPlanId(), adapterKind: "appwrite", steps };
}

// Best-effort inverse: creates invert cleanly to their matching drop step, but drops and
// alters cannot restore deleted data automatically — those are flagged for manual restore
// from a Baseline/History snapshot instead. See "Rollback 생성" in /docs/adapters.md.
export function rollbackAppwritePlan(plan: MigrationPlan): MigrationPlan {
  const steps = [...plan.steps].reverse().map(rollbackStep);
  return { id: nextPlanId(), adapterKind: "appwrite", steps };
}

function rollbackStep(step: MigrationStep): MigrationStep {
  switch (step.action) {
    case "create-collection":
      return {
        action: "drop-collection",
        target: step.target,
        destructive: true,
        warning: "Rolling back a create-collection permanently deletes the collection and its data",
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

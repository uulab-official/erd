import { useMemo, useState } from "react";
import { planAppwriteDeployment } from "@modelforge/deploy-engine";
import { diffModels } from "@modelforge/diff-engine";
import type { DeployResult } from "@modelforge/sdk";
import { useEditorStore } from "../store/useEditorStore.js";
import { canDeploy, deployPlan } from "../lib/appwrite.js";
import { GovernancePanel } from "./GovernancePanel.js";

type Tab = "validation" | "diff" | "history" | "deploy" | "governance";

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("validation");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<DeployResult | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const { model, savedModel, issues, historyLog, jumpToHistory, markDeployed } = useEditorStore();

  // Deploy Plan is scoped to what actually changed since the last save/deploy —
  // not a from-scratch plan — so it stays a true preview of applying the pending diff.
  const plan = useMemo(() => planAppwriteDeployment(model, savedModel), [model, savedModel]);
  const diff = useMemo(() => diffModels(savedModel, model), [savedModel, model]);
  const diffCount = diff.added.length + diff.removed.length + diff.changed.length;

  async function handleDeploy() {
    const destructiveCount = plan.steps.filter((s) => s.destructive).length;
    const message =
      destructiveCount > 0
        ? `This will apply ${plan.steps.length} step(s) to your live Appwrite project, including ${destructiveCount} DESTRUCTIVE step(s) that permanently delete data. Continue?`
        : `This will apply ${plan.steps.length} step(s) to your live Appwrite project. Continue?`;
    if (!window.confirm(message)) return;

    setDeploying(true);
    setDeployError(null);
    setDeployResult(null);
    try {
      const result = await deployPlan(plan);
      setDeployResult(result);
      if (!result.failedStep) markDeployed();
    } catch (error) {
      setDeployError(error instanceof Error ? error.message : String(error));
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="h-48 overflow-y-auto border-t border-neutral-200 bg-white text-sm">
      <div className="flex gap-4 border-b border-neutral-200 px-4 py-1">
        <button
          className={tab === "validation" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("validation")}
        >
          Validation {issues.length > 0 && `(${issues.length})`}
        </button>
        <button
          className={tab === "diff" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("diff")}
        >
          Diff {diffCount > 0 && `(${diffCount})`}
        </button>
        <button
          className={tab === "history" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("history")}
        >
          History ({historyLog.length})
        </button>
        <button
          className={tab === "deploy" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("deploy")}
        >
          Deploy Plan ({plan.steps.length})
        </button>
        <button
          className={tab === "governance" ? "font-semibold" : "text-neutral-500"}
          onClick={() => setTab("governance")}
        >
          Governance
        </button>
      </div>

      {tab === "validation" && (
        <ul className="p-4">
          {issues.length === 0 && <li className="text-neutral-400">No issues.</li>}
          {issues.map((issue, i) => (
            <li key={i} className={issue.severity === "error" ? "text-red-600" : "text-amber-600"}>
              [{issue.severity}] {issue.message}
            </li>
          ))}
        </ul>
      )}

      {tab === "diff" && (
        <ul className="p-4">
          {diffCount === 0 && <li className="text-neutral-400">No changes since the last save.</li>}
          {diff.added.map((name) => (
            <li key={`added-${name}`} className="text-green-700">
              + {name} created
            </li>
          ))}
          {diff.removed.map((name) => (
            <li key={`removed-${name}`} className="text-red-600">
              - {name} deleted
            </li>
          ))}
          {diff.changed.map((name) => (
            <li key={`changed-${name}`} className="text-amber-600">
              ~ {name} changed
            </li>
          ))}
        </ul>
      )}

      {tab === "history" && (
        <ul className="p-4">
          {historyLog.length === 0 && <li className="text-neutral-400">No history yet.</li>}
          {[...historyLog].reverse().map((label, i) => {
            const index = historyLog.length - 1 - i;
            return (
              <li key={index}>
                <button className="hover:underline" onClick={() => jumpToHistory(index)}>
                  {index + 1}. {label}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {tab === "deploy" && (
        <div className="p-4">
          {canDeploy && plan.steps.length > 0 && (
            <button
              className="mb-2 rounded bg-red-600 px-3 py-1 text-white disabled:opacity-50"
              onClick={() => void handleDeploy()}
              disabled={deploying}
            >
              {deploying ? "Deploying…" : "Deploy to Appwrite"}
            </button>
          )}
          {!canDeploy && (
            <p className="mb-2 text-xs text-neutral-400">
              Deploy is not configured — set VITE_APPWRITE_DEPLOY_FUNCTION_ID (see
              functions/deploy-appwrite/README.md).
            </p>
          )}
          {deployError && <p className="mb-2 text-red-600">Deploy failed: {deployError}</p>}
          {deployResult?.failedStep && (
            <p className="mb-2 text-red-600">
              Stopped at "{deployResult.failedStep.step.target}": {deployResult.failedStep.error}
            </p>
          )}
          {deployResult && !deployResult.failedStep && (
            <p className="mb-2 text-green-700">
              Deployed {deployResult.appliedSteps.length} step(s) successfully.
            </p>
          )}
          <ul>
            {plan.steps.length === 0 && <li className="text-neutral-400">Nothing to deploy.</li>}
            {plan.steps.map((step, i) => (
              <li key={i} className={step.destructive ? "text-red-600" : ""}>
                {step.action}: {step.target}
                {step.warning && <span className="text-neutral-400"> — {step.warning}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "governance" && <GovernancePanel />}
    </div>
  );
}

import { useMemo, useState } from "react";
import { planAppwriteDeployment } from "@modelforge/deploy-engine";
import { diffModels } from "@modelforge/diff-engine";
import type { DeployResult } from "@modelforge/sdk";
import { Button, Tabs } from "@modelforge/ui";
import { useEditorStore } from "../store/useEditorStore.js";
import { canDeploy, deployPlan } from "../lib/appwrite.js";
import { GovernancePanel } from "./GovernancePanel.js";
import { VersionsPanel } from "./VersionsPanel.js";

type Tab = "validation" | "diff" | "history" | "deploy" | "governance" | "versions";

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
    <div className="flex h-64 flex-col border-t border-slate-200 bg-white text-sm">
      <Tabs
        items={[
          { id: "validation", label: "Validation", count: issues.length },
          { id: "diff", label: "Diff", count: diffCount },
          { id: "history", label: "History", count: historyLog.length },
          { id: "deploy", label: "Deploy Plan", count: plan.steps.length },
          { id: "governance", label: "Governance" },
          { id: "versions", label: "Versions" },
        ]}
        activeId={tab}
        onChange={(id) => setTab(id as Tab)}
      />

      <div className="flex-1 overflow-y-auto">
        {tab === "validation" && (
          <ul className="flex flex-col gap-1 p-4">
            {issues.length === 0 && <li className="text-slate-400">No issues.</li>}
            {issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2">
                <span
                  className={
                    "mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full " +
                    (issue.severity === "error" ? "bg-red-500" : "bg-amber-500")
                  }
                />
                <span className={issue.severity === "error" ? "text-red-700" : "text-amber-700"}>
                  {issue.message}
                </span>
              </li>
            ))}
          </ul>
        )}

        {tab === "diff" && (
          <ul className="flex flex-col gap-1 p-4">
            {diffCount === 0 && <li className="text-slate-400">No changes since the last save.</li>}
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
          <ul className="flex flex-col p-2">
            {historyLog.length === 0 && <li className="p-2 text-slate-400">No history yet.</li>}
            {[...historyLog].reverse().map((label, i) => {
              const index = historyLog.length - 1 - i;
              return (
                <li key={index}>
                  <button
                    className="w-full rounded px-2 py-1 text-left text-slate-700 hover:bg-slate-50"
                    onClick={() => jumpToHistory(index)}
                  >
                    <span className="mr-2 text-slate-400">{index + 1}.</span>
                    {label}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {tab === "deploy" && (
          <div className="p-4">
            {canDeploy && plan.steps.length > 0 && (
              <Button
                variant="danger"
                size="sm"
                className="mb-3"
                onClick={() => void handleDeploy()}
                disabled={deploying}
              >
                {deploying ? "Deploying…" : "Deploy to Appwrite"}
              </Button>
            )}
            {!canDeploy && (
              <p className="mb-3 text-xs text-slate-400">
                Deploy is not configured — set VITE_APPWRITE_DEPLOY_FUNCTION_ID (see
                functions/deploy-appwrite/README.md).
              </p>
            )}
            {deployError && <p className="mb-3 text-red-600">Deploy failed: {deployError}</p>}
            {deployResult?.failedStep && (
              <p className="mb-3 text-red-600">
                Stopped at "{deployResult.failedStep.step.target}": {deployResult.failedStep.error}
              </p>
            )}
            {deployResult && !deployResult.failedStep && (
              <p className="mb-3 text-green-700">
                Deployed {deployResult.appliedSteps.length} step(s) successfully.
              </p>
            )}
            <ul className="flex flex-col gap-1">
              {plan.steps.length === 0 && <li className="text-slate-400">Nothing to deploy.</li>}
              {plan.steps.map((step, i) => (
                <li key={i} className={step.destructive ? "text-red-600" : "text-slate-700"}>
                  <span className="font-mono text-xs text-slate-400">{step.action}</span>{" "}
                  {step.target}
                  {step.warning && <span className="text-slate-400"> — {step.warning}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "governance" && <GovernancePanel />}
        {tab === "versions" && <VersionsPanel />}
      </div>
    </div>
  );
}

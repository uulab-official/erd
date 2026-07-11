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
  const diffCount =
    diff.added.length +
    diff.removed.length +
    diff.changed.length +
    diff.enums.added.length +
    diff.enums.removed.length +
    diff.enums.changed.length +
    diff.relationships.added.length +
    diff.relationships.removed.length +
    diff.relationships.changed.length +
    diff.sequences.added.length +
    diff.sequences.removed.length +
    diff.sequences.changed.length +
    diff.views.added.length +
    diff.views.removed.length +
    diff.views.changed.length +
    diff.domains.added.length +
    diff.domains.removed.length +
    diff.domains.changed.length +
    diff.dictionary.added.length +
    diff.dictionary.removed.length +
    diff.dictionary.changed.length +
    diff.subjectAreas.added.length +
    diff.subjectAreas.removed.length +
    diff.subjectAreas.changed.length +
    diff.memos.added.length +
    diff.memos.removed.length +
    diff.memos.changed.length +
    (diff.namingRulesChanged ? 1 : 0);

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
            {diff.enums.added.map((id) => (
              <li key={`enum-added-${id}`} className="text-green-700">
                + enum {model.enums.find((e) => e.id === id)?.name ?? id} created
              </li>
            ))}
            {diff.enums.removed.map((id) => (
              <li key={`enum-removed-${id}`} className="text-red-600">
                - enum {savedModel.enums.find((e) => e.id === id)?.name ?? id} deleted
              </li>
            ))}
            {diff.enums.changed.map((id) => (
              <li key={`enum-changed-${id}`} className="text-amber-600">
                ~ enum {model.enums.find((e) => e.id === id)?.name ?? id} changed
              </li>
            ))}
            {diff.relationships.added.map((id) => (
              <li key={`rel-added-${id}`} className="text-green-700">
                + relationship {model.relationships.find((r) => r.id === id)?.name ?? id} created
              </li>
            ))}
            {diff.relationships.removed.map((id) => (
              <li key={`rel-removed-${id}`} className="text-red-600">
                - relationship {savedModel.relationships.find((r) => r.id === id)?.name ?? id}{" "}
                deleted
              </li>
            ))}
            {diff.relationships.changed.map((id) => (
              <li key={`rel-changed-${id}`} className="text-amber-600">
                ~ relationship {model.relationships.find((r) => r.id === id)?.name ?? id} changed
              </li>
            ))}
            {diff.sequences.added.map((id) => (
              <li key={`seq-added-${id}`} className="text-green-700">
                + sequence {model.sequences.find((s) => s.id === id)?.name ?? id} created
              </li>
            ))}
            {diff.sequences.removed.map((id) => (
              <li key={`seq-removed-${id}`} className="text-red-600">
                - sequence {savedModel.sequences.find((s) => s.id === id)?.name ?? id} deleted
              </li>
            ))}
            {diff.sequences.changed.map((id) => (
              <li key={`seq-changed-${id}`} className="text-amber-600">
                ~ sequence {model.sequences.find((s) => s.id === id)?.name ?? id} changed
              </li>
            ))}
            {diff.views.added.map((id) => (
              <li key={`view-added-${id}`} className="text-green-700">
                + view {model.views.find((v) => v.id === id)?.name ?? id} created
              </li>
            ))}
            {diff.views.removed.map((id) => (
              <li key={`view-removed-${id}`} className="text-red-600">
                - view {savedModel.views.find((v) => v.id === id)?.name ?? id} deleted
              </li>
            ))}
            {diff.views.changed.map((id) => (
              <li key={`view-changed-${id}`} className="text-amber-600">
                ~ view {model.views.find((v) => v.id === id)?.name ?? id} changed
              </li>
            ))}
            {diff.domains.added.map((id) => (
              <li key={`domain-added-${id}`} className="text-green-700">
                + domain {(model.domains ?? []).find((d) => d.id === id)?.name ?? id} created
              </li>
            ))}
            {diff.domains.removed.map((id) => (
              <li key={`domain-removed-${id}`} className="text-red-600">
                - domain {(savedModel.domains ?? []).find((d) => d.id === id)?.name ?? id} deleted
              </li>
            ))}
            {diff.domains.changed.map((id) => (
              <li key={`domain-changed-${id}`} className="text-amber-600">
                ~ domain {(model.domains ?? []).find((d) => d.id === id)?.name ?? id} changed
              </li>
            ))}
            {diff.dictionary.added.map((id) => (
              <li key={`dict-added-${id}`} className="text-green-700">
                + dictionary entry{" "}
                {(model.dictionary ?? []).find((d) => d.id === id)?.logicalTerm ?? id} created
              </li>
            ))}
            {diff.dictionary.removed.map((id) => (
              <li key={`dict-removed-${id}`} className="text-red-600">
                - dictionary entry{" "}
                {(savedModel.dictionary ?? []).find((d) => d.id === id)?.logicalTerm ?? id} deleted
              </li>
            ))}
            {diff.dictionary.changed.map((id) => (
              <li key={`dict-changed-${id}`} className="text-amber-600">
                ~ dictionary entry{" "}
                {(model.dictionary ?? []).find((d) => d.id === id)?.logicalTerm ?? id} changed
              </li>
            ))}
            {diff.subjectAreas.added.map((id) => (
              <li key={`subject-area-added-${id}`} className="text-green-700">
                + subject area {(model.subjectAreas ?? []).find((s) => s.id === id)?.name ?? id}{" "}
                created
              </li>
            ))}
            {diff.subjectAreas.removed.map((id) => (
              <li key={`subject-area-removed-${id}`} className="text-red-600">
                - subject area{" "}
                {(savedModel.subjectAreas ?? []).find((s) => s.id === id)?.name ?? id} deleted
              </li>
            ))}
            {diff.subjectAreas.changed.map((id) => (
              <li key={`subject-area-changed-${id}`} className="text-amber-600">
                ~ subject area {(model.subjectAreas ?? []).find((s) => s.id === id)?.name ?? id}{" "}
                changed
              </li>
            ))}
            {diff.memos.added.map((id) => (
              <li key={`memo-added-${id}`} className="text-green-700">
                + memo created
              </li>
            ))}
            {diff.memos.removed.map((id) => (
              <li key={`memo-removed-${id}`} className="text-red-600">
                - memo deleted
              </li>
            ))}
            {diff.memos.changed.map((id) => (
              <li key={`memo-changed-${id}`} className="text-amber-600">
                ~ memo changed
              </li>
            ))}
            {diff.namingRulesChanged && (
              <li key="naming-rules-changed" className="text-amber-600">
                ~ naming rules changed
              </li>
            )}
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

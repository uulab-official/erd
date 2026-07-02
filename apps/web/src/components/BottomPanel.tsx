import { useMemo, useState } from "react";
import { planAppwriteDeployment } from "@modelforge/deploy-engine";
import { diffModels } from "@modelforge/diff-engine";
import { useEditorStore } from "../store/useEditorStore.js";

type Tab = "validation" | "diff" | "history" | "deploy";

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("validation");
  const { model, savedModel, issues, historyLog, jumpToHistory } = useEditorStore();

  // Deploy Plan is scoped to what actually changed since the last save/deploy —
  // not a from-scratch plan — so it stays a true preview of applying the pending diff.
  const plan = useMemo(() => planAppwriteDeployment(model, savedModel), [model, savedModel]);
  const diff = useMemo(() => diffModels(savedModel, model), [savedModel, model]);
  const diffCount = diff.added.length + diff.removed.length + diff.changed.length;

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
        <ul className="p-4">
          {plan.steps.length === 0 && <li className="text-neutral-400">Nothing to deploy.</li>}
          {plan.steps.map((step, i) => (
            <li key={i} className={step.destructive ? "text-red-600" : ""}>
              {step.action}: {step.target}
              {step.warning && <span className="text-neutral-400"> — {step.warning}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

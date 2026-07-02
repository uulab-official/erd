import { useMemo, useState } from "react";
import { planAppwriteDeployment } from "@modelforge/deploy-engine";
import { useEditorStore } from "../store/useEditorStore.js";

type Tab = "validation" | "deploy";

export function BottomPanel() {
  const [tab, setTab] = useState<Tab>("validation");
  const { model, issues } = useEditorStore();

  const plan = useMemo(() => planAppwriteDeployment(model, null), [model]);

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

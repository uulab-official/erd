import { ErdCanvas } from "@modelforge/canvas";
import { Toolbar } from "./Toolbar.js";
import { BottomPanel } from "./BottomPanel.js";
import { useEditorStore } from "../store/useEditorStore.js";

export function Workspace() {
  const model = useEditorStore((state) => state.model);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <main className="flex-1 overflow-hidden">
        <ErdCanvas model={model} />
      </main>
      <BottomPanel />
    </div>
  );
}

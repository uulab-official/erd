import { ErdCanvas } from "@modelforge/canvas";
import { Toolbar } from "./Toolbar.js";
import { BottomPanel } from "./BottomPanel.js";
import { useEditorStore } from "../store/useEditorStore.js";

export function Workspace() {
  const { model, connectEntities } = useEditorStore();

  function handleConnectEntities(params: { sourceEntityId: string; targetEntityId: string }) {
    try {
      connectEntities(params.sourceEntityId, params.targetEntityId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <Toolbar />
      <main className="flex-1 overflow-hidden">
        <ErdCanvas model={model} onConnectEntities={handleConnectEntities} />
      </main>
      <BottomPanel />
    </div>
  );
}

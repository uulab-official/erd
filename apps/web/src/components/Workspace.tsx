import { ErdCanvas } from "@modelforge/canvas";
import { Toolbar } from "./Toolbar.js";
import { BottomPanel } from "./BottomPanel.js";
import { EntityInspector } from "./EntityInspector.js";
import { useEditorStore } from "../store/useEditorStore.js";
import { useSelectionStore } from "../store/useSelectionStore.js";

export function Workspace() {
  const { model, connectEntities } = useEditorStore();
  const selectedEntityId = useSelectionStore((state) => state.selectedEntityId);
  const selectEntity = useSelectionStore((state) => state.selectEntity);

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
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <ErdCanvas
            model={model}
            onConnectEntities={handleConnectEntities}
            onSelectEntity={selectEntity}
          />
        </main>
        {selectedEntityId && <EntityInspector />}
      </div>
      <BottomPanel />
    </div>
  );
}

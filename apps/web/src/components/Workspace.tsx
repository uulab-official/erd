import { ErdCanvas } from "@modelforge/canvas";
import { Toolbar } from "./Toolbar.js";
import { BottomPanel } from "./BottomPanel.js";
import { EntityInspector } from "./EntityInspector.js";
import { RelationshipInspector } from "./RelationshipInspector.js";
import { useEditorStore } from "../store/useEditorStore.js";
import { useSelectionStore } from "../store/useSelectionStore.js";

export function Workspace() {
  const { model, connectEntities, moveEntity, updateMemoText, moveMemo, deleteMemo } =
    useEditorStore();
  const selectedEntityId = useSelectionStore((state) => state.selectedEntityId);
  const selectedRelationshipId = useSelectionStore((state) => state.selectedRelationshipId);
  const selectEntity = useSelectionStore((state) => state.selectEntity);
  const selectRelationship = useSelectionStore((state) => state.selectRelationship);

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
            onSelectRelationship={selectRelationship}
            onMoveEntity={(params) => moveEntity(params.entityId, params.x, params.y)}
            onMoveMemo={(params) => moveMemo(params.memoId, params.x, params.y)}
            onUpdateMemoText={(params) => updateMemoText(params.memoId, params.text)}
            onDeleteMemo={deleteMemo}
          />
        </main>
        {selectedEntityId && <EntityInspector />}
        {selectedRelationshipId && <RelationshipInspector />}
      </div>
      <BottomPanel />
    </div>
  );
}

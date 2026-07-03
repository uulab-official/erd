import { create } from "zustand";

interface SelectionState {
  // The Entity currently shown in the Inspector side panel — null means the panel is
  // closed. Deliberately local/ephemeral UI state (not persisted, not undo-able), since
  // "which entity you're looking at" isn't part of the Model.
  selectedEntityId: string | null;
  selectEntity(entityId: string | null): void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedEntityId: null,
  selectEntity(entityId) {
    set({ selectedEntityId: entityId });
  },
}));

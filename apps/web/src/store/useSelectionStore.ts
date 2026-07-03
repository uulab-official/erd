import { create } from "zustand";

interface SelectionState {
  // What the Inspector side panel is showing — at most one of these is non-null at a
  // time (clicking an entity closes the relationship inspector and vice versa), and
  // both null means the panel is closed. Deliberately local/ephemeral UI state (not
  // persisted, not undo-able), since "what you're looking at" isn't part of the Model.
  selectedEntityId: string | null;
  selectedRelationshipId: string | null;
  selectEntity(entityId: string | null): void;
  selectRelationship(relationshipId: string | null): void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedEntityId: null,
  selectedRelationshipId: null,
  selectEntity(entityId) {
    set({ selectedEntityId: entityId, selectedRelationshipId: null });
  },
  selectRelationship(relationshipId) {
    // A pane click reports null through BOTH canvas callbacks; keep the entity
    // selection unless a relationship was actually clicked, so the null from
    // selectRelationship doesn't wipe an entity selection made a moment earlier.
    set(
      relationshipId
        ? { selectedRelationshipId: relationshipId, selectedEntityId: null }
        : { selectedRelationshipId: null },
    );
  },
}));

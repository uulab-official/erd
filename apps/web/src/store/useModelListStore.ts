import { create } from "zustand";
import type { ModelSummary } from "@modelforge/api";
import { getModelStore } from "../lib/appwrite.js";

interface ModelListState {
  models: ModelSummary[];
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  remove(modelId: string): Promise<void>;
}

export const useModelListStore = create<ModelListState>((set, get) => ({
  models: [],
  loading: false,
  error: null,

  async refresh() {
    set({ loading: true, error: null });
    try {
      const models = await getModelStore().list();
      set({ models, loading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : String(error), loading: false });
    }
  },

  async remove(modelId) {
    await getModelStore().remove(modelId);
    set({ models: get().models.filter((m) => m.id !== modelId) });
  },
}));

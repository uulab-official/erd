import { create } from "zustand";

const LAST_MODEL_ID_KEY = "modelforge:lastModelId";
const FAVORITE_MODEL_IDS_KEY = "modelforge:favoriteModelIds";

function readLastModelId(): string | null {
  try {
    return localStorage.getItem(LAST_MODEL_ID_KEY);
  } catch {
    return null;
  }
}

function readFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAVORITE_MODEL_IDS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function writeFavoriteIds(ids: Set<string>): void {
  try {
    localStorage.setItem(FAVORITE_MODEL_IDS_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded cases — favorites are a
    // convenience, not load-bearing, so silently drop the write rather than crash the app.
  }
}

interface NavigationState {
  // The model currently open in the editor, or null to show the Dashboard. Persisted to
  // localStorage (not Appwrite) purely so a page refresh reopens where you left off —
  // it's local UI state, not something other devices/users need to see.
  openModelId: string | null;
  favoriteModelIds: Set<string>;
  openModel(modelId: string): void;
  closeModel(): void;
  toggleFavorite(modelId: string): void;
}

export const useNavigationStore = create<NavigationState>((set, get) => ({
  openModelId: readLastModelId(),
  favoriteModelIds: readFavoriteIds(),

  openModel(modelId) {
    try {
      localStorage.setItem(LAST_MODEL_ID_KEY, modelId);
    } catch {
      // See writeFavoriteIds — non-fatal if storage is unavailable.
    }
    set({ openModelId: modelId });
  },

  closeModel() {
    try {
      localStorage.removeItem(LAST_MODEL_ID_KEY);
    } catch {
      // See writeFavoriteIds — non-fatal if storage is unavailable.
    }
    set({ openModelId: null });
  },

  toggleFavorite(modelId) {
    const favorites = new Set(get().favoriteModelIds);
    if (favorites.has(modelId)) {
      favorites.delete(modelId);
    } else {
      favorites.add(modelId);
    }
    writeFavoriteIds(favorites);
    set({ favoriteModelIds: favorites });
  },
}));

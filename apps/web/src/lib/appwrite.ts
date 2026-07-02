import {
  createAppwriteClient,
  createAppwriteModelStore,
  createAuthService,
  createInMemoryModelStore,
  type AuthService,
  type ModelStore,
} from "@modelforge/api";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const modelsTableId = import.meta.env.VITE_APPWRITE_MODELS_TABLE_ID;

// Without a real Appwrite project configured, the app still runs with an in-memory
// ModelStore and Auth disabled — useful for local UI work and for `vite build` in CI.
export const isAppwriteConfigured = Boolean(endpoint && projectId && databaseId && modelsTableId);

let authService: AuthService | null = null;
let modelStore: ModelStore | null = null;

export function getAuthService(): AuthService | null {
  if (!isAppwriteConfigured) return null;
  authService ??= createAuthService(
    createAppwriteClient({ endpoint: endpoint!, projectId: projectId! }),
  );
  return authService;
}

export function getModelStore(): ModelStore {
  if (!isAppwriteConfigured) {
    modelStore ??= createInMemoryModelStore();
    return modelStore;
  }
  modelStore ??= createAppwriteModelStore(
    createAppwriteClient({ endpoint: endpoint!, projectId: projectId! }),
    { databaseId: databaseId!, modelsTableId: modelsTableId! },
  );
  return modelStore;
}

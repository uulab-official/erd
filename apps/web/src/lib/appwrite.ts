import {
  createAppwriteClient,
  createAppwriteModelStore,
  createAuthService,
  createInMemoryModelStore,
  invokeDeployFunction,
  pingAppwrite,
  type AuthService,
  type ModelStore,
} from "@modelforge/api";
import type { DeployResult, MigrationPlan } from "@modelforge/sdk";

const endpoint = import.meta.env.VITE_APPWRITE_ENDPOINT;
const projectId = import.meta.env.VITE_APPWRITE_PROJECT_ID;
const databaseId = import.meta.env.VITE_APPWRITE_DATABASE_ID;
const modelsTableId = import.meta.env.VITE_APPWRITE_MODELS_TABLE_ID;
const deployFunctionId = import.meta.env.VITE_APPWRITE_DEPLOY_FUNCTION_ID;

// Without a real Appwrite project configured, the app still runs with an in-memory
// ModelStore and Auth disabled — useful for local UI work and for `vite build` in CI.
export const isAppwriteConfigured = Boolean(endpoint && projectId && databaseId && modelsTableId);

// Deploying additionally needs the deploy-appwrite Function's id (functions/deploy-appwrite)
// — see its README for how to deploy that Function and wire its id back here.
export const canDeploy = Boolean(isAppwriteConfigured && deployFunctionId);

// Executes a Deploy Plan against the live database by invoking the deploy-appwrite
// Function (functions/deploy-appwrite) — this app never runs admin operations itself.
export async function deployPlan(plan: MigrationPlan): Promise<DeployResult> {
  if (!canDeploy) {
    throw new Error(
      "Deploy is not configured — set VITE_APPWRITE_DEPLOY_FUNCTION_ID (and the database/table env vars).",
    );
  }
  const client = createAppwriteClient({ endpoint: endpoint!, projectId: projectId! });
  return invokeDeployFunction(client, deployFunctionId!, { databaseId: databaseId!, plan });
}

// Connectivity only needs endpoint+project (no database/session), so this is checkable
// even before Auth/ModelStore are fully configured.
export const isAppwriteReachableCheckPossible = Boolean(endpoint && projectId);

// Verifies the configured Appwrite endpoint/project pair is actually reachable. Logs the
// result to the console — see the call site in main.tsx for when this runs.
export async function checkAppwriteConnection(): Promise<void> {
  if (!isAppwriteReachableCheckPossible) {
    console.info(
      "[appwrite] Skipping connectivity check — VITE_APPWRITE_ENDPOINT/PROJECT_ID not set.",
    );
    return;
  }
  try {
    await pingAppwrite(createAppwriteClient({ endpoint: endpoint!, projectId: projectId! }));
    console.info(`[appwrite] Connected to ${endpoint} (project ${projectId}).`);
  } catch (error) {
    console.warn(
      `[appwrite] Could not reach ${endpoint} (project ${projectId}):`,
      error instanceof Error ? error.message : error,
    );
  }
}

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

import { Client } from "node-appwrite";
import { applyPlan } from "./applyPlan.js";
import type { MigrationPlan } from "./types.js";

interface RequestContext {
  bodyJson?: unknown;
  headers: Record<string, string>;
}

interface ResponseContext {
  json(data: unknown, statusCode?: number): unknown;
}

interface FunctionContext {
  req: RequestContext;
  res: ResponseContext;
  log: (message: string) => void;
  error: (message: string) => void;
}

interface DeployRequestBody {
  databaseId: string;
  plan: MigrationPlan;
}

function isDeployRequestBody(body: unknown): body is DeployRequestBody {
  if (!body || typeof body !== "object") return false;
  const candidate = body as Record<string, unknown>;
  return (
    typeof candidate.databaseId === "string" &&
    typeof candidate.plan === "object" &&
    candidate.plan !== null
  );
}

// Appwrite Function entrypoint. Deploy this project's Deploy Plan (packages/deploy-engine's
// planAppwriteDeployment output) against the real Databases API — the one place this
// repo is allowed to run admin operations, since it's the only place with access to an
// API key (Appwrite's per-execution APPWRITE_FUNCTION_API_KEY, scoped to whatever this
// Function's declared scopes are — see appwrite.json). See ROADMAP.md and
// functions/deploy-appwrite/README.md for how this gets deployed and invoked.
export default async function main({ req, res, log, error }: FunctionContext): Promise<unknown> {
  // Execute access (configured on the Function itself, see appwrite.json) already gates
  // who can trigger this at the platform level; this is a defense-in-depth check that the
  // invocation came from an authenticated session rather than a guest/API key caller.
  if (!req.headers["x-appwrite-user-id"]) {
    error("Rejected an unauthenticated execution attempt.");
    return res.json({ error: "Authentication required." }, 401);
  }

  if (!isDeployRequestBody(req.bodyJson)) {
    error(`Malformed request body: ${JSON.stringify(req.bodyJson)}`);
    return res.json({ error: 'Expected { "databaseId": string, "plan": MigrationPlan }.' }, 400);
  }

  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT;
  const projectId = process.env.APPWRITE_FUNCTION_PROJECT_ID;
  const apiKey = process.env.APPWRITE_FUNCTION_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    error(
      "Missing APPWRITE_FUNCTION_API_ENDPOINT/PROJECT_ID/API_KEY — is this running as an Appwrite Function?",
    );
    return res.json({ error: "Function is not configured correctly." }, 500);
  }

  const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

  const { databaseId, plan } = req.bodyJson;
  log(`Applying plan ${plan.id} (${plan.steps.length} steps) against database "${databaseId}".`);

  const result = await applyPlan(client, databaseId, plan);

  if (result.failedStep) {
    error(
      `Plan ${plan.id} stopped at step "${result.failedStep.step.target}": ${result.failedStep.error}`,
    );
  } else {
    log(`Plan ${plan.id} applied ${result.appliedSteps.length} step(s) successfully.`);
  }

  return res.json(result);
}

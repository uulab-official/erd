import { Client } from "node-appwrite";
import { applyPlan } from "./applyPlan.js";
import { listSchema } from "./listSchema.js";
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

interface ApplyRequestBody {
  action?: "apply";
  databaseId: string;
  plan: MigrationPlan;
}

interface ListRequestBody {
  action: "list";
  databaseId: string;
}

type DeployRequestBody = ApplyRequestBody | ListRequestBody;

function parseRequestBody(bodyJson: unknown): DeployRequestBody | undefined {
  if (!bodyJson || typeof bodyJson !== "object") return undefined;
  const candidate = bodyJson as Record<string, unknown>;

  if (candidate.action === "list" && typeof candidate.databaseId === "string") {
    return { action: "list", databaseId: candidate.databaseId };
  }

  if (
    (candidate.action === undefined || candidate.action === "apply") &&
    typeof candidate.databaseId === "string" &&
    typeof candidate.plan === "object" &&
    candidate.plan !== null
  ) {
    return { databaseId: candidate.databaseId, plan: candidate.plan as MigrationPlan };
  }

  return undefined;
}

// Appwrite Function entrypoint. This Function is the only place this repo runs admin
// operations against a live Appwrite database, since it's the only place with access to
// an API key (Appwrite's per-execution APPWRITE_FUNCTION_API_KEY, scoped to whatever this
// Function's declared scopes are). It supports two request shapes, dispatched on
// `action`:
//   - { action: "apply" (default), databaseId, plan } — apply a Deploy Plan
//     (packages/deploy-engine's planAppwriteDeployment output) via applyPlan().
//   - { action: "list", databaseId } — list every collection (with its attributes and
//     indexes already embedded) via listSchema(), for live Collection Import.
// Both share the same Databases-scoped API key, so a single Function with one write-
// capable key is not a larger privilege surface than splitting "list" into its own
// read-only Function would be — apply() already requires the write scope that list()'s
// read-only calls are a strict subset of. See ROADMAP.md and
// functions/deploy-appwrite/README.md for how this gets deployed and invoked.
export default async function main({ req, res, log, error }: FunctionContext): Promise<unknown> {
  // Execute access (configured on the Function itself, see appwrite.json) already gates
  // who can trigger this at the platform level; this is a defense-in-depth check that the
  // invocation came from an authenticated session rather than a guest/API key caller.
  if (!req.headers["x-appwrite-user-id"]) {
    error("Rejected an unauthenticated execution attempt.");
    return res.json({ error: "Authentication required." }, 401);
  }

  const body = parseRequestBody(req.bodyJson);
  if (!body) {
    error(`Malformed request body: ${JSON.stringify(req.bodyJson)}`);
    return res.json(
      {
        error:
          'Expected { "databaseId": string, "plan": MigrationPlan } or ' +
          '{ "action": "list", "databaseId": string }.',
      },
      400,
    );
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

  if (body.action === "list") {
    log(`Listing collections for database "${body.databaseId}".`);
    const result = await listSchema(client, body.databaseId);
    log(`Listed ${result.collections.length} collection(s).`);
    return res.json(result);
  }

  const { databaseId, plan } = body;
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

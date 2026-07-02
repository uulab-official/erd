import { Functions } from "appwrite";
import type { Client } from "appwrite";
import type { DeployResult, MigrationPlan } from "@modelforge/sdk";

export interface DeployExecutionRequest {
  databaseId: string;
  plan: MigrationPlan;
}

// Invokes the deploy-appwrite Function (functions/deploy-appwrite) — the only place this
// project runs admin operations against a live Appwrite database, since that Function
// holds its own server-side API key that never reaches the browser. This call itself
// only needs the caller's authenticated session (checked by the Function itself, see
// functions/deploy-appwrite/src/main.ts), not an API key.
export async function invokeDeployFunction(
  client: Client,
  functionId: string,
  request: DeployExecutionRequest,
): Promise<DeployResult> {
  const functions = new Functions(client);
  const execution = await functions.createExecution(functionId, JSON.stringify(request), false);

  if (execution.responseStatusCode >= 400) {
    throw new Error(
      `Deploy function returned ${execution.responseStatusCode}: ${execution.responseBody}`,
    );
  }
  return JSON.parse(execution.responseBody) as DeployResult;
}

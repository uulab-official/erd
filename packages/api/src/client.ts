import { Client } from "appwrite";

export interface AppwriteConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  modelsTableId: string;
}

export function createAppwriteClient(
  config: Pick<AppwriteConfig, "endpoint" | "projectId">,
): Client {
  return new Client().setEndpoint(config.endpoint).setProject(config.projectId);
}

// Connectivity check against Appwrite's /ping endpoint — confirms the endpoint/project
// pair actually resolves to a reachable Appwrite instance, independent of Auth/Database
// configuration (which need a session/database id on top of this).
export async function pingAppwrite(client: Client): Promise<void> {
  await client.ping();
}

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

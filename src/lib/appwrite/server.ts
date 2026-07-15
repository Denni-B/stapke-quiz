import { Client, TablesDB } from "node-appwrite";

import { appwriteConfig } from "./config";

let cachedServerClient: { client: Client; tablesDB: TablesDB } | null = null;

export function createServerClient() {
  if (!cachedServerClient) {
    const client = new Client()
      .setEndpoint(appwriteConfig.endpoint)
      .setProject(appwriteConfig.projectId)
      .setKey(appwriteConfig.apiKey);

    cachedServerClient = {
      client,
      tablesDB: new TablesDB(client),
    };
  }

  return cachedServerClient;
}

import { Client, TablesDB } from "node-appwrite";

import { appwriteConfig } from "./config";

export function createServerClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setKey(appwriteConfig.apiKey);

  return {
    client,
    tablesDB: new TablesDB(client),
  };
}

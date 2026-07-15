import { Account, Client, Storage, TablesDB } from "appwrite";

import { appwriteConfig } from "./config";

function createClient() {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId);

  return client;
}

export const client = createClient();
export const account = new Account(client);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);

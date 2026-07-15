import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { Client, ID, Permission, Role, TablesDB } from "node-appwrite";

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#=]+)=(.*)$/);
    if (!match || process.env[match[1]]) {
      continue;
    }

    process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const endpoint =
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "stapkedennis";
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6a549c670004508e76a9";
const participantsTableId =
  process.env.NEXT_PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID ?? "participants";
const answersTableId =
  process.env.NEXT_PUBLIC_APPWRITE_ANSWERS_TABLE_ID ?? "answers";
const groupsTableId =
  process.env.NEXT_PUBLIC_APPWRITE_GROUPS_TABLE_ID ?? "groups";
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error("Missing APPWRITE_API_KEY in environment.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new TablesDB(client);

async function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function waitForColumn(tableId, key, attempts = 20) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await tablesDB.getColumn({ databaseId, tableId, key });
      return;
    } catch {
      await sleep(500);
    }
  }

  throw new Error(`Column ${key} on ${tableId} did not become available in time.`);
}

async function ensureStringColumn(tableId, key, size = 36, required = false) {
  try {
    await tablesDB.getColumn({ databaseId, tableId, key });
    console.log(`Column "${key}" already exists on ${tableId}.`);
    return;
  } catch {
    // continue
  }

  await tablesDB.createStringColumn({
    databaseId,
    tableId,
    key,
    size,
    required,
  });
  await waitForColumn(tableId, key);
  console.log(`Added column "${key}" to ${tableId} table.`);
}

async function ensureIntegerColumn(tableId, key, required = false) {
  try {
    await tablesDB.getColumn({ databaseId, tableId, key });
    console.log(`Column "${key}" already exists on ${tableId}.`);
    return;
  } catch {
    // continue
  }

  await tablesDB.createIntegerColumn({
    databaseId,
    tableId,
    key,
    required,
  });
  await waitForColumn(tableId, key);
  console.log(`Added column "${key}" to ${tableId} table.`);
}

async function ensureIndex(tableId, key, type, attributes) {
  try {
    await tablesDB.createIndex({
      databaseId,
      tableId,
      key,
      type,
      columns: attributes,
    });
    console.log(`Created index "${key}" on ${tableId}.`);
    await sleep(500);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already exists")) {
      console.log(`Index "${key}" already exists on ${tableId}.`);
      return;
    }
    throw error;
  }
}

async function ensureGroupsTable() {
  try {
    await tablesDB.getTable({ databaseId, tableId: groupsTableId });
    console.log(`Table "${groupsTableId}" already exists.`);
  } catch {
    console.log(`Creating table "${groupsTableId}"...`);
    await tablesDB.createTable({
      databaseId,
      tableId: groupsTableId,
      name: "Groups",
      permissions: [],
      rowSecurity: false,
    });
    await sleep(500);
  }

  await ensureStringColumn(groupsTableId, "quizId", 36, true);
  await ensureStringColumn(groupsTableId, "name", 255, true);
  await ensureIntegerColumn(groupsTableId, "createdAt", true);
  await ensureIndex(groupsTableId, "quizId_index", "key", ["quizId"]);
}

try {
  await ensureGroupsTable();
  await ensureStringColumn(participantsTableId, "groupId", 36, false);
  await ensureIndex(participantsTableId, "groupId_index", "key", ["groupId"]);
  await ensureStringColumn(answersTableId, "groupId", 36, false);
  await ensureIndex(answersTableId, "groupId_index", "key", ["groupId"]);
  console.log("\nGroups schema is ready.");
  console.log(`Add to .env.local: NEXT_PUBLIC_APPWRITE_GROUPS_TABLE_ID=${groupsTableId}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

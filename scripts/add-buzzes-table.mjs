import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

import { Client, TablesDB } from "node-appwrite";

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
const buzzesTableId =
  process.env.NEXT_PUBLIC_APPWRITE_BUZZES_TABLE_ID ?? "buzzes";
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

async function ensureBuzzesTable() {
  try {
    await tablesDB.getTable({ databaseId, tableId: buzzesTableId });
    console.log(`Table "${buzzesTableId}" already exists.`);
  } catch {
    console.log(`Creating table "${buzzesTableId}"...`);
    await tablesDB.createTable({
      databaseId,
      tableId: buzzesTableId,
      name: "Buzzes",
      permissions: [],
      rowSecurity: false,
    });
    await sleep(500);
  }

  await ensureStringColumn(buzzesTableId, "quizId", 36, true);
  await ensureStringColumn(buzzesTableId, "questionId", 36, true);
  await ensureStringColumn(buzzesTableId, "participantId", 36, true);
  await ensureStringColumn(buzzesTableId, "groupId", 36, false);
  await ensureIntegerColumn(buzzesTableId, "buzzedAt", true);
  await ensureIndex(buzzesTableId, "quizId_index", "key", ["quizId"]);
  await ensureIndex(buzzesTableId, "questionId_index", "key", ["questionId"]);
  await ensureIndex(buzzesTableId, "question_participant_unique", "unique", [
    "questionId",
    "participantId",
  ]);
}

try {
  await ensureBuzzesTable();
  console.log("\nBuzzes schema is ready.");
  console.log(`Add to .env.local: NEXT_PUBLIC_APPWRITE_BUZZES_TABLE_ID=${buzzesTableId}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

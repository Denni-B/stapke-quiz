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
  process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
  "https://fra.cloud.appwrite.io/v1";
const projectId =
  process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "stapkedennis";
const databaseId =
  process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6a549c670004508e76a9";
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error("Missing APPWRITE_API_KEY environment variable.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const tablesDB = new TablesDB(client);

const tableDefinitions = [
  {
    tableId: "quizzes",
    name: "Quizzes",
    rowSecurity: false,
    tablePermissions: [
      Permission.create(Role.users()),
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ],
    columns: [
      { key: "title", type: "varchar", size: 255, required: true },
      { key: "code", type: "varchar", size: 8, required: true },
      { key: "creatorId", type: "varchar", size: 36, required: true },
      { key: "status", type: "varchar", size: 20, required: true },
      { key: "description", type: "text", size: 16383, required: false },
    ],
    indexes: [{ key: "code_unique", type: "unique", attributes: ["code"] }],
  },
  {
    tableId: "chapters",
    name: "Chapters",
    rowSecurity: false,
    tablePermissions: [
      Permission.create(Role.users()),
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "title", type: "varchar", size: 255, required: true },
      { key: "order", type: "integer", required: true },
      { key: "isOpen", type: "integer", required: true },
      { key: "type", type: "varchar", size: 24, required: false },
    ],
    indexes: [
      { key: "quizId_index", type: "key", attributes: ["quizId"] },
      { key: "quizId_order_index", type: "key", attributes: ["quizId", "order"] },
    ],
  },
  {
    tableId: "questions",
    name: "Questions",
    rowSecurity: false,
    tablePermissions: [
      Permission.create(Role.users()),
      Permission.read(Role.users()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "chapterId", type: "varchar", size: 36, required: false },
      { key: "type", type: "varchar", size: 24, required: true },
      { key: "scaleMin", type: "integer", required: false },
      { key: "scaleMax", type: "integer", required: false },
      { key: "text", type: "text", size: 16383, required: true },
      { key: "order", type: "integer", required: true },
      { key: "options", type: "longtext", size: 16383, required: true },
      { key: "imageFileId", type: "varchar", size: 36, required: false },
    ],
    indexes: [
      { key: "quizId_index", type: "key", attributes: ["quizId"] },
      { key: "chapterId_index", type: "key", attributes: ["chapterId"] },
      { key: "type_index", type: "key", attributes: ["type"] },
    ],
  },
  {
    tableId: "participants",
    name: "Participants",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "displayName", type: "varchar", size: 100, required: true },
      { key: "sessionToken", type: "varchar", size: 64, required: true },
      { key: "groupId", type: "varchar", size: 36, required: false },
    ],
    indexes: [
      { key: "quizId_index", type: "key", attributes: ["quizId"] },
      { key: "sessionToken_index", type: "key", attributes: ["sessionToken"] },
      { key: "groupId_index", type: "key", attributes: ["groupId"] },
    ],
  },
  {
    tableId: "groups",
    name: "Groups",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "name", type: "varchar", size: 255, required: true },
      { key: "createdAt", type: "integer", required: true },
    ],
    indexes: [{ key: "quizId_index", type: "key", attributes: ["quizId"] }],
  },
  {
    tableId: "buzzes",
    name: "Buzzes",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "questionId", type: "varchar", size: 36, required: true },
      { key: "participantId", type: "varchar", size: 36, required: true },
      { key: "groupId", type: "varchar", size: 36, required: false },
      { key: "buzzedAt", type: "integer", required: true },
    ],
    indexes: [
      { key: "quizId_index", type: "key", attributes: ["quizId"] },
      { key: "questionId_index", type: "key", attributes: ["questionId"] },
      {
        key: "question_participant_unique",
        type: "unique",
        attributes: ["questionId", "participantId"],
      },
    ],
  },
  {
    tableId: "answers",
    name: "Answers",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "questionId", type: "varchar", size: 36, required: true },
      { key: "participantId", type: "varchar", size: 36, required: true },
      { key: "value", type: "integer", required: true },
      { key: "groupId", type: "varchar", size: 36, required: false },
    ],
    indexes: [
      { key: "quizId_index", type: "key", attributes: ["quizId"] },
      { key: "questionId_index", type: "key", attributes: ["questionId"] },
      { key: "groupId_index", type: "key", attributes: ["groupId"] },
      {
        key: "question_participant_unique",
        type: "unique",
        attributes: ["questionId", "participantId"],
      },
    ],
  },
  {
    tableId: "blackjack_sessions",
    name: "Blackjack Sessions",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "quizId", type: "varchar", size: 36, required: true },
      { key: "chapterId", type: "varchar", size: 36, required: true },
      { key: "phase", type: "varchar", size: 24, required: true },
      { key: "roundNumber", type: "integer", required: true },
      { key: "seatCount", type: "integer", required: true },
      { key: "deck", type: "longtext", size: 16383, required: true },
      { key: "dealerCards", type: "longtext", size: 16383, required: true },
      { key: "currentSeat", type: "integer", required: true },
      { key: "currentHandIndex", type: "integer", required: true },
    ],
    indexes: [
      { key: "quizId_index", type: "key", attributes: ["quizId"] },
      {
        key: "chapterId_unique",
        type: "unique",
        attributes: ["chapterId"],
      },
    ],
  },
  {
    tableId: "blackjack_seats",
    name: "Blackjack Seats",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "chapterId", type: "varchar", size: 36, required: true },
      { key: "participantId", type: "varchar", size: 36, required: true },
      { key: "seatNumber", type: "integer", required: true },
    ],
    indexes: [
      { key: "chapterId_index", type: "key", attributes: ["chapterId"] },
      {
        key: "chapter_seat_unique",
        type: "unique",
        attributes: ["chapterId", "seatNumber"],
      },
      {
        key: "chapter_participant_unique",
        type: "unique",
        attributes: ["chapterId", "participantId"],
      },
    ],
  },
  {
    tableId: "blackjack_hands",
    name: "Blackjack Hands",
    rowSecurity: false,
    tablePermissions: [],
    columns: [
      { key: "chapterId", type: "varchar", size: 36, required: true },
      { key: "roundNumber", type: "integer", required: true },
      { key: "participantId", type: "varchar", size: 36, required: true },
      { key: "seatNumber", type: "integer", required: true },
      { key: "handIndex", type: "integer", required: true },
      { key: "cards", type: "longtext", size: 16383, required: true },
      { key: "bet", type: "integer", required: true },
      { key: "insuranceBet", type: "integer", required: true },
      { key: "betConfirmed", type: "integer", required: true },
      { key: "insuranceConfirmed", type: "integer", required: true },
      { key: "status", type: "varchar", size: 24, required: true },
      { key: "outcome", type: "varchar", size: 16, required: false },
      { key: "payout", type: "integer", required: true },
    ],
    indexes: [
      { key: "chapterId_index", type: "key", attributes: ["chapterId"] },
      {
        key: "bj_round_hand_unique",
        type: "unique",
        attributes: ["chapterId", "roundNumber", "participantId", "handIndex"],
      },
    ],
  },
];

async function tableExists(tableId) {
  try {
    await tablesDB.getTable({ databaseId, tableId });
    return true;
  } catch {
    return false;
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function createColumnWithRetry(tableId, column) {
  const base = { databaseId, tableId, key: column.key, required: column.required };

  switch (column.type) {
    case "varchar":
    case "text":
    case "longtext":
      await tablesDB.createStringColumn({
        ...base,
        size: column.size ?? 16383,
      });
      break;
    case "integer":
      await tablesDB.createIntegerColumn(base);
      break;
    default:
      throw new Error(`Unsupported column type: ${column.type}`);
  }

  await waitForColumn(tableId, column.key);
  await sleep(300);
}

async function createIndex(tableId, index) {
  await tablesDB.createIndex({
    databaseId,
    tableId,
    key: index.key,
    type: index.type,
    columns: index.attributes,
  });
}

async function setupTable(definition) {
  const exists = await tableExists(definition.tableId);

  if (!exists) {
    console.log(`Creating table: ${definition.name} (${definition.tableId})`);
    await tablesDB.createTable({
      databaseId,
      tableId: definition.tableId,
      name: definition.name,
      permissions: definition.tablePermissions,
      rowSecurity: definition.rowSecurity,
    });
  } else {
    console.log(`Table already exists: ${definition.tableId}`);
  }

  for (const column of definition.columns) {
    try {
      await tablesDB.getColumn({
        databaseId,
        tableId: definition.tableId,
        key: column.key,
      });
      console.log(`  Column exists: ${column.key}`);
    } catch {
      console.log(`  Creating column: ${column.key}`);
      await createColumnWithRetry(definition.tableId, column);
    }
  }

  for (const index of definition.indexes) {
    try {
      await tablesDB.createIndex({
        databaseId,
        tableId: definition.tableId,
        key: index.key,
        type: index.type,
        columns: index.attributes,
      });
      console.log(`  Created index: ${index.key}`);
      await sleep(500);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("already exists")) {
        console.log(`  Index exists: ${index.key}`);
      } else {
        throw error;
      }
    }
  }
}

async function main() {
  console.log(`Setting up Stapke tables in database ${databaseId}...`);

  for (const definition of tableDefinitions) {
    await setupTable(definition);
  }

  console.log("\nDone! Add these to your .env.local:\n");
  console.log(`NEXT_PUBLIC_APPWRITE_DATABASE_ID=${databaseId}`);
  console.log("NEXT_PUBLIC_APPWRITE_QUIZZES_TABLE_ID=quizzes");
  console.log("NEXT_PUBLIC_APPWRITE_QUESTIONS_TABLE_ID=questions");
  console.log("NEXT_PUBLIC_APPWRITE_CHAPTERS_TABLE_ID=chapters");
  console.log("NEXT_PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID=participants");
  console.log("NEXT_PUBLIC_APPWRITE_ANSWERS_TABLE_ID=answers");
  console.log("NEXT_PUBLIC_APPWRITE_GROUPS_TABLE_ID=groups");
  console.log("NEXT_PUBLIC_APPWRITE_BUZZES_TABLE_ID=buzzes");
  console.log("NEXT_PUBLIC_APPWRITE_BLACKJACK_SESSIONS_TABLE_ID=blackjack_sessions");
  console.log("NEXT_PUBLIC_APPWRITE_BLACKJACK_SEATS_TABLE_ID=blackjack_seats");
  console.log("NEXT_PUBLIC_APPWRITE_BLACKJACK_HANDS_TABLE_ID=blackjack_hands");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

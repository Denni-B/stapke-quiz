import { Client, TablesDB } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "stapkedennis";
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6a549c670004508e76a9";
const quizzesTableId = process.env.NEXT_PUBLIC_APPWRITE_QUIZZES_TABLE_ID ?? "quizzes";
const answersTableId = process.env.NEXT_PUBLIC_APPWRITE_ANSWERS_TABLE_ID ?? "answers";
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error("Missing APPWRITE_API_KEY in environment.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new TablesDB(client);

async function ensureIntegerColumn(tableId, key) {
  try {
    const column = await tablesDB.createIntegerColumn(databaseId, tableId, key, false);
    console.log(`Added column "${column.key}" to ${tableId} table.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("already exists") || message.includes("Attribute already exists")) {
      console.log(`Column "${key}" already exists on ${tableId}.`);
      return;
    }

    throw error;
  }
}

try {
  await ensureIntegerColumn(quizzesTableId, "activeQuestionStartedAt");
  await ensureIntegerColumn(answersTableId, "points");
  console.log("Scoring columns are ready.");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

import { Client, TablesDB } from "node-appwrite";

const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "stapkedennis";
const databaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "6a549c670004508e76a9";
const quizzesTableId = process.env.NEXT_PUBLIC_APPWRITE_QUIZZES_TABLE_ID ?? "quizzes";
const apiKey = process.env.APPWRITE_API_KEY;

if (!apiKey) {
  console.error("Missing APPWRITE_API_KEY in environment.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const tablesDB = new TablesDB(client);

try {
  const column = await tablesDB.createStringColumn(
    databaseId,
    quizzesTableId,
    "activeQuestionId",
    36,
    false,
  );
  console.log(`Added column "${column.key}" to quizzes table.`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("already exists") || message.includes("Attribute already exists")) {
    console.log('Column "activeQuestionId" already exists.');
    process.exit(0);
  }

  console.error(message);
  process.exit(1);
}

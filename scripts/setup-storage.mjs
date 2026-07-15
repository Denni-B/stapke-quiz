import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Client, Permission, Role, Storage } from "node-appwrite";

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
const apiKey = process.env.APPWRITE_API_KEY;
const bucketId =
  process.env.NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID ?? "quiz-images";

if (!apiKey) {
  console.error("Missing APPWRITE_API_KEY environment variable.");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(endpoint)
  .setProject(projectId)
  .setKey(apiKey);

const storage = new Storage(client);

async function main() {
  try {
    await storage.getBucket({ bucketId });
    console.log(`Bucket already exists: ${bucketId}`);
  } catch {
    console.log(`Creating bucket: ${bucketId}`);
    await storage.createBucket({
      bucketId,
      name: "Quiz Images",
      permissions: [
        Permission.create(Role.users()),
        Permission.read(Role.any()),
        Permission.update(Role.users()),
        Permission.delete(Role.users()),
      ],
      fileSecurity: false,
      enabled: true,
      maximumFileSize: 5 * 1024 * 1024,
      allowedFileExtensions: ["jpg", "jpeg", "png", "webp", "gif"],
    });
    console.log("Bucket created.");
  }

  console.log("\nAdd to .env.local:");
  console.log(`NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID=${bucketId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

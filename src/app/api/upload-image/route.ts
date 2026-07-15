import { ID, Permission, Role, Storage } from "node-appwrite";
import { InputFile } from "node-appwrite/file";
import { Account, Client } from "node-appwrite";
import { NextResponse } from "next/server";

import { appwriteConfig, isServerConfigured } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function getUserFromJwt(jwt: string) {
  const client = new Client()
    .setEndpoint(appwriteConfig.endpoint)
    .setProject(appwriteConfig.projectId)
    .setJWT(jwt);

  const account = new Account(client);
  return account.get();
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 },
    );
  }

  if (!appwriteConfig.imagesBucketId) {
    return NextResponse.json(
      { error: "Image storage is not configured." },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("Authorization") ?? "";
  const jwt = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!jwt) {
    return NextResponse.json({ error: "Missing authorization." }, { status: 401 });
  }

  let user;

  try {
    user = await getUserFromJwt(jwt);
  } catch {
    return NextResponse.json({ error: "Invalid session." }, { status: 401 });
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid upload payload." }, { status: 400 });
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing image file." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP, or GIF image." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Image must be 5 MB or smaller." },
      { status: 400 },
    );
  }

  try {
    const { client } = createServerClient();
    const storage = new Storage(client);
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await storage.createFile({
      bucketId: appwriteConfig.imagesBucketId,
      fileId: ID.unique(),
      file: InputFile.fromBuffer(buffer, file.name),
      permissions: [
        Permission.read(Role.any()),
        Permission.update(Role.user(user.$id)),
        Permission.delete(Role.user(user.$id)),
      ],
    });

    return NextResponse.json({ ok: true, fileId: uploaded.$id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload image.";

    if (message.includes("could not be found")) {
      return NextResponse.json(
        {
          error:
            "Image storage bucket is missing. Run npm run setup:storage on the server.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

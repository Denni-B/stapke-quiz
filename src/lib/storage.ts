import { apiUrl } from "@/lib/api-url";
import { account } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { getCurrentUser } from "@/lib/auth";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function getImagePreviewUrl(
  fileId: string,
  width = 960,
  height = 540,
): string {
  const params = new URLSearchParams({
    project: appwriteConfig.projectId,
    width: String(width),
    height: String(height),
  });

  return `${appwriteConfig.endpoint}/storage/buckets/${appwriteConfig.imagesBucketId}/files/${fileId}/preview?${params.toString()}`;
}

export async function uploadQuizImage(file: File): Promise<string> {
  if (!appwriteConfig.imagesBucketId) {
    throw new Error("Image storage is not configured.");
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Use a JPG, PNG, WebP, or GIF image.");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error("Image must be 5 MB or smaller.");
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be logged in to upload images.");
  }

  const { jwt } = await account.createJWT();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(apiUrl("/api/upload-image"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
    },
    body: formData,
  });

  const data = (await response.json()) as { fileId?: string; error?: string };

  if (!response.ok || !data.fileId) {
    throw new Error(data.error ?? "Could not upload image.");
  }

  return data.fileId;
}

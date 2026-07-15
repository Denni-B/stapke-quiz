import { ID } from "appwrite";
import type { Models } from "appwrite";

import { account } from "@/lib/appwrite/client";

export async function getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

export async function clearActiveSession() {
  try {
    await account.deleteSession({ sessionId: "current" });
  } catch {
    // No active session to clear.
  }
}

export async function logout() {
  await clearActiveSession();
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
) {
  await account.create({
    userId: ID.unique(),
    email,
    password,
    name,
  });

  await clearActiveSession();
  return account.createEmailPasswordSession({ email, password });
}

export async function loginUser(email: string, password: string) {
  await clearActiveSession();
  return account.createEmailPasswordSession({ email, password });
}

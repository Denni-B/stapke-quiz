import { NextResponse } from "next/server";

import { isServerConfigured } from "@/lib/appwrite/config";
import { resetQuizForHost } from "@/lib/reset-quiz";

interface ResetQuizBody {
  userId?: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;

  let body: ResetQuizBody;

  try {
    body = (await request.json()) as ResetQuizBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = body.userId?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    const result = await resetQuizForHost(quizId, userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not reset quiz.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (message.includes("Only an open or active")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

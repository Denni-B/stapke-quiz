import { NextResponse } from "next/server";

import { assertQuizCreator } from "@/lib/answers";
import { getBuzzOrderWithScoresForQuestion } from "@/lib/jeopardy-scoring";
import { isServerConfigured } from "@/lib/appwrite/config";

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 },
    );
  }

  const { quizId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";
  const questionId = searchParams.get("questionId")?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  if (!questionId) {
    return NextResponse.json({ error: "Missing question ID." }, { status: 400 });
  }

  try {
    await assertQuizCreator(quizId, userId);
    const buzzes = await getBuzzOrderWithScoresForQuestion(questionId);

    return NextResponse.json({ buzzes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load buzzes.";

    if (message.includes("permission") || message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

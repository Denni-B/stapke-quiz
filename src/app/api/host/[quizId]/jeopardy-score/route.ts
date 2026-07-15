import { NextResponse } from "next/server";

import { isServerConfigured } from "@/lib/appwrite/config";
import { awardJeopardyScoreForHost } from "@/lib/jeopardy-scoring";

interface JeopardyScoreRequestBody {
  userId?: string;
  questionId?: string;
  participantId?: string;
  correct?: boolean;
}

export async function POST(
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

  let body: JeopardyScoreRequestBody;

  try {
    body = (await request.json()) as JeopardyScoreRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = body.userId?.trim() ?? "";
  const questionId = body.questionId?.trim() ?? "";
  const participantId = body.participantId?.trim() ?? "";
  const correct = body.correct;

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  if (!questionId) {
    return NextResponse.json({ error: "Missing question ID." }, { status: 400 });
  }

  if (!participantId) {
    return NextResponse.json({ error: "Missing participant ID." }, { status: 400 });
  }

  if (typeof correct !== "boolean") {
    return NextResponse.json({ error: "Missing correct flag." }, { status: 400 });
  }

  try {
    const result = await awardJeopardyScoreForHost(
      quizId,
      userId,
      questionId,
      participantId,
      correct,
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not award score.";

    if (
      message.includes("permission") ||
      message.includes("not found") ||
      message.includes("not live") ||
      message.includes("not open")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

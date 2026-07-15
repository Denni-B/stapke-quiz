import { NextResponse } from "next/server";

import { isServerConfigured } from "@/lib/appwrite/config";
import { setActiveQuestionForHostOnServer } from "@/lib/quiz-present-server";

interface PresentRequestBody {
  userId?: string;
  questionId?: string;
  preserveTimer?: boolean;
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

  let body: PresentRequestBody;

  try {
    body = (await request.json()) as PresentRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = body.userId?.trim() ?? "";
  const questionId = body.questionId?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  if (!questionId) {
    return NextResponse.json({ error: "Missing question ID." }, { status: 400 });
  }

  try {
    const quiz = await setActiveQuestionForHostOnServer(quizId, userId, questionId, {
      preserveTimer: body.preserveTimer ?? false,
    });

    return NextResponse.json({ ok: true, quiz });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not present question.";

    if (
      message.includes("permission") ||
      message.includes("not found") ||
      message.includes("before presenting") ||
      message.includes("before opening")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

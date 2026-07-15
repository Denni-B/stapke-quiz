import { NextResponse } from "next/server";

import {
  assertQuizCreator,
  getMultipleChoiceResultsForQuiz,
  getParticipantsForQuiz,
  getScaleResultsForQuiz,
} from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";
  const chapterId = searchParams.get("chapterId")?.trim() ?? undefined;

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    await assertQuizCreator(quizId, userId);

    const [scaleResults, multipleChoiceResults, participants] = await Promise.all([
      getScaleResultsForQuiz(quizId, chapterId),
      getMultipleChoiceResultsForQuiz(quizId, chapterId),
      getParticipantsForQuiz(quizId),
    ]);

    return NextResponse.json({
      scaleResults,
      multipleChoiceResults,
      participantCount: participants.length,
      results: scaleResults,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load results.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 404 });
  }
}

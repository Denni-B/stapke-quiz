import { NextResponse } from "next/server";

import { assertQuizCreator, getParticipantsForQuiz } from "@/lib/answers";
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

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    await assertQuizCreator(quizId, userId);
    const participants = await getParticipantsForQuiz(quizId);

    return NextResponse.json({
      participants: participants.map((participant) => ({
        id: participant.$id,
        displayName: participant.displayName,
        joinedAt: participant.$createdAt,
        groupId: participant.groupId ?? null,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load participants.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 404 });
  }
}

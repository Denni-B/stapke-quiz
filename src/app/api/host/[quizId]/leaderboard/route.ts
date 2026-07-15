import { NextResponse } from "next/server";

import { assertQuizCreator, getLeaderboardForQuiz } from "@/lib/answers";
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
    const leaderboard = await getLeaderboardForQuiz(quizId);

    return NextResponse.json(leaderboard);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load leaderboard.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 404 });
  }
}

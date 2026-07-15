import { NextResponse } from "next/server";

import { assertQuizCreator } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";
import { dissolveGroup, getGroupsWithMembersForQuiz } from "@/lib/groups";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ quizId: string; groupId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId, groupId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    await assertQuizCreator(quizId, userId);
    await dissolveGroup(quizId, groupId);
    const groups = await getGroupsWithMembersForQuiz(quizId);

    return NextResponse.json({ ok: true, groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not split group.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

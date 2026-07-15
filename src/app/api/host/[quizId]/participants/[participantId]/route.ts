import { NextResponse } from "next/server";

import { deleteParticipantForHost } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ quizId: string; participantId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId, participantId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    await deleteParticipantForHost(quizId, participantId, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not remove player.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

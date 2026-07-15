import { NextResponse } from "next/server";

import {
  assertBlackjackChapterOpen,
  getOpenBlackjackChapterId,
  performAction,
} from "@/lib/blackjack/state";
import { getParticipantBySessionToken } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

interface ActionRequestBody {
  sessionToken?: string;
  action?: "hit" | "stand" | "double" | "split";
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: ActionRequestBody;

  try {
    body = (await request.json()) as ActionRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";
  const action = body.action;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  if (!action || !["hit", "stand", "double", "split"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  try {
    const participant = await getParticipantBySessionToken(sessionToken);

    if (!participant) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    if (participant.groupId) {
      return NextResponse.json(
        { error: "Blackjack is individueel. Verlaat je team om mee te doen." },
        { status: 403 },
      );
    }

    const chapterId = await getOpenBlackjackChapterId(participant.quizId);

    if (!chapterId) {
      return NextResponse.json({ error: "Blackjack is not open." }, { status: 403 });
    }

    await assertBlackjackChapterOpen(participant.quizId, chapterId);
    await performAction(chapterId, participant.$id, action);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not perform action.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

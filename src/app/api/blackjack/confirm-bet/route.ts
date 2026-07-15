import { NextResponse } from "next/server";

import {
  assertBlackjackChapterOpen,
  confirmBet,
  getOpenBlackjackChapterId,
} from "@/lib/blackjack/state";
import { getParticipantBySessionToken } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

interface ConfirmBetRequestBody {
  sessionToken?: string;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: ConfirmBetRequestBody;

  try {
    body = (await request.json()) as ConfirmBetRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
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
    const hand = await confirmBet(chapterId, participant.$id);

    return NextResponse.json({ ok: true, bet: hand.bet, betConfirmed: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not confirm bet.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

import { NextResponse } from "next/server";

import {
  assertBlackjackChapterOpen,
  getOpenBlackjackChapterId,
  setBet,
} from "@/lib/blackjack/state";
import { getParticipantBySessionToken } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

interface BetRequestBody {
  sessionToken?: string;
  bet?: number;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: BetRequestBody;

  try {
    body = (await request.json()) as BetRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";
  const bet = body.bet;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  if (typeof bet !== "number" || !Number.isInteger(bet)) {
    return NextResponse.json({ error: "Invalid bet." }, { status: 400 });
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
    const hand = await setBet(chapterId, participant.$id, bet);

    return NextResponse.json({ ok: true, bet: hand.bet });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not set bet.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

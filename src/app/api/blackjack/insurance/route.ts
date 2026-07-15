import { NextResponse } from "next/server";

import {
  assertBlackjackChapterOpen,
  getOpenBlackjackChapterId,
  setInsurance,
} from "@/lib/blackjack/state";
import { getParticipantBySessionToken } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

interface InsuranceRequestBody {
  sessionToken?: string;
  takeInsurance?: boolean;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: InsuranceRequestBody;

  try {
    body = (await request.json()) as InsuranceRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";
  const takeInsurance = body.takeInsurance;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  if (typeof takeInsurance !== "boolean") {
    return NextResponse.json({ error: "Missing insurance choice." }, { status: 400 });
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
    const hand = await setInsurance(chapterId, participant.$id, takeInsurance);

    return NextResponse.json({
      ok: true,
      insuranceBet: hand.insuranceBet,
      takeInsurance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not set insurance.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

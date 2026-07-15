import { NextResponse } from "next/server";

import {
  assertBlackjackChapterOpen,
  chooseSeat,
  getOpenBlackjackChapterId,
} from "@/lib/blackjack/state";
import { getParticipantBySessionToken } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

interface SeatRequestBody {
  sessionToken?: string;
  seatNumber?: number;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  let body: SeatRequestBody;

  try {
    body = (await request.json()) as SeatRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";
  const seatNumber = body.seatNumber;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  if (typeof seatNumber !== "number" || !Number.isInteger(seatNumber)) {
    return NextResponse.json({ error: "Invalid seat number." }, { status: 400 });
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
    const seat = await chooseSeat(chapterId, participant.$id, seatNumber);

    return NextResponse.json({ ok: true, seatNumber: seat.seatNumber });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not choose seat.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

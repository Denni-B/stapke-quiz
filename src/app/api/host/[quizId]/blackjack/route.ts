import { NextResponse } from "next/server";

import {
  advanceFromInsurance,
  assertBlackjackChapterOpen,
  buildHostState,
  dealHand,
  getOpenBlackjackChapterId,
  resetBlackjackGame,
  startBettingPhase,
  startNextRound,
} from "@/lib/blackjack/state";
import { assertQuizCreator } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";

export async function GET(
  _request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;
  const chapterId = await getOpenBlackjackChapterId(quizId);

  if (!chapterId) {
    return NextResponse.json({ error: "No open blackjack chapter." }, { status: 404 });
  }

  const state = await buildHostState(quizId, chapterId);

  if (!state) {
    return NextResponse.json({ error: "Blackjack session not found." }, { status: 404 });
  }

  return NextResponse.json({ chapterId, state });
}

interface HostBlackjackBody {
  userId?: string;
  action?: "start" | "deal" | "continue-insurance" | "next-round" | "reset";
}

export async function POST(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;

  let body: HostBlackjackBody;

  try {
    body = (await request.json()) as HostBlackjackBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = body.userId?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    await assertQuizCreator(quizId, userId);
    const chapterId = await getOpenBlackjackChapterId(quizId);

    if (!chapterId) {
      return NextResponse.json({ error: "No open blackjack chapter." }, { status: 404 });
    }

    await assertBlackjackChapterOpen(quizId, chapterId);

    switch (body.action) {
      case "start":
        await startBettingPhase(chapterId);
        break;
      case "deal":
        await dealHand(chapterId);
        break;
      case "continue-insurance":
        await advanceFromInsurance(chapterId);
        break;
      case "next-round":
        await startNextRound(chapterId);
        break;
      case "reset":
        await resetBlackjackGame(quizId, chapterId);
        break;
      default:
        return NextResponse.json({ error: "Unknown action." }, { status: 400 });
    }

    const state = await buildHostState(quizId, chapterId);
    return NextResponse.json({ ok: true, chapterId, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Blackjack action failed.";

    if (
      message.includes("permission") ||
      message.includes("not open") ||
      message.includes("Cannot")
    ) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

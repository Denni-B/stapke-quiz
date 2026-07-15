import { NextResponse } from "next/server";

import {
  assertChapterOpenForQuestion,
  createAnswer,
  getAnswerForParticipant,
  getParticipantBySessionToken,
} from "@/lib/answers";
import { getGroupVoteForQuestion } from "@/lib/groups";
import { appwriteConfig, isServerConfigured } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import { calculateMultipleChoicePoints } from "@/lib/scoring";
import type { Question, QuestionOption, Quiz } from "@/lib/types";

interface VoteRequestBody {
  sessionToken?: string;
  questionId?: string;
  value?: number;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 },
    );
  }

  let body: VoteRequestBody;

  try {
    body = (await request.json()) as VoteRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";
  const questionId = body.questionId?.trim() ?? "";
  const value = body.value;

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  if (!questionId) {
    return NextResponse.json({ error: "Missing question ID." }, { status: 400 });
  }

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return NextResponse.json({ error: "Vote must be a whole number." }, { status: 400 });
  }

  try {
    const participant = await getParticipantBySessionToken(sessionToken);

    if (!participant) {
      return NextResponse.json({ error: "Invalid session." }, { status: 401 });
    }

    const { tablesDB } = createServerClient();

    const question = await tablesDB.getRow<Question>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.questionsTableId,
      rowId: questionId,
    });

    if (question.quizId !== participant.quizId) {
      return NextResponse.json({ error: "Question not found." }, { status: 404 });
    }

    const quiz = await tablesDB.getRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: participant.quizId,
    });

    if (quiz.status !== "active") {
      return NextResponse.json(
        { error: "The quiz is not active." },
        { status: 403 },
      );
    }

    if (!quiz.activeQuestionId || quiz.activeQuestionId !== questionId) {
      return NextResponse.json(
        { error: "This question is not live right now." },
        { status: 403 },
      );
    }

    await assertChapterOpenForQuestion(participant.quizId, question.chapterId);

    let options: QuestionOption[] = [];

    if (question.type === "multipleChoice") {
      options = JSON.parse(question.options) as QuestionOption[];

      if (value < 0 || value >= options.length) {
        return NextResponse.json({ error: "Invalid option selected." }, { status: 400 });
      }
    } else if (question.type === "scale1to10") {
      const scaleMin = question.scaleMin ?? 1;
      const scaleMax = question.scaleMax ?? 10;

      if (value < scaleMin || value > scaleMax) {
        return NextResponse.json(
          { error: `Vote must be between ${scaleMin} and ${scaleMax}.` },
          { status: 400 },
        );
      }
    } else {
      return NextResponse.json({ error: "Unsupported question type." }, { status: 400 });
    }

    const existing = participant.groupId
      ? await getGroupVoteForQuestion(questionId, participant.groupId)
      : await getAnswerForParticipant(questionId, participant.$id);

    if (existing) {
      const teamAlreadyVoted = Boolean(participant.groupId && existing.groupId);

      return NextResponse.json(
        {
          error: teamAlreadyVoted
            ? "Je team heeft al gestemd."
            : "You have already voted on this question.",
          value: existing.value,
          points: existing.points ?? 0,
        },
        { status: 409 },
      );
    }

    const answeredAtMs = Date.now();
    const points =
      question.type === "multipleChoice"
        ? calculateMultipleChoicePoints(
            options[value]?.isCorrect ?? false,
            quiz.activeQuestionStartedAt,
            answeredAtMs,
          )
        : 0;

    await createAnswer({
      quizId: participant.quizId,
      questionId,
      participantId: participant.$id,
      value,
      points,
      groupId: participant.groupId ?? undefined,
    });

    return NextResponse.json({ ok: true, value, points });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit vote.";

    if (message.includes("not open") || message.includes("not available")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

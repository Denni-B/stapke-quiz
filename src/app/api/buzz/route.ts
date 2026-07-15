import { NextResponse } from "next/server";

import { assertChapterOpenForQuestion, getParticipantBySessionToken } from "@/lib/answers";
import {
  createBuzz,
  getBuzzForParticipant,
  getBuzzOrderForQuestion,
  getGroupBuzzForQuestion,
} from "@/lib/buzzes";
import { appwriteConfig, isServerConfigured } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type { Question, Quiz, Participant } from "@/lib/types";

interface BuzzRequestBody {
  sessionToken?: string;
  questionId?: string;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 },
    );
  }

  let body: BuzzRequestBody;

  try {
    body = (await request.json()) as BuzzRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const sessionToken = body.sessionToken?.trim() ?? "";
  const questionId = body.questionId?.trim() ?? "";

  if (!sessionToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  if (!questionId) {
    return NextResponse.json({ error: "Missing question ID." }, { status: 400 });
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

    if (question.type !== "jeopardy") {
      return NextResponse.json({ error: "This question is not a Jeopardy clue." }, { status: 400 });
    }

    const quiz = await tablesDB.getRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: participant.quizId,
    });

    if (quiz.status !== "active") {
      return NextResponse.json({ error: "The quiz is not active." }, { status: 403 });
    }

    if (!quiz.activeQuestionId || quiz.activeQuestionId !== questionId) {
      return NextResponse.json(
        { error: "This question is not live right now." },
        { status: 403 },
      );
    }

    await assertChapterOpenForQuestion(participant.quizId, question.chapterId);

    const existing = await getBuzzForParticipant(questionId, participant.$id);

    if (existing) {
      const order = await getBuzzOrderForQuestion(questionId);
      const myEntry = order.find((entry) => entry.participantId === participant.$id);

      return NextResponse.json(
        {
          error: "Je hebt al ingebuzzed.",
          order: myEntry?.order,
        },
        { status: 409 },
      );
    }

    if (participant.groupId) {
      const teamBuzz = await getGroupBuzzForQuestion(questionId, participant.groupId);

      if (teamBuzz) {
        const { tablesDB: db } = createServerClient();
        let buzzedByDisplayName = "Je teamgenoot";

        try {
          const teammate = await db.getRow<Participant>({
            databaseId: appwriteConfig.databaseId,
            tableId: appwriteConfig.participantsTableId,
            rowId: teamBuzz.participantId,
          });
          buzzedByDisplayName = teammate.displayName;
        } catch {
          // Teammate may have been removed.
        }

        return NextResponse.json(
          {
            error: "Je team heeft al ingebuzzed.",
            teamBuzzedBy: buzzedByDisplayName,
          },
          { status: 409 },
        );
      }
    }

    await createBuzz({
      quizId: participant.quizId,
      questionId,
      participantId: participant.$id,
      groupId: participant.groupId,
    });

    const order = await getBuzzOrderForQuestion(questionId);
    const myEntry = order.find((entry) => entry.participantId === participant.$id);

    return NextResponse.json({ ok: true, order: myEntry?.order ?? order.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not submit buzz.";

    if (message.includes("not open") || message.includes("not available")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

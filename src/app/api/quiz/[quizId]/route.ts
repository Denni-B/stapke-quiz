import { Query } from "node-appwrite";
import { NextResponse } from "next/server";

import { getParticipantAnswerState, getParticipantBySessionToken } from "@/lib/answers";
import { buildPlayerState } from "@/lib/blackjack/state";
import { getParticipantJeopardyState } from "@/lib/buzzes";
import { appwriteConfig, isServerConfigured } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type {
  BlackjackPlayerState,
  Chapter,
  JeopardyPlayState,
  Question,
  QuestionOption,
  Quiz,
} from "@/lib/types";

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      { error: "Server is not configured." },
      { status: 500 },
    );
  }

  const { quizId } = await context.params;
  const { searchParams } = new URL(request.url);
  const sessionToken = searchParams.get("sessionToken")?.trim() ?? "";
  const { tablesDB } = createServerClient();

  try {
    const [quiz, chaptersResponse] = await Promise.all([
      tablesDB.getRow<Quiz>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.quizzesTableId,
        rowId: quizId,
      }),
      tablesDB.listRows<Chapter>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.chaptersTableId,
        queries: [Query.equal("quizId", quizId), Query.orderAsc("order")],
      }),
    ]);

    let activeQuestion: {
      id: string;
      type: string;
      text?: string;
      scaleMin?: number;
      scaleMax?: number;
      options: { text: string }[];
    } | null = null;

    let jeopardyChapterOpen = false;
    let blackjackChapterOpen = false;

    if (quiz.status === "active" && quiz.activeQuestionId) {
      try {
        const question = await tablesDB.getRow<Question>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.questionsTableId,
          rowId: quiz.activeQuestionId,
        });

        const openChapterIds = new Set(
          chaptersResponse.rows
            .filter((chapter) => chapter.isOpen === 1)
            .map((chapter) => chapter.$id),
        );

        if (question.chapterId && openChapterIds.has(question.chapterId)) {
          if (question.type === "jeopardy") {
            activeQuestion = {
              id: question.$id,
              type: question.type,
              text: question.text,
              options: [],
            };
          } else {
            activeQuestion = {
              id: question.$id,
              type: question.type,
              scaleMin: question.scaleMin,
              scaleMax: question.scaleMax,
              options:
                question.type === "multipleChoice"
                  ? (JSON.parse(question.options) as QuestionOption[]).map(({ text }) => ({
                      text,
                    }))
                  : [],
            };
          }
        }
      } catch {
        activeQuestion = null;
      }
    }

    const openJeopardyChapterIds = new Set(
      chaptersResponse.rows
        .filter((chapter) => chapter.isOpen === 1 && chapter.type === "jeopardy")
        .map((chapter) => chapter.$id),
    );

    if (
      quiz.status === "active" &&
      !quiz.activeQuestionId &&
      openJeopardyChapterIds.size > 0
    ) {
      jeopardyChapterOpen = true;
    }

    const openBlackjackChapterIds = new Set(
      chaptersResponse.rows
        .filter((chapter) => chapter.isOpen === 1 && chapter.type === "blackjack")
        .map((chapter) => chapter.$id),
    );

    if (
      quiz.status === "active" &&
      !quiz.activeQuestionId &&
      openBlackjackChapterIds.size > 0
    ) {
      blackjackChapterOpen = true;
    }

    let myVotes: Record<string, number> = {};
    let myPoints: Record<string, number> = {};
    let totalScore = 0;
    let preGroupScore = 0;
    let groupId: string | null = null;
    let groupName: string | null = null;
    let isInGroup = false;
    let jeopardy: JeopardyPlayState | undefined;
    let blackjack: BlackjackPlayerState | undefined;

    if (sessionToken) {
      const participant = await getParticipantBySessionToken(sessionToken);

      if (participant && participant.quizId === quizId) {
        const answerState = await getParticipantAnswerState(quizId, participant.$id, {
          participant,
        });
        myVotes = answerState.myVotes;
        myPoints = answerState.myPoints;
        totalScore = answerState.totalScore;
        preGroupScore = answerState.preGroupScore;
        groupId = answerState.groupId ?? null;
        groupName = answerState.groupName ?? null;
        isInGroup = answerState.isInGroup;

        const blackjackChapterId = blackjackChapterOpen
          ? chaptersResponse.rows.find(
              (chapter) => chapter.isOpen === 1 && chapter.type === "blackjack",
            )?.$id
          : undefined;

        const [jeopardyState, blackjackState] = await Promise.all([
          activeQuestion?.type === "jeopardy"
            ? getParticipantJeopardyState(activeQuestion.id, participant)
            : Promise.resolve(undefined),
          blackjackChapterId
            ? buildPlayerState(quizId, blackjackChapterId, participant, {
                totalScore: answerState.totalScore,
              }).catch((blackjackError) => {
                console.error("Failed to build blackjack player state:", blackjackError);
                return null;
              })
            : Promise.resolve(null),
        ]);

        if (jeopardyState) {
          jeopardy = jeopardyState;
        }

        if (blackjackState) {
          blackjack = blackjackState;
        }
      }
    }

    return NextResponse.json({
      title: quiz.title,
      status: quiz.status,
      activeQuestionId: quiz.activeQuestionId || null,
      activeQuestion,
      jeopardyChapterOpen,
      blackjackChapterOpen,
      jeopardy,
      blackjack,
      myVotes,
      myPoints,
      totalScore,
      preGroupScore,
      groupId,
      groupName,
      isInGroup,
    });
  } catch {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }
}

import { Query } from "node-appwrite";

import {
  assertChapterOpenForQuestion,
  assertQuizCreator,
  createAnswer,
  getAnswerForParticipant,
} from "@/lib/answers";
import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import { getBuzzOrderForQuestion } from "@/lib/buzzes";
import { getGroupVoteForQuestion } from "@/lib/groups";
import { parseJeopardyMeta } from "@/lib/jeopardy-utils";
import type { Answer, BuzzEntry, Participant, Question, Quiz } from "@/lib/types";

async function getAnswersForQuestion(questionId: string): Promise<Answer[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [Query.equal("questionId", questionId)],
  });

  return response.rows;
}

function resolveScoreForBuzz(
  buzz: BuzzEntry,
  answers: Answer[],
): { scoredPoints: number | null; isCorrect: boolean | null } {
  let answer: Answer | undefined;

  if (buzz.groupId) {
    answer = answers.find((entry) => entry.groupId === buzz.groupId);
  } else {
    answer = answers.find((entry) => entry.participantId === buzz.participantId);
  }

  if (!answer || answer.points === undefined || answer.points === null) {
    return { scoredPoints: null, isCorrect: null };
  }

  return {
    scoredPoints: answer.points,
    isCorrect: answer.value === 1,
  };
}

export async function getBuzzOrderWithScoresForQuestion(
  questionId: string,
): Promise<BuzzEntry[]> {
  const [buzzes, answers] = await Promise.all([
    getBuzzOrderForQuestion(questionId),
    getAnswersForQuestion(questionId),
  ]);

  return buzzes.map((buzz) => {
    const score = resolveScoreForBuzz(buzz, answers);
    return { ...buzz, ...score };
  });
}

export async function awardJeopardyScoreForHost(
  quizId: string,
  userId: string,
  questionId: string,
  participantId: string,
  correct: boolean,
): Promise<{ points: number; participantId: string; groupId?: string | null }> {
  await assertQuizCreator(quizId, userId);

  const { tablesDB } = createServerClient();

  const quiz = await tablesDB.getRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
  });

  if (quiz.status !== "active") {
    throw new Error("The quiz is not active.");
  }

  if (!quiz.activeQuestionId || quiz.activeQuestionId !== questionId) {
    throw new Error("This clue is not live right now.");
  }

  const question = await tablesDB.getRow<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    rowId: questionId,
  });

  if (question.quizId !== quizId) {
    throw new Error("Question not found.");
  }

  if (question.type !== "jeopardy") {
    throw new Error("This question is not a Jeopardy clue.");
  }

  await assertChapterOpenForQuestion(quizId, question.chapterId);

  const participant = await tablesDB.getRow<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    rowId: participantId,
  });

  if (participant.quizId !== quizId) {
    throw new Error("Participant not found.");
  }

  const meta = parseJeopardyMeta(question.options);
  const pointValue = meta.pointValue;

  if (!pointValue) {
    throw new Error("This clue has no point value.");
  }

  const points = correct ? pointValue : -pointValue;
  const value = correct ? 1 : 0;

  const existing = participant.groupId
    ? await getGroupVoteForQuestion(questionId, participant.groupId)
    : await getAnswerForParticipant(questionId, participantId);

  if (existing) {
    await tablesDB.updateRow<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      rowId: existing.$id,
      data: {
        participantId,
        value,
        points,
        groupId: participant.groupId ?? undefined,
      },
    });
  } else {
    await createAnswer({
      quizId,
      questionId,
      participantId,
      value,
      points,
      groupId: participant.groupId ?? undefined,
    });
  }

  return {
    points,
    participantId,
    groupId: participant.groupId ?? null,
  };
}

import { Query } from "node-appwrite";

import { assertQuizCreator } from "@/lib/answers";
import { resetBlackjackGame } from "@/lib/blackjack/state";
import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import { parseJeopardyMeta, serializeJeopardyMeta } from "@/lib/jeopardy-utils";
import type { Chapter, Question, Quiz } from "@/lib/types";

async function deleteAllRowsForQuiz(
  tableId: string,
  quizId: string,
  queryField: "quizId" = "quizId",
) {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows({
    databaseId: appwriteConfig.databaseId,
    tableId,
    queries: [Query.equal(queryField, quizId)],
  });

  await Promise.all(
    response.rows.map((row) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId,
        rowId: row.$id,
      }),
    ),
  );
}

async function resetJeopardyQuestionsForQuiz(quizId: string) {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: [Query.equal("quizId", quizId), Query.equal("type", "jeopardy")],
  });

  await Promise.all(
    response.rows.map((question) => {
      const meta = parseJeopardyMeta(question.options);

      if (!meta.isPlayed) {
        return Promise.resolve();
      }

      return tablesDB.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.questionsTableId,
        rowId: question.$id,
        data: {
          options: serializeJeopardyMeta({ ...meta, isPlayed: false }),
        },
      });
    }),
  );
}

async function closeAllQuizChapters(quizId: string) {
  const { tablesDB } = createServerClient();

  const chapters = await tablesDB.listRows<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  await Promise.all(
    chapters.rows.map((chapter) =>
      tablesDB.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.chaptersTableId,
        rowId: chapter.$id,
        data: { isOpen: 0 },
      }),
    ),
  );
}

export async function resetQuizForHost(
  quizId: string,
  userId: string,
): Promise<{ quiz: Quiz; chapters: Chapter[] }> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "open" && quiz.status !== "active") {
    throw new Error("Only an open or active quiz can be reset.");
  }

  const { tablesDB } = createServerClient();

  await Promise.all([
    deleteAllRowsForQuiz(appwriteConfig.buzzesTableId, quizId),
    deleteAllRowsForQuiz(appwriteConfig.answersTableId, quizId),
    deleteAllRowsForQuiz(appwriteConfig.participantsTableId, quizId),
    deleteAllRowsForQuiz(appwriteConfig.groupsTableId, quizId),
    resetJeopardyQuestionsForQuiz(quizId),
  ]);

  const chaptersResponse = await tablesDB.listRows<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    queries: [Query.equal("quizId", quizId), Query.orderAsc("order")],
  });

  const blackjackChapters = chaptersResponse.rows.filter(
    (chapter) => chapter.type === "blackjack",
  );

  await Promise.all(
    blackjackChapters.map((chapter) => resetBlackjackGame(quizId, chapter.$id)),
  );

  await closeAllQuizChapters(quizId);

  const updatedQuiz = await tablesDB.updateRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
    data: {
      status: "open",
      activeQuestionId: "",
      activeQuestionStartedAt: 0,
    },
  });

  const chapters = await tablesDB.listRows<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    queries: [Query.equal("quizId", quizId), Query.orderAsc("order")],
  });

  return { quiz: updatedQuiz, chapters: chapters.rows };
}

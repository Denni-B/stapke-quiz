import { assertQuizCreator } from "@/lib/answers";
import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type { Chapter, Question, Quiz } from "@/lib/types";

export async function setActiveQuestionForHostOnServer(
  quizId: string,
  userId: string,
  questionId: string | null,
  options?: { preserveTimer?: boolean },
): Promise<Quiz> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "active") {
    throw new Error("Start the quiz before presenting questions.");
  }

  const { tablesDB } = createServerClient();

  if (!questionId) {
    return tablesDB.updateRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: quizId,
      data: { activeQuestionId: "", activeQuestionStartedAt: 0 },
    });
  }

  const question = await tablesDB.getRow<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    rowId: questionId,
  });

  if (question.quizId !== quizId) {
    throw new Error("Question does not belong to this quiz.");
  }

  if (!question.chapterId) {
    throw new Error("Question is not assigned to a chapter.");
  }

  const chapter = await tablesDB.getRow<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    rowId: question.chapterId,
  });

  if (chapter.isOpen !== 1) {
    throw new Error("Open the chapter before presenting this question.");
  }

  const preserveTimer = options?.preserveTimer ?? false;
  const data: {
    activeQuestionId: string;
    activeQuestionStartedAt?: number;
  } = {
    activeQuestionId: questionId,
  };

  const shouldSetStartedAt =
    !preserveTimer ||
    quiz.activeQuestionId !== questionId ||
    !quiz.activeQuestionStartedAt;

  if (shouldSetStartedAt) {
    data.activeQuestionStartedAt = Date.now();
  }

  return tablesDB.updateRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
    data,
  });
}

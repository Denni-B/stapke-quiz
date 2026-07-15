import { ID, Query } from "appwrite";

import { tablesDB } from "@/lib/appwrite/client";
import { appwriteConfig } from "@/lib/appwrite/config";
import { generateQuizCode } from "@/lib/quiz-code";
import { parseQuestionWithJeopardy, serializeJeopardyMeta } from "@/lib/jeopardy-utils";
import type {
  Chapter,
  ParsedQuestion,
  Question,
  QuestionOption,
  Quiz,
  QuizFormData,
  QuizStatus,
} from "@/lib/types";
import { storage } from "@/lib/appwrite/client";

function parseQuestion(question: Question): ParsedQuestion {
  return parseQuestionWithJeopardy(question);
}

function serializeQuestionOptions(
  question: QuizFormData["questions"][number],
): string {
  if (question.type === "jeopardy" && question.jeopardyMeta) {
    return serializeJeopardyMeta(question.jeopardyMeta);
  }

  if (question.type === "multipleChoice") {
    return JSON.stringify(question.options);
  }

  return JSON.stringify([]);
}

async function deleteImageFile(fileId: string | undefined) {
  if (!fileId) return;
  if (!appwriteConfig.imagesBucketId) return;

  try {
    await storage.deleteFile({
      bucketId: appwriteConfig.imagesBucketId,
      fileId,
    });
  } catch {
    // Best-effort cleanup only (files may already be gone or permission-limited).
  }
}

export async function listCreatorQuizzes(userId: string): Promise<Quiz[]> {
  const response = await tablesDB.listRows<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    queries: [Query.equal("creatorId", userId), Query.orderDesc("$createdAt")],
  });

  return response.rows;
}

export async function getQuiz(quizId: string): Promise<Quiz | null> {
  try {
    return await tablesDB.getRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: quizId,
    });
  } catch {
    return null;
  }
}

export async function getQuizQuestions(quizId: string): Promise<ParsedQuestion[]> {
  const response = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: [Query.equal("quizId", quizId), Query.orderAsc("order")],
  });

  return response.rows.map(parseQuestion);
}

export async function listQuizChapters(quizId: string): Promise<Chapter[]> {
  const response = await tablesDB.listRows<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    queries: [Query.equal("quizId", quizId), Query.orderAsc("order")],
  });

  return response.rows;
}

async function assertQuizCreator(quizId: string, userId: string): Promise<Quiz> {
  const quiz = await getQuiz(quizId);

  if (!quiz) {
    throw new Error("Quiz not found.");
  }

  if (quiz.creatorId !== userId) {
    throw new Error("You do not have permission to host this quiz.");
  }

  return quiz;
}

async function setQuizStatus(quizId: string, status: QuizStatus): Promise<Quiz> {
  const data: {
    status: QuizStatus;
    activeQuestionId?: string;
    activeQuestionStartedAt?: number;
  } = { status };

  if (status === "closed") {
    data.activeQuestionId = "";
    data.activeQuestionStartedAt = 0;
  }

  return tablesDB.updateRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
    data,
  });
}

async function closeAllQuizChapters(quizId: string) {
  const chapters = await listQuizChapters(quizId);

  await Promise.all(
    chapters.map((chapter) =>
      tablesDB.updateRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.chaptersTableId,
        rowId: chapter.$id,
        data: { isOpen: 0 },
      }),
    ),
  );
}

export async function getQuizHostData(quizId: string, userId: string) {
  const quiz = await assertQuizCreator(quizId, userId);
  const chapters = await listQuizChapters(quizId);

  return { quiz, chapters };
}

export async function openQuizForHost(quizId: string, userId: string): Promise<Quiz> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "draft" && quiz.status !== "closed") {
    throw new Error("Only a draft or closed quiz can be opened.");
  }

  await closeAllQuizChapters(quizId);
  return setQuizStatus(quizId, "open");
}

export async function startQuizForHost(quizId: string, userId: string): Promise<Quiz> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "open") {
    throw new Error("Open the quiz for players before starting.");
  }

  return setQuizStatus(quizId, "active");
}

export async function endQuizForHost(quizId: string, userId: string): Promise<Quiz> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "active") {
    throw new Error("Only an active quiz can be ended.");
  }

  await closeAllQuizChapters(quizId);
  return setQuizStatus(quizId, "closed");
}

export async function setChapterOpenForHost(
  quizId: string,
  userId: string,
  chapterId: string,
  isOpen: boolean,
): Promise<void> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "active") {
    throw new Error("Start the quiz before opening chapters.");
  }

  const chapter = await tablesDB.getRow<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    rowId: chapterId,
  });

  if (chapter.quizId !== quizId) {
    throw new Error("Chapter does not belong to this quiz.");
  }

  await tablesDB.updateRow({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    rowId: chapterId,
    data: { isOpen: isOpen ? 1 : 0 },
  });

  if (!isOpen && quiz.activeQuestionId) {
    const activeQuestion = await tablesDB.getRow<Question>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.questionsTableId,
      rowId: quiz.activeQuestionId,
    });

    if (activeQuestion.chapterId === chapterId) {
      await tablesDB.updateRow<Quiz>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.quizzesTableId,
        rowId: quizId,
        data: { activeQuestionId: "", activeQuestionStartedAt: 0 },
      });
    }
  }
}

export async function setActiveQuestionForHost(
  quizId: string,
  userId: string,
  questionId: string | null,
): Promise<Quiz> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "active") {
    throw new Error("Start the quiz before presenting questions.");
  }

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

  const data: {
    activeQuestionId: string;
    activeQuestionStartedAt?: number;
  } = {
    activeQuestionId: questionId,
  };

  // Keep the original start time when the host re-opens the same live question
  // (e.g. Previous/Next or "Continue presenting") so points keep counting down.
  if (quiz.activeQuestionId !== questionId || !quiz.activeQuestionStartedAt) {
    data.activeQuestionStartedAt = Date.now();
  }

  return tablesDB.updateRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
    data,
  });
}

export async function markJeopardyQuestionPlayedForHost(
  quizId: string,
  userId: string,
  questionId: string,
): Promise<ParsedQuestion> {
  await assertQuizCreator(quizId, userId);

  const question = await tablesDB.getRow<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    rowId: questionId,
  });

  if (question.quizId !== quizId) {
    throw new Error("Question does not belong to this quiz.");
  }

  if (question.type !== "jeopardy") {
    throw new Error("Question is not a Jeopardy clue.");
  }

  const parsed = parseQuestion(question);
  const meta = parsed.jeopardyMeta ?? {
    category: "",
    pointValue: 0,
    answer: "",
    isPlayed: false,
  };

  const updated = await tablesDB.updateRow<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    rowId: questionId,
    data: {
      options: serializeJeopardyMeta({ ...meta, isPlayed: true }),
    },
  });

  return parseQuestion(updated);
}

export async function startChapterForHost(
  quizId: string,
  userId: string,
  chapterId: string,
): Promise<Quiz> {
  const quiz = await assertQuizCreator(quizId, userId);

  if (quiz.status !== "active") {
    throw new Error("Start the quiz before opening chapters.");
  }

  const chapter = await tablesDB.getRow<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    rowId: chapterId,
  });

  if (chapter.quizId !== quizId) {
    throw new Error("Chapter does not belong to this quiz.");
  }

  const allChapters = await listQuizChapters(quizId);

  const otherOpenChapters = allChapters.filter(
    (item) => item.isOpen === 1 && item.$id !== chapterId,
  );

  for (const item of otherOpenChapters) {
    await setChapterOpenForHost(quizId, userId, item.$id, false);
  }

  await setChapterOpenForHost(quizId, userId, chapterId, true);

  if (chapter.type === "jeopardy" || chapter.type === "blackjack") {
    return tablesDB.updateRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: quizId,
      data: { activeQuestionId: "", activeQuestionStartedAt: 0 },
    });
  }

  const questionsResponse = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: [
      Query.equal("quizId", quizId),
      Query.equal("chapterId", chapterId),
      Query.orderAsc("order"),
      Query.limit(1),
    ],
  });

  const firstQuestion = questionsResponse.rows[0];

  if (!firstQuestion) {
    return tablesDB.getRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: quizId,
    });
  }

  return setActiveQuestionForHost(quizId, userId, firstQuestion.$id);
}

async function isCodeTaken(code: string): Promise<boolean> {
  const response = await tablesDB.listRows<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    queries: [Query.equal("code", code), Query.limit(1)],
  });

  return response.rows.length > 0;
}

async function generateUniqueQuizCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = generateQuizCode();
    const taken = await isCodeTaken(code);

    if (!taken) {
      return code;
    }
  }

  throw new Error("Could not generate a unique quiz code. Please try again.");
}

export async function createQuiz(
  userId: string,
  data: QuizFormData,
  status: QuizStatus = "draft",
): Promise<Quiz> {
  const code = await generateUniqueQuizCode();

  const quiz = await tablesDB.createRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: ID.unique(),
    data: {
      title: data.title.trim(),
      description: data.description.trim() || undefined,
      code,
      creatorId: userId,
      status,
    },
  });

  // Create chapters first so questions can reference them.
  await Promise.all(
    data.chapters.map((chapter) =>
      tablesDB.createRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.chaptersTableId,
        rowId: chapter.id,
        data: {
          quizId: quiz.$id,
          title: chapter.title.trim(),
          order: chapter.order,
          isOpen: 0,
          type: chapter.type,
        },
      }),
    ),
  );

  await Promise.all(
    data.questions.map((question, index) =>
      tablesDB.createRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.questionsTableId,
        rowId: ID.unique(),
        data: {
          quizId: quiz.$id,
          chapterId: question.chapterId || undefined,
          type: question.type,
          scaleMin: question.type === "scale1to10" ? question.scaleMin ?? 1 : undefined,
          scaleMax: question.type === "scale1to10" ? question.scaleMax ?? 10 : undefined,
          text: question.text.trim(),
          order: index,
          options: serializeQuestionOptions(question),
          imageFileId: question.imageFileId || undefined,
        },
      }),
    ),
  );

  return quiz;
}

export async function updateQuiz(
  quizId: string,
  data: QuizFormData,
): Promise<Quiz> {
  const quiz = await tablesDB.updateRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
    data: {
      title: data.title.trim(),
      description: data.description.trim() || undefined,
    },
  });

  // Replace chapters (simple MVP).
  const existingChapters = await tablesDB.listRows<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  await Promise.all(
    existingChapters.rows.map((chapter) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.chaptersTableId,
        rowId: chapter.$id,
      }),
    ),
  );

  await Promise.all(
    data.chapters.map((chapter) =>
      tablesDB.createRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.chaptersTableId,
        rowId: chapter.id,
        data: {
          quizId,
          title: chapter.title.trim(),
          order: chapter.order,
          isOpen: 0,
          type: chapter.type,
        },
      }),
    ),
  );

  const existingQuestions = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  await Promise.all(
    existingQuestions.rows.map((question) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.questionsTableId,
        rowId: question.$id,
      }),
    ),
  );

  await Promise.all(
    data.questions.map((question, index) =>
      tablesDB.createRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.questionsTableId,
        rowId: ID.unique(),
        data: {
          quizId,
          chapterId: question.chapterId || undefined,
          type: question.type,
          scaleMin: question.type === "scale1to10" ? question.scaleMin ?? 1 : undefined,
          scaleMax: question.type === "scale1to10" ? question.scaleMax ?? 10 : undefined,
          text: question.text.trim(),
          order: index,
          options: serializeQuestionOptions(question),
          imageFileId: question.imageFileId || undefined,
        },
      }),
    ),
  );

  return quiz;
}

export async function deleteQuiz(quizId: string) {
  // 1) Fetch existing questions so we can remove their images (best-effort).
  const existingQuestions = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  for (const question of existingQuestions.rows) {
    await deleteImageFile(question.imageFileId);

    try {
      const options = JSON.parse(question.options) as QuestionOption[];
      for (const option of options) {
        await deleteImageFile(option.imageFileId);
      }
    } catch {
      // Ignore malformed data; still try to delete rows.
    }
  }

  // 2) Delete question rows.
  await Promise.all(
    existingQuestions.rows.map((question) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.questionsTableId,
        rowId: question.$id,
      }),
    ),
  );

  // 3) Delete the quiz row.
  await tablesDB.deleteRow({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
  });
}

import { NextResponse } from "next/server";
import { Query } from "node-appwrite";

import { appwriteConfig, isServerConfigured } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type { Chapter, Quiz, QuizStatus } from "@/lib/types";

type HostActionBody = { action: "open" } | { action: "start" } | { action: "end" };
type HostChapterBody = { chapterId: string; isOpen: boolean };
type HostPostBody = HostActionBody | HostChapterBody;

function isHostActionBody(body: HostPostBody): body is HostActionBody {
  return "action" in body;
}

async function updateQuizStatus(quizId: string, status: QuizStatus) {
  const { tablesDB } = createServerClient();
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

async function closeAllChapters(quizId: string) {
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;
  const { tablesDB } = createServerClient();

  try {
    const quiz = await tablesDB.getRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: quizId,
    });

    const chapters = await tablesDB.listRows<Chapter>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.chaptersTableId,
      queries: [Query.equal("quizId", quizId), Query.orderAsc("order")],
    });

    return NextResponse.json({
      quiz: {
        title: quiz.title,
        code: quiz.code,
        status: quiz.status,
      },
      chapters: chapters.rows,
    });
  } catch {
    return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;
  const { tablesDB } = createServerClient();

  let body: HostPostBody;
  try {
    body = (await request.json()) as HostPostBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (isHostActionBody(body)) {
    try {
      const quiz = await tablesDB.getRow<Quiz>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.quizzesTableId,
        rowId: quizId,
      });

      if (body.action === "open") {
        if (quiz.status !== "draft" && quiz.status !== "closed") {
          return NextResponse.json(
            { error: "Only a draft or closed quiz can be opened." },
            { status: 400 },
          );
        }

        await closeAllChapters(quizId);
        const updated = await updateQuizStatus(quizId, "open");
        return NextResponse.json({ ok: true, status: updated.status });
      }

      if (body.action === "start") {
        if (quiz.status !== "open") {
          return NextResponse.json(
            { error: "Open the quiz for players before starting." },
            { status: 400 },
          );
        }

        const updated = await updateQuizStatus(quizId, "active");
        return NextResponse.json({ ok: true, status: updated.status });
      }

      if (quiz.status !== "active") {
        return NextResponse.json(
          { error: "Only an active quiz can be ended." },
          { status: 400 },
        );
      }

      await closeAllChapters(quizId);
      const updated = await updateQuizStatus(quizId, "closed");
      return NextResponse.json({ ok: true, status: updated.status });
    } catch {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }
  }

  if (!body.chapterId || typeof body.isOpen !== "boolean") {
    return NextResponse.json({ error: "Missing chapterId or isOpen." }, { status: 400 });
  }

  try {
    const quiz = await tablesDB.getRow<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      rowId: quizId,
    });

    if (quiz.status !== "active") {
      return NextResponse.json(
        { error: "Start the quiz before opening chapters." },
        { status: 400 },
      );
    }

    const chapter = await tablesDB.getRow<Chapter>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.chaptersTableId,
      rowId: body.chapterId,
    });

    if (chapter.quizId !== quizId) {
      return NextResponse.json({ error: "Chapter does not belong to quiz." }, { status: 403 });
    }

    await tablesDB.updateRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.chaptersTableId,
      rowId: body.chapterId,
      data: { isOpen: body.isOpen ? 1 : 0 },
    });
  } catch {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

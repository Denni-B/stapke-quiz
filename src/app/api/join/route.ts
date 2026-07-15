import { ID, Query } from "node-appwrite";
import { NextResponse } from "next/server";

import { appwriteConfig, isServerConfigured } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import { normalizeQuizCode } from "@/lib/quiz-code";
import type { Quiz } from "@/lib/types";

interface JoinRequestBody {
  code?: string;
  displayName?: string;
}

export async function POST(request: Request) {
  if (!isServerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Server is not configured. Add APPWRITE_API_KEY and table IDs to .env.local.",
      },
      { status: 500 },
    );
  }

  let body: JoinRequestBody;

  try {
    body = (await request.json()) as JoinRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const code = normalizeQuizCode(body.code ?? "");
  const displayName = body.displayName?.trim() ?? "";

  if (!code || code.length < 4) {
    return NextResponse.json({ error: "Enter a valid quiz code." }, { status: 400 });
  }

  if (!displayName || displayName.length < 2) {
    return NextResponse.json(
      { error: "Display name must be at least 2 characters." },
      { status: 400 },
    );
  }

  const { tablesDB } = createServerClient();

  try {
    const quizResponse = await tablesDB.listRows<Quiz>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.quizzesTableId,
      queries: [Query.equal("code", code), Query.limit(1)],
    });

    const quiz = quizResponse.rows[0];

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }

    if (quiz.status === "closed") {
      return NextResponse.json(
        { error: "This quiz is no longer accepting players." },
        { status: 403 },
      );
    }

    if (quiz.status === "draft") {
      return NextResponse.json(
        { error: "This quiz is not open yet. Ask the host to open it." },
        { status: 403 },
      );
    }

    const sessionToken = crypto.randomUUID().replace(/-/g, "");

    await tablesDB.createRow({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.participantsTableId,
      rowId: ID.unique(),
      data: {
        quizId: quiz.$id,
        displayName,
        sessionToken,
      },
    });

    return NextResponse.json({
      quizId: quiz.$id,
      displayName,
      sessionToken,
      quizTitle: quiz.title,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not join quiz.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

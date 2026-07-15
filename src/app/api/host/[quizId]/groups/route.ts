import { NextResponse } from "next/server";

import { assertQuizCreator } from "@/lib/answers";
import { isServerConfigured } from "@/lib/appwrite/config";
import {
  createGroup,
  getGroupsWithMembersForQuiz,
} from "@/lib/groups";

export async function GET(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  try {
    await assertQuizCreator(quizId, userId);
    const groups = await getGroupsWithMembersForQuiz(quizId);

    return NextResponse.json({ groups });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load groups.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 404 });
  }
}

interface CreateGroupBody {
  participantIds?: string[];
  name?: string;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ quizId: string }> },
) {
  if (!isServerConfigured()) {
    return NextResponse.json({ error: "Server is not configured." }, { status: 500 });
  }

  const { quizId } = await context.params;
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim() ?? "";

  if (!userId) {
    return NextResponse.json({ error: "Missing user ID." }, { status: 400 });
  }

  let body: CreateGroupBody;

  try {
    body = (await request.json()) as CreateGroupBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const participantIds = body.participantIds ?? [];

  if (participantIds.length < 2) {
    return NextResponse.json(
      { error: "Select at least two players to create a group." },
      { status: 400 },
    );
  }

  try {
    await assertQuizCreator(quizId, userId);
    const group = await createGroup(quizId, participantIds, body.name);
    const groups = await getGroupsWithMembersForQuiz(quizId);
    const created = groups.find((entry) => entry.id === group.$id);

    return NextResponse.json({ group: created ?? group });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create group.";

    if (message.includes("permission")) {
      return NextResponse.json({ error: message }, { status: 403 });
    }

    return NextResponse.json({ error: message }, { status: 400 });
  }
}

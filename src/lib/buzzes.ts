import { ID, Query } from "node-appwrite";

import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type { Buzz, BuzzEntry, Group, Participant } from "@/lib/types";

export async function createBuzz(data: {
  quizId: string;
  questionId: string;
  participantId: string;
  groupId?: string | null;
}): Promise<Buzz> {
  const { tablesDB } = createServerClient();

  return tablesDB.createRow<Buzz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.buzzesTableId,
    rowId: ID.unique(),
    data: {
      quizId: data.quizId,
      questionId: data.questionId,
      participantId: data.participantId,
      groupId: data.groupId ?? undefined,
      buzzedAt: Date.now(),
    },
  });
}

export async function getBuzzForParticipant(
  questionId: string,
  participantId: string,
): Promise<Buzz | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Buzz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.buzzesTableId,
    queries: [
      Query.equal("questionId", questionId),
      Query.equal("participantId", participantId),
      Query.limit(1),
    ],
  });

  return response.rows[0] ?? null;
}

export async function getGroupBuzzForQuestion(
  questionId: string,
  groupId: string,
): Promise<Buzz | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Buzz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.buzzesTableId,
    queries: [
      Query.equal("questionId", questionId),
      Query.equal("groupId", groupId),
      Query.orderAsc("buzzedAt"),
      Query.limit(1),
    ],
  });

  return response.rows[0] ?? null;
}

export async function getBuzzesForQuestion(questionId: string): Promise<Buzz[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Buzz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.buzzesTableId,
    queries: [Query.equal("questionId", questionId), Query.orderAsc("buzzedAt")],
  });

  return response.rows;
}

export async function getBuzzOrderForQuestion(questionId: string): Promise<BuzzEntry[]> {
  const buzzes = await getBuzzesForQuestion(questionId);

  if (buzzes.length === 0) {
    return [];
  }

  const { tablesDB } = createServerClient();
  const participantIds = [...new Set(buzzes.map((buzz) => buzz.participantId))];
  const groupIds = [
    ...new Set(buzzes.map((buzz) => buzz.groupId).filter(Boolean)),
  ] as string[];

  const participants = new Map<string, Participant>();
  const groups = new Map<string, Group>();

  for (const participantId of participantIds) {
    try {
      const participant = await tablesDB.getRow<Participant>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.participantsTableId,
        rowId: participantId,
      });
      participants.set(participantId, participant);
    } catch {
      // Participant may have been removed.
    }
  }

  for (const groupId of groupIds) {
    try {
      const group = await tablesDB.getRow<Group>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.groupsTableId,
        rowId: groupId,
      });
      groups.set(groupId, group);
    } catch {
      // Group may have been dissolved.
    }
  }

  return buzzes.map((buzz, index) => {
    const participant = participants.get(buzz.participantId);
    const group = buzz.groupId ? groups.get(buzz.groupId) : undefined;

    return {
      order: index + 1,
      participantId: buzz.participantId,
      displayName: participant?.displayName ?? "Unknown",
      groupId: buzz.groupId ?? null,
      groupName: group?.name ?? null,
      buzzedAt: buzz.buzzedAt,
    };
  });
}

export async function getParticipantJeopardyState(
  questionId: string,
  participant: Participant,
): Promise<{
  canBuzz: boolean;
  hasBuzzed: boolean;
  myBuzzOrder?: number;
  teamBuzzedBy?: string;
}> {
  const ownBuzz = await getBuzzForParticipant(questionId, participant.$id);

  if (ownBuzz) {
    const order = await getBuzzOrderForQuestion(questionId);
    const myEntry = order.find((entry) => entry.participantId === participant.$id);

    return {
      canBuzz: false,
      hasBuzzed: true,
      myBuzzOrder: myEntry?.order,
    };
  }

  if (participant.groupId) {
    const teamBuzz = await getGroupBuzzForQuestion(questionId, participant.groupId);

    if (teamBuzz && teamBuzz.participantId !== participant.$id) {
      const { tablesDB } = createServerClient();

      try {
        const teammate = await tablesDB.getRow<Participant>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.participantsTableId,
          rowId: teamBuzz.participantId,
        });

        return {
          canBuzz: false,
          hasBuzzed: false,
          teamBuzzedBy: teammate.displayName,
        };
      } catch {
        return {
          canBuzz: false,
          hasBuzzed: false,
          teamBuzzedBy: "Je teamgenoot",
        };
      }
    }
  }

  return {
    canBuzz: true,
    hasBuzzed: false,
  };
}

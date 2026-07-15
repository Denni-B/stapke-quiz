import { ID, Query } from "node-appwrite";

import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type { Answer, Group, Participant } from "@/lib/types";

export function distributePoints(total: number, memberCount: number): number[] {
  if (memberCount <= 0) {
    return [];
  }

  const base = Math.floor(total / memberCount);
  const remainder = total % memberCount;

  return Array.from({ length: memberCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function buildDefaultGroupName(names: string[]): string {
  if (names.length === 0) {
    return "Groep";
  }

  if (names.length === 1) {
    return names[0];
  }

  if (names.length === 2) {
    return `${names[0]} & ${names[1]}`;
  }

  const last = names[names.length - 1];
  const rest = names.slice(0, -1).join(", ");
  return `${rest} & ${last}`;
}

export async function getGroupMembers(groupId: string): Promise<Participant[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    queries: [Query.equal("groupId", groupId)],
  });

  return response.rows;
}

export async function getGroupsForQuiz(quizId: string): Promise<Group[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Group>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.groupsTableId,
    queries: [Query.equal("quizId", quizId), Query.orderAsc("createdAt")],
  });

  return response.rows;
}

export async function getAnswerForGroup(
  questionId: string,
  groupId: string,
): Promise<Answer | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [
      Query.equal("questionId", questionId),
      Query.equal("groupId", groupId),
      Query.limit(1),
    ],
  });

  return response.rows[0] ?? null;
}

export async function getGroupVoteForQuestion(
  questionId: string,
  groupId: string,
): Promise<Answer | null> {
  const teamAnswer = await getAnswerForGroup(questionId, groupId);

  if (teamAnswer) {
    return teamAnswer;
  }

  const members = await getGroupMembers(groupId);
  const { tablesDB } = createServerClient();

  for (const member of members) {
    const response = await tablesDB.listRows<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      queries: [
        Query.equal("questionId", questionId),
        Query.equal("participantId", member.$id),
        Query.limit(1),
      ],
    });

    if (response.rows[0]) {
      return response.rows[0];
    }
  }

  return null;
}

export function computePreGroupScore(
  participantId: string,
  answers: Answer[],
): number {
  return answers
    .filter((answer) => answer.participantId === participantId && !answer.groupId)
    .reduce((sum, answer) => sum + (answer.points ?? 0), 0);
}

export function computeTeamScore(
  groupId: string,
  memberIds: string[],
  answers: Answer[],
): number {
  const memberIdSet = new Set(memberIds);
  const preGroupTotal = answers
    .filter((answer) => !answer.groupId && memberIdSet.has(answer.participantId))
    .reduce((sum, answer) => sum + (answer.points ?? 0), 0);
  const teamPoolTotal = answers
    .filter((answer) => answer.groupId === groupId)
    .reduce((sum, answer) => sum + (answer.points ?? 0), 0);

  return preGroupTotal + teamPoolTotal;
}

export async function createGroup(
  quizId: string,
  participantIds: string[],
  name?: string,
): Promise<Group> {
  const uniqueIds = [...new Set(participantIds)];

  if (uniqueIds.length < 2) {
    throw new Error("Select at least two players to create a group.");
  }

  const { tablesDB } = createServerClient();
  const participants = await Promise.all(
    uniqueIds.map((participantId) =>
      tablesDB.getRow<Participant>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.participantsTableId,
        rowId: participantId,
      }),
    ),
  );

  for (const participant of participants) {
    if (participant.quizId !== quizId) {
      throw new Error("One or more players do not belong to this quiz.");
    }

    if (participant.groupId) {
      throw new Error(`${participant.displayName} is already in a group.`);
    }
  }

  const groupName =
    name?.trim() ||
    buildDefaultGroupName(participants.map((participant) => participant.displayName));

  const group = await tablesDB.createRow<Group>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.groupsTableId,
    rowId: ID.unique(),
    data: {
      quizId,
      name: groupName,
      createdAt: Date.now(),
    },
  });

  await Promise.all(
    participants.map((participant) =>
      tablesDB.updateRow<Participant>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.participantsTableId,
        rowId: participant.$id,
        data: { groupId: group.$id },
      }),
    ),
  );

  return group;
}

async function findPreGroupAnswer(
  questionId: string,
  participantId: string,
  excludeAnswerId?: string,
): Promise<Answer | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [
      Query.equal("questionId", questionId),
      Query.equal("participantId", participantId),
    ],
  });

  return (
    response.rows.find(
      (answer) => answer.$id !== excludeAnswerId && !answer.groupId,
    ) ?? null
  );
}

async function grantIndividualShare(
  teamAnswer: Answer,
  participantId: string,
  share: number,
): Promise<"converted" | "merged" | "created"> {
  const { tablesDB } = createServerClient();
  const preGroupAnswer = await findPreGroupAnswer(
    teamAnswer.questionId,
    participantId,
    teamAnswer.$id,
  );

  if (preGroupAnswer) {
    await tablesDB.updateRow<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      rowId: preGroupAnswer.$id,
      data: {
        points: (preGroupAnswer.points ?? 0) + share,
      },
    });
    return "merged";
  }

  if (participantId === teamAnswer.participantId) {
    await tablesDB.updateRow<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      rowId: teamAnswer.$id,
      data: {
        groupId: null,
        points: share,
      },
    });
    return "converted";
  }

  await tablesDB.createRow<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    rowId: ID.unique(),
    data: {
      quizId: teamAnswer.quizId,
      questionId: teamAnswer.questionId,
      participantId,
      value: teamAnswer.value,
      points: share,
    },
  });
  return "created";
}

export async function distributeGroupPoints(
  groupId: string,
  memberIds: string[],
): Promise<void> {
  if (memberIds.length === 0) {
    return;
  }

  const { tablesDB } = createServerClient();

  const teamAnswersResponse = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [Query.equal("groupId", groupId)],
  });

  for (const teamAnswer of teamAnswersResponse.rows) {
    const shares = distributePoints(teamAnswer.points ?? 0, memberIds.length);
    let voterAnswerConverted = false;

    for (let index = 0; index < memberIds.length; index += 1) {
      const participantId = memberIds[index];
      const share = shares[index] ?? 0;
      const result = await grantIndividualShare(teamAnswer, participantId, share);

      if (result === "converted") {
        voterAnswerConverted = true;
      }
    }

    if (!voterAnswerConverted) {
      await tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.answersTableId,
        rowId: teamAnswer.$id,
      });
    }
  }
}

export async function dissolveGroup(quizId: string, groupId: string): Promise<void> {
  const { tablesDB } = createServerClient();

  const group = await tablesDB.getRow<Group>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.groupsTableId,
    rowId: groupId,
  });

  if (group.quizId !== quizId) {
    throw new Error("Group not found.");
  }

  const members = await getGroupMembers(groupId);
  const memberIds = members.map((member) => member.$id);

  await distributeGroupPoints(groupId, memberIds);

  await Promise.all(
    members.map((member) =>
      tablesDB.updateRow<Participant>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.participantsTableId,
        rowId: member.$id,
        data: { groupId: null },
      }),
    ),
  );

  await tablesDB.deleteRow({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.groupsTableId,
    rowId: groupId,
  });
}

export async function detachParticipantFromGroup(participantId: string): Promise<void> {
  const { tablesDB } = createServerClient();

  const participant = await tablesDB.getRow<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    rowId: participantId,
  });

  if (!participant.groupId) {
    return;
  }

  const groupId = participant.groupId;
  const members = await getGroupMembers(groupId);
  const otherMembers = members.filter((member) => member.$id !== participantId);

  const teamAnswersResponse = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [
      Query.equal("groupId", groupId),
      Query.equal("participantId", participantId),
    ],
  });

  if (teamAnswersResponse.rows.length > 0 && otherMembers.length > 0) {
    const replacementId = otherMembers[0].$id;

    await Promise.all(
      teamAnswersResponse.rows.map((answer) =>
        tablesDB.updateRow<Answer>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.answersTableId,
          rowId: answer.$id,
          data: { participantId: replacementId },
        }),
      ),
    );
  }

  await tablesDB.updateRow<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    rowId: participantId,
    data: { groupId: null },
  });

  if (otherMembers.length === 1) {
    await dissolveGroup(participant.quizId, groupId);
  }
}

export async function getGroupsWithMembersForQuiz(
  quizId: string,
): Promise<import("@/lib/types").GroupWithMembers[]> {
  const { tablesDB } = createServerClient();

  const [groups, participants, answersResponse] = await Promise.all([
    getGroupsForQuiz(quizId),
    tablesDB.listRows<Participant>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.participantsTableId,
      queries: [Query.equal("quizId", quizId)],
    }),
    tablesDB.listRows<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      queries: [Query.equal("quizId", quizId)],
    }),
  ]);

  const participantsByGroup = new Map<string, Participant[]>();

  for (const participant of participants.rows) {
    if (!participant.groupId) {
      continue;
    }

    const existing = participantsByGroup.get(participant.groupId) ?? [];
    existing.push(participant);
    participantsByGroup.set(participant.groupId, existing);
  }

  return groups.map((group) => {
    const members = participantsByGroup.get(group.$id) ?? [];
    const memberIds = members.map((member) => member.$id);

    return {
      id: group.$id,
      name: group.name,
      memberIds,
      memberNames: members.map((member) => member.displayName),
      totalScore: computeTeamScore(group.$id, memberIds, answersResponse.rows),
      createdAt: group.createdAt,
    };
  });
}

export async function hasActiveGroups(quizId: string): Promise<boolean> {
  const groups = await getGroupsForQuiz(quizId);
  return groups.length > 0;
}

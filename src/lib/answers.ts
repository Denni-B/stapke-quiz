import { ID, Query } from "node-appwrite";

import { appwriteConfig } from "@/lib/appwrite/config";
import { createServerClient } from "@/lib/appwrite/server";
import type {
  Answer,
  Chapter,
  Group,
  LeaderboardEntry,
  LeaderboardMode,
  MultipleChoiceQuestionResult,
  Participant,
  Question,
  QuestionOption,
  Quiz,
  QuizLeaderboard,
  ScaleQuestionResult,
  TeamLeaderboardEntry,
} from "@/lib/types";
import {
  computePreGroupScore,
  computeTeamScore,
  detachParticipantFromGroup,
  getGroupsForQuiz,
} from "@/lib/groups";

export async function getParticipantBySessionToken(
  sessionToken: string,
): Promise<Participant | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    queries: [Query.equal("sessionToken", sessionToken), Query.limit(1)],
  });

  return response.rows[0] ?? null;
}

export async function getAnswerForParticipant(
  questionId: string,
  participantId: string,
): Promise<Answer | null> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [
      Query.equal("questionId", questionId),
      Query.equal("participantId", participantId),
      Query.limit(1),
    ],
  });

  return response.rows[0] ?? null;
}

export async function getVotesForParticipant(
  quizId: string,
  participantId: string,
): Promise<Record<string, number>> {
  const state = await getParticipantAnswerState(quizId, participantId);
  return state.myVotes;
}

export async function getParticipantAnswerState(
  quizId: string,
  participantId: string,
  options?: { participant?: Participant },
): Promise<{
  myVotes: Record<string, number>;
  myPoints: Record<string, number>;
  totalScore: number;
  preGroupScore: number;
  groupId?: string;
  groupName?: string;
  isInGroup: boolean;
}> {
  const { tablesDB } = createServerClient();

  const participant =
    options?.participant ??
    (await tablesDB.getRow<Participant>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.participantsTableId,
      rowId: participantId,
    }));

  const myVotes: Record<string, number> = {};
  const myPoints: Record<string, number> = {};

  if (participant.groupId) {
    const groupId = participant.groupId;

    const [groupMembersResponse, groupAnswersResponse, groupResult] = await Promise.all([
      tablesDB.listRows<Participant>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.participantsTableId,
        queries: [Query.equal("groupId", groupId)],
      }),
      tablesDB.listRows<Answer>({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.answersTableId,
        queries: [
          Query.equal("quizId", quizId),
          Query.equal("groupId", groupId),
        ],
      }),
      tablesDB
        .getRow<Group>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.groupsTableId,
          rowId: groupId,
        })
        .catch(() => null),
    ]);

    const memberIds = groupMembersResponse.rows.map((member) => member.$id);
    const memberAnswerResponses = await Promise.all(
      memberIds.map((memberId) =>
        tablesDB.listRows<Answer>({
          databaseId: appwriteConfig.databaseId,
          tableId: appwriteConfig.answersTableId,
          queries: [
            Query.equal("quizId", quizId),
            Query.equal("participantId", memberId),
          ],
        }),
      ),
    );

    const preGroupAnswers = memberAnswerResponses.flatMap((response) =>
      response.rows.filter((answer) => !answer.groupId),
    );
    const scoringAnswers = [...groupAnswersResponse.rows, ...preGroupAnswers];

    for (const answer of groupAnswersResponse.rows) {
      myVotes[answer.questionId] = answer.value;
      myPoints[answer.questionId] = answer.points ?? 0;
    }

    for (const answer of preGroupAnswers) {
      if (answer.participantId !== participantId) {
        continue;
      }

      myVotes[answer.questionId] = answer.value;
      myPoints[answer.questionId] = answer.points ?? 0;
    }

    return {
      myVotes,
      myPoints,
      totalScore: computeTeamScore(groupId, memberIds, scoringAnswers),
      preGroupScore: computePreGroupScore(participantId, scoringAnswers),
      groupId,
      groupName: groupResult?.name,
      isInGroup: true,
    };
  }

  const response = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [
      Query.equal("quizId", quizId),
      Query.equal("participantId", participantId),
    ],
  });

  let totalScore = 0;

  for (const answer of response.rows) {
    myVotes[answer.questionId] = answer.value;
    const points = answer.points ?? 0;
    myPoints[answer.questionId] = points;
    totalScore += points;
  }

  return {
    myVotes,
    myPoints,
    totalScore,
    preGroupScore: totalScore,
    isInGroup: false,
  };
}

export async function createAnswer(data: {
  quizId: string;
  questionId: string;
  participantId: string;
  value: number;
  points?: number;
  groupId?: string;
}): Promise<Answer> {
  const { tablesDB } = createServerClient();

  return tablesDB.createRow<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    rowId: ID.unique(),
    data: {
      quizId: data.quizId,
      questionId: data.questionId,
      participantId: data.participantId,
      value: data.value,
      points: data.points ?? 0,
      groupId: data.groupId,
    },
  });
}

export async function assertQuizCreator(quizId: string, userId: string): Promise<Quiz> {
  const { tablesDB } = createServerClient();

  const quiz = await tablesDB.getRow<Quiz>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.quizzesTableId,
    rowId: quizId,
  });

  if (quiz.creatorId !== userId) {
    throw new Error("You do not have permission to host this quiz.");
  }

  return quiz;
}

function buildDistribution(
  answers: Answer[],
  scaleMin: number,
  scaleMax: number,
): Record<number, number> {
  const distribution: Record<number, number> = {};

  for (let value = scaleMin; value <= scaleMax; value += 1) {
    distribution[value] = 0;
  }

  for (const answer of answers) {
    if (answer.value >= scaleMin && answer.value <= scaleMax) {
      distribution[answer.value] = (distribution[answer.value] ?? 0) + 1;
    }
  }

  return distribution;
}

export async function getScaleResultsForQuiz(
  quizId: string,
  chapterId?: string,
): Promise<ScaleQuestionResult[]> {
  const { tablesDB } = createServerClient();

  const questionQueries = [
    Query.equal("quizId", quizId),
    Query.equal("type", "scale1to10"),
    Query.orderAsc("order"),
  ];

  const questionsResponse = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: questionQueries,
  });

  let scaleQuestions = questionsResponse.rows;

  if (chapterId) {
    scaleQuestions = scaleQuestions.filter((question) => question.chapterId === chapterId);
  }

  if (scaleQuestions.length === 0) {
    return [];
  }

  const answersResponse = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  const answersByQuestion = new Map<string, Answer[]>();

  for (const answer of answersResponse.rows) {
    const existing = answersByQuestion.get(answer.questionId) ?? [];
    existing.push(answer);
    answersByQuestion.set(answer.questionId, existing);
  }

  return scaleQuestions.map((question) => {
    const scaleMin = question.scaleMin ?? 1;
    const scaleMax = question.scaleMax ?? 10;
    const questionAnswers = answersByQuestion.get(question.$id) ?? [];
    const responseCount = questionAnswers.length;
    const total = questionAnswers.reduce((sum, answer) => sum + answer.value, 0);
    const average =
      responseCount > 0 ? Math.round((total / responseCount) * 100) / 100 : null;

    return {
      questionId: question.$id,
      text: question.text,
      imageFileId: question.imageFileId,
      scaleMin,
      scaleMax,
      chapterId: question.chapterId,
      responseCount,
      average,
      distribution: buildDistribution(questionAnswers, scaleMin, scaleMax),
    };
  });
}

export async function getParticipantsForQuiz(quizId: string): Promise<Participant[]> {
  const { tablesDB } = createServerClient();

  const response = await tablesDB.listRows<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    queries: [Query.equal("quizId", quizId)],
  });

  return response.rows;
}

function assignRanks<T extends { totalScore: number; rank: number }>(entries: T[]): T[] {
  entries.sort((a, b) => b.totalScore - a.totalScore);

  let rank = 0;
  let lastScore = -1;

  for (let index = 0; index < entries.length; index += 1) {
    if (entries[index].totalScore !== lastScore) {
      rank = index + 1;
      lastScore = entries[index].totalScore;
    }

    entries[index].rank = rank;
  }

  return entries;
}

export async function getLeaderboardForQuiz(
  quizId: string,
  mode: LeaderboardMode | "auto" = "auto",
): Promise<QuizLeaderboard> {
  const { tablesDB } = createServerClient();

  const [participants, answersResponse, groups] = await Promise.all([
    getParticipantsForQuiz(quizId),
    tablesDB.listRows<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      queries: [Query.equal("quizId", quizId)],
    }),
    getGroupsForQuiz(quizId),
  ]);

  const answers = answersResponse.rows;
  const activeGroups = groups.length > 0;
  const resolvedMode: LeaderboardMode =
    mode === "auto" ? (activeGroups ? "mixed" : "individual") : mode;

  const scoreByParticipant = new Map<string, number>();

  for (const participant of participants) {
    scoreByParticipant.set(participant.$id, 0);
  }

  for (const answer of answers) {
    if (answer.groupId) {
      continue;
    }

    const current = scoreByParticipant.get(answer.participantId) ?? 0;
    scoreByParticipant.set(answer.participantId, current + (answer.points ?? 0));
  }

  const teams: TeamLeaderboardEntry[] = groups.map((group) => {
    const members = participants.filter((participant) => participant.groupId === group.$id);
    const memberIds = members.map((member) => member.$id);

    return {
      groupId: group.$id,
      name: group.name,
      memberNames: members.map((member) => member.displayName),
      totalScore: computeTeamScore(group.$id, memberIds, answers),
      rank: 0,
    };
  });

  assignRanks(teams);

  const individualEntries = participants
    .filter((participant) => !participant.groupId)
    .map((participant) => ({
      participantId: participant.$id,
      displayName: participant.displayName,
      totalScore: scoreByParticipant.get(participant.$id) ?? 0,
      rank: 0,
    }));

  assignRanks(individualEntries);

  if (resolvedMode === "individual") {
    return {
      mode: "individual",
      entries: individualEntries,
      teams: [],
    };
  }

  if (resolvedMode === "teams") {
    return {
      mode: "teams",
      entries: [],
      teams,
    };
  }

  const combinedForDisplay: LeaderboardEntry[] = [
    ...teams.map((team) => ({
      participantId: team.groupId,
      displayName: team.name,
      totalScore: team.totalScore,
      rank: 0,
    })),
    ...individualEntries,
  ];

  return {
    mode: "mixed",
    entries: assignRanks(combinedForDisplay),
    teams,
  };
}

export async function getLeaderboardEntriesForQuiz(
  quizId: string,
): Promise<LeaderboardEntry[]> {
  const leaderboard = await getLeaderboardForQuiz(quizId, "auto");
  return leaderboard.entries;
}

export async function deleteParticipantForHost(
  quizId: string,
  participantId: string,
  userId: string,
): Promise<void> {
  await assertQuizCreator(quizId, userId);

  const { tablesDB } = createServerClient();

  const participant = await tablesDB.getRow<Participant>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    rowId: participantId,
  });

  if (participant.quizId !== quizId) {
    throw new Error("Participant not found.");
  }

  await detachParticipantFromGroup(participantId);

  const answersResponse = await tablesDB.listRows<Answer>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.answersTableId,
    queries: [
      Query.equal("quizId", quizId),
      Query.equal("participantId", participantId),
    ],
  });

  await Promise.all(
    answersResponse.rows.map((answer) =>
      tablesDB.deleteRow({
        databaseId: appwriteConfig.databaseId,
        tableId: appwriteConfig.answersTableId,
        rowId: answer.$id,
      }),
    ),
  );

  await tablesDB.deleteRow({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.participantsTableId,
    rowId: participantId,
  });
}

export async function getMultipleChoiceResultsForQuiz(
  quizId: string,
  chapterId?: string,
): Promise<MultipleChoiceQuestionResult[]> {
  const { tablesDB } = createServerClient();

  const questionsResponse = await tablesDB.listRows<Question>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.questionsTableId,
    queries: [
      Query.equal("quizId", quizId),
      Query.equal("type", "multipleChoice"),
      Query.orderAsc("order"),
    ],
  });

  let mcQuestions = questionsResponse.rows;

  if (chapterId) {
    mcQuestions = mcQuestions.filter((question) => question.chapterId === chapterId);
  }

  if (mcQuestions.length === 0) {
    return [];
  }

  const [answersResponse, participants] = await Promise.all([
    tablesDB.listRows<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      queries: [Query.equal("quizId", quizId)],
    }),
    getParticipantsForQuiz(quizId),
  ]);

  const participantNames = new Map(
    participants.map((participant) => [participant.$id, participant.displayName]),
  );

  const answersByQuestion = new Map<string, Answer[]>();

  for (const answer of answersResponse.rows) {
    const existing = answersByQuestion.get(answer.questionId) ?? [];
    existing.push(answer);
    answersByQuestion.set(answer.questionId, existing);
  }

  return mcQuestions.map((question) => {
    const options = (JSON.parse(question.options) as QuestionOption[]).map(
      ({ text, imageFileId }) => ({ text, imageFileId }),
    );
    const questionAnswers = answersByQuestion.get(question.$id) ?? [];
    const distribution: Record<number, number> = {};

    for (let index = 0; index < options.length; index += 1) {
      distribution[index] = 0;
    }

    const responses = questionAnswers.map((answer) => {
      if (answer.value >= 0 && answer.value < options.length) {
        distribution[answer.value] = (distribution[answer.value] ?? 0) + 1;
      }

      return {
        participantId: answer.participantId,
        displayName: participantNames.get(answer.participantId) ?? "Unknown",
        optionIndex: answer.value,
        points: answer.points ?? 0,
      };
    });

    return {
      questionId: question.$id,
      text: question.text,
      chapterId: question.chapterId,
      options,
      responseCount: questionAnswers.length,
      distribution,
      responses,
    };
  });
}

export async function assertChapterOpenForQuestion(
  quizId: string,
  chapterId: string | undefined,
): Promise<void> {
  if (!chapterId) {
    throw new Error("This question is not available for voting.");
  }

  const { tablesDB } = createServerClient();

  const chapter = await tablesDB.getRow<Chapter>({
    databaseId: appwriteConfig.databaseId,
    tableId: appwriteConfig.chaptersTableId,
    rowId: chapterId,
  });

  if (chapter.quizId !== quizId) {
    throw new Error("Chapter does not belong to this quiz.");
  }

  if (chapter.isOpen !== 1) {
    throw new Error("This chapter is not open for voting.");
  }
}

export async function getVoterCountForQuiz(quizId: string): Promise<number> {
  const [participants, groups] = await Promise.all([
    getParticipantsForQuiz(quizId),
    getGroupsForQuiz(quizId),
  ]);

  if (groups.length === 0) {
    return participants.length;
  }

  const soloVoters = participants.filter((participant) => !participant.groupId).length;
  return soloVoters + groups.length;
}

export async function getQuestionResponseStatus(
  quizId: string,
  questionId: string,
): Promise<{ responseCount: number; voterCount: number }> {
  const { tablesDB } = createServerClient();

  const [answersResponse, voterCount] = await Promise.all([
    tablesDB.listRows<Answer>({
      databaseId: appwriteConfig.databaseId,
      tableId: appwriteConfig.answersTableId,
      queries: [Query.equal("quizId", quizId), Query.equal("questionId", questionId)],
    }),
    getVoterCountForQuiz(quizId),
  ]);

  return {
    responseCount: answersResponse.rows.length,
    voterCount,
  };
}

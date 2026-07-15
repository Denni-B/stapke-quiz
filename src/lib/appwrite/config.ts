export const appwriteConfig = {
  endpoint:
    process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ??
    "https://fra.cloud.appwrite.io/v1",
  projectId:
    process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "stapkedennis",
  databaseId: process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "",
  quizzesTableId: process.env.NEXT_PUBLIC_APPWRITE_QUIZZES_TABLE_ID ?? "",
  questionsTableId: process.env.NEXT_PUBLIC_APPWRITE_QUESTIONS_TABLE_ID ?? "",
  chaptersTableId:
    process.env.NEXT_PUBLIC_APPWRITE_CHAPTERS_TABLE_ID ?? "chapters",
  participantsTableId:
    process.env.NEXT_PUBLIC_APPWRITE_PARTICIPANTS_TABLE_ID ?? "",
  answersTableId: process.env.NEXT_PUBLIC_APPWRITE_ANSWERS_TABLE_ID ?? "",
  groupsTableId: process.env.NEXT_PUBLIC_APPWRITE_GROUPS_TABLE_ID ?? "groups",
  buzzesTableId: process.env.NEXT_PUBLIC_APPWRITE_BUZZES_TABLE_ID ?? "buzzes",
  blackjackSessionsTableId:
    process.env.NEXT_PUBLIC_APPWRITE_BLACKJACK_SESSIONS_TABLE_ID ?? "blackjack_sessions",
  blackjackSeatsTableId:
    process.env.NEXT_PUBLIC_APPWRITE_BLACKJACK_SEATS_TABLE_ID ?? "blackjack_seats",
  blackjackHandsTableId:
    process.env.NEXT_PUBLIC_APPWRITE_BLACKJACK_HANDS_TABLE_ID ?? "blackjack_hands",
  imagesBucketId:
    process.env.NEXT_PUBLIC_APPWRITE_IMAGES_BUCKET_ID ?? "quiz-images",
  apiKey: process.env.APPWRITE_API_KEY ?? "",
};

export function isStorageConfigured() {
  return Boolean(appwriteConfig.imagesBucketId);
}

export function isAppwriteConfigured() {
  return Boolean(
    appwriteConfig.databaseId &&
      appwriteConfig.quizzesTableId &&
      appwriteConfig.questionsTableId &&
      appwriteConfig.participantsTableId &&
      appwriteConfig.answersTableId &&
      appwriteConfig.imagesBucketId,
  );
}

export function isServerConfigured() {
  return isAppwriteConfigured() && Boolean(appwriteConfig.apiKey);
}

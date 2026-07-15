import type { ChapterType, ParsedQuestion, QuestionType } from "@/lib/types";

type ChapterLike = { id?: string; type?: ChapterType };
type QuestionLike = { type: QuestionType; chapterId?: string };

export function getChapterQuestions(
  questions: ParsedQuestion[],
  chapterId: string,
): ParsedQuestion[] {
  return questions
    .filter((question) => question.chapterId === chapterId)
    .sort((a, b) => a.order - b.order);
}

export function isRankingChapter(
  chapter: ChapterLike | null | undefined,
  chapterQuestions: QuestionLike[] = [],
): boolean {
  if (chapter?.type === "ranking") {
    return true;
  }

  if (chapterQuestions.length === 0) {
    return false;
  }

  return chapterQuestions.every((question) => question.type === "scale1to10");
}

export function isJeopardyChapter(
  chapter: ChapterLike | null | undefined,
  chapterQuestions: QuestionLike[] = [],
): boolean {
  if (chapter?.type === "jeopardy") {
    return true;
  }

  if (chapterQuestions.length === 0) {
    return false;
  }

  return chapterQuestions.every((question) => question.type === "jeopardy");
}

export function isBlackjackChapter(
  chapter: ChapterLike | null | undefined,
): boolean {
  return chapter?.type === "blackjack";
}

export function isRankingQuestion(
  question: QuestionLike,
  chapters: ChapterLike[],
): boolean {
  if (question.type === "scale1to10") {
    return true;
  }

  const chapter = chapters.find((item) => item.id === question.chapterId);
  return chapter?.type === "ranking";
}

export function isJeopardyQuestion(
  question: QuestionLike,
  chapters: ChapterLike[],
): boolean {
  if (question.type === "jeopardy") {
    return true;
  }

  const chapter = chapters.find((item) => item.id === question.chapterId);
  return chapter?.type === "jeopardy";
}

export function getChapterType(
  chapterId: string | undefined,
  chapters: ChapterLike[],
): ChapterType {
  return chapters.find((chapter) => chapter.id === chapterId)?.type ?? "multipleChoice";
}

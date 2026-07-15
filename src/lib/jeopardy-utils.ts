import type { JeopardyQuestionMeta, ParsedQuestion, Question } from "@/lib/types";

export function parseJeopardyMeta(optionsJson: string): JeopardyQuestionMeta {
  try {
    const parsed = JSON.parse(optionsJson) as JeopardyQuestionMeta;
    return {
      category: parsed.category ?? "",
      pointValue: parsed.pointValue ?? 0,
      answer: parsed.answer ?? "",
      isPlayed: parsed.isPlayed ?? false,
    };
  } catch {
    return { category: "", pointValue: 0, answer: "", isPlayed: false };
  }
}

export function serializeJeopardyMeta(meta: JeopardyQuestionMeta): string {
  return JSON.stringify({
    category: meta.category,
    pointValue: meta.pointValue,
    answer: meta.answer,
    isPlayed: meta.isPlayed ?? false,
  });
}

export function parseQuestionWithJeopardy(question: Question): ParsedQuestion {
  if (question.type === "jeopardy") {
    return {
      ...question,
      options: [],
      jeopardyMeta: parseJeopardyMeta(question.options),
    };
  }

  return {
    ...question,
    options: JSON.parse(question.options) as ParsedQuestion["options"],
  };
}

export interface JeopardyBoard {
  categories: string[];
  pointValues: number[];
  cells: Map<string, ParsedQuestion>;
}

export function jeopardyCellKey(category: string, pointValue: number): string {
  return `${category}|${pointValue}`;
}

export function buildJeopardyBoard(questions: ParsedQuestion[]): JeopardyBoard {
  const jeopardyQuestions = questions.filter((question) => question.type === "jeopardy");
  const categories: string[] = [];
  const pointValueSet = new Set<number>();
  const cells = new Map<string, ParsedQuestion>();

  for (const question of jeopardyQuestions) {
    const meta = question.jeopardyMeta;
    if (!meta?.category || !meta.pointValue) {
      continue;
    }

    if (!categories.includes(meta.category)) {
      categories.push(meta.category);
    }

    pointValueSet.add(meta.pointValue);
    cells.set(jeopardyCellKey(meta.category, meta.pointValue), question);
  }

  const pointValues = [...pointValueSet].sort((a, b) => a - b);

  return { categories, pointValues, cells };
}

export const DEFAULT_JEOPARDY_POINT_VALUES = [200, 400, 600, 800, 1000];

export const MC_MAX_POINTS = 1000;
export const MC_TIME_LIMIT_MS = 20_000;
export const MC_MIN_CORRECT_POINTS = 100;

export function calculateMultipleChoicePoints(
  isCorrect: boolean,
  questionStartedAtMs: number | undefined,
  answeredAtMs: number = Date.now(),
): number {
  if (!isCorrect) {
    return 0;
  }

  if (!questionStartedAtMs || questionStartedAtMs <= 0) {
    return MC_MAX_POINTS;
  }

  const elapsed = Math.max(0, answeredAtMs - questionStartedAtMs);
  const ratio = Math.max(0, (MC_TIME_LIMIT_MS - elapsed) / MC_TIME_LIMIT_MS);
  const points = Math.round(MC_MAX_POINTS * ratio);

  return Math.max(MC_MIN_CORRECT_POINTS, points);
}

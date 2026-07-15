export const MC_MAX_POINTS = 1000;
/** Seconds of full points while players receive the question (poll + Render latency). */
export const MC_GRACE_PERIOD_MS = 6_000;
/** Decay window after the grace period before points reach the minimum. */
export const MC_TIME_LIMIT_MS = 30_000;
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
  const decayElapsed = Math.max(0, elapsed - MC_GRACE_PERIOD_MS);
  const ratio = Math.max(0, (MC_TIME_LIMIT_MS - decayElapsed) / MC_TIME_LIMIT_MS);
  const points = Math.round(MC_MAX_POINTS * ratio);

  return Math.max(MC_MIN_CORRECT_POINTS, points);
}

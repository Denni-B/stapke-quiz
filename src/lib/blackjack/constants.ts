// answers.questionId is varchar(36); use the hand row id directly.
export function buildBlackjackAnswerQuestionId(handId: string): string {
  return handId;
}

import { apiUrl } from "@/lib/api-url";
import type { Quiz } from "@/lib/types";

interface PresentQuestionResponse {
  quiz?: Quiz;
  error?: string;
}

export async function presentQuestionForHost(
  quizId: string,
  userId: string,
  questionId: string,
  options?: { preserveTimer?: boolean },
): Promise<Quiz> {
  const response = await fetch(apiUrl(`/api/host/${quizId}/present`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId,
      questionId,
      preserveTimer: options?.preserveTimer ?? false,
    }),
  });

  const data = (await response.json()) as PresentQuestionResponse;

  if (!response.ok || !data.quiz) {
    throw new Error(data.error ?? "Could not present question.");
  }

  return data.quiz;
}

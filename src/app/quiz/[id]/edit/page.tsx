"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { QuizForm } from "@/components/quiz-form";
import { Card, Button } from "@/components/ui";
import { getQuiz, getQuizQuestions, listQuizChapters } from "@/lib/quiz";
import type { QuizFormData } from "@/lib/types";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function EditQuizPage() {
  useRequireAuth();
  const params = useParams<{ id: string }>();
  const quizId = params.id;
  const [initialData, setInitialData] = useState<QuizFormData | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadQuiz() {
      try {
        const quiz = await getQuiz(quizId);

        if (!quiz) {
          setError("Quiz not found.");
          return;
        }

        const [questions, dbChapters] = await Promise.all([
          getQuizQuestions(quizId),
          listQuizChapters(quizId),
        ]);

        setJoinCode(quiz.code);
        setInitialData({
          title: quiz.title,
          description: quiz.description ?? "",
          chapters:
            dbChapters.length > 0
              ? dbChapters.map((chapter) => {
                  const chapterQuestions = questions.filter(
                    (question) => question.chapterId === chapter.$id,
                  );
                  const inferredType =
                    chapter.type ??
                    (chapterQuestions.length > 0 &&
                    chapterQuestions.every((question) => question.type === "jeopardy")
                      ? "jeopardy"
                      : chapterQuestions.length > 0 &&
                          chapterQuestions.every((question) => question.type === "scale1to10")
                        ? "ranking"
                        : "multipleChoice");

                  return {
                    id: chapter.$id,
                    title: chapter.title,
                    order: chapter.order,
                    type: inferredType,
                  };
                })
              : [{ id: crypto.randomUUID(), title: "Chapter 1", order: 0, type: "multipleChoice" }],
          questions: questions.map((question) => ({
            type: question.type ?? "multipleChoice",
            text: question.text,
            imageFileId: question.imageFileId,
            chapterId:
              question.chapterId ??
              (dbChapters.length > 0 ? dbChapters[0].$id : undefined),
            scaleMin: question.scaleMin ?? undefined,
            scaleMax: question.scaleMax ?? undefined,
            options: question.options,
            jeopardyMeta: question.jeopardyMeta,
          })),
        });
      } catch (loadError) {
        const message =
          loadError instanceof Error ? loadError.message : "Could not load quiz.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadQuiz();
  }, [quizId]);

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Back to dashboard
          </Link>
          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold">Edit quiz</h1>
              {joinCode ? (
                <p className="mt-2 text-sm text-muted">
                  Join code:{" "}
                  <span className="font-mono text-base font-semibold text-foreground">
                    {joinCode}
                  </span>
                </p>
              ) : null}
            </div>
            <Link href={`/host/${quizId}`}>
              <Button>Host</Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-muted">Loading quiz...</p>
        ) : error ? (
          <Card className="border-danger/30 bg-red-50">
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : initialData ? (
          <QuizForm mode="edit" quizId={quizId} initialData={initialData} />
        ) : null}
      </main>
    </div>
  );
}

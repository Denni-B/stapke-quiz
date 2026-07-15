"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { Button, Card } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { isAppwriteConfigured } from "@/lib/appwrite/config";
import { deleteQuiz, listCreatorQuizzes } from "@/lib/quiz";
import type { Quiz } from "@/lib/types";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function DashboardPage() {
  useRequireAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(quiz: Quiz) {
    const ok = window.confirm(
      `Delete "${quiz.title}"?\n\nThis will permanently remove the quiz and its questions.`,
    );
    if (!ok) return;

    setError("");
    setDeletingId(quiz.$id);

    try {
      await deleteQuiz(quiz.$id);
      setQuizzes((current) => current.filter((item) => item.$id !== quiz.$id));
    } catch (deleteError) {
      const message =
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete quiz.";
      setError(message);
    } finally {
      setDeletingId(null);
    }
  }

  useEffect(() => {
    async function loadQuizzes() {
      try {
        const user = await getCurrentUser();

        if (!user) {
          window.location.href = "/login";
          return;
        }

        if (!isAppwriteConfigured()) {
          setError(
            "Appwrite is not fully configured. Copy .env.local.example to .env.local and add your database/table IDs.",
          );
          return;
        }

        const rows = await listCreatorQuizzes(user.$id);
        setQuizzes(rows);
      } catch (loadError) {
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Could not load quizzes.";
        setError(message);
      } finally {
        setLoading(false);
      }
    }

    loadQuizzes();
  }, []);

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Your quizzes</h1>
            <p className="mt-1 text-sm text-muted">
              Create a quiz and share the code with friends.
            </p>
          </div>
          <Link href="/quiz/new">
            <Button>New quiz</Button>
          </Link>
        </div>

        {loading ? (
          <p className="mt-8 text-sm text-muted">Loading quizzes...</p>
        ) : error ? (
          <Card className="mt-8 border-danger/30 bg-red-50">
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : quizzes.length === 0 ? (
          <Card className="mt-8 text-center">
            <p className="text-muted">No quizzes yet.</p>
            <Link href="/quiz/new" className="mt-4 inline-block">
              <Button>Create your first quiz</Button>
            </Link>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4">
            {quizzes.map((quiz) => (
              <Card key={quiz.$id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{quiz.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    Code:{" "}
                    <span className="font-mono text-base font-semibold text-foreground">
                      {quiz.code}
                    </span>
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-muted">
                    Status: {quiz.status}
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link href={`/host/${quiz.$id}`}>
                    <Button>Host</Button>
                  </Link>
                  <Link href={`/quiz/${quiz.$id}/edit`}>
                    <Button variant="secondary">Edit quiz</Button>
                  </Link>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(quiz)}
                    disabled={deletingId === quiz.$id}
                  >
                    {deletingId === quiz.$id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

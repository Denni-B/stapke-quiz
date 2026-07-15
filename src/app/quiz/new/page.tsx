"use client";

import Link from "next/link";

import { DashboardHeader } from "@/components/dashboard-header";
import { QuizForm } from "@/components/quiz-form";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function NewQuizPage() {
  useRequireAuth();

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
            ← Back to dashboard
          </Link>
          <h1 className="mt-2 text-3xl font-semibold">Create a quiz</h1>
        </div>
        <QuizForm mode="create" />
      </main>
    </div>
  );
}

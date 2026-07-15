import Link from "next/link";

import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-16">
        <section className="rounded-3xl bg-white p-8 shadow-sm sm:p-12">
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            Stapke Quiz
          </p>
          <h1 className="mt-3 max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Create quizzes. Share a code. Play with friends.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">
            Sign up to build your own quizzes, or join an existing one with a
            short code — no account needed for players.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <Button className="w-full sm:w-auto">I&apos;m making a quiz</Button>
            </Link>
            <Link href="/join">
              <Button variant="secondary" className="w-full sm:w-auto">
                Join a quiz
              </Button>
            </Link>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {[
            {
              title: "Create",
              body: "Build multiple-choice quizzes with as many questions as you need.",
            },
            {
              title: "Share",
              body: "Every quiz gets a unique 6-character code to share with friends.",
            },
            {
              title: "Join",
              body: "Friends enter the code and a display name — that's it.",
            },
          ].map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border bg-white p-5"
            >
              <h2 className="font-semibold">{item.title}</h2>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

"use client";

import { useState } from "react";

import { apiUrl } from "@/lib/api-url";
import type { JeopardyPlayState } from "@/lib/types";

interface JeopardyBuzzButtonProps {
  questionId: string;
  sessionToken: string;
  jeopardy: JeopardyPlayState;
  onBuzzConfirmed: (order: number) => void;
}

export function JeopardyBuzzButton({
  questionId,
  sessionToken,
  jeopardy,
  onBuzzConfirmed,
}: JeopardyBuzzButtonProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleBuzz() {
    if (!jeopardy.canBuzz || submitting) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const response = await fetch(apiUrl("/api/buzz"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, questionId }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        order?: number;
        error?: string;
        teamBuzzedBy?: string;
      };

      if (response.status === 409 && data.order) {
        onBuzzConfirmed(data.order);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error ?? "Buzz mislukt.");
      }

      onBuzzConfirmed(data.order ?? 1);
    } catch (buzzError) {
      const message =
        buzzError instanceof Error ? buzzError.message : "Buzz mislukt.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (jeopardy.teamBuzzedBy) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <p className="text-2xl font-semibold">Je team heeft al ingebuzzed</p>
        <p className="mt-3 text-lg text-white/70">
          {jeopardy.teamBuzzedBy} was het snelst.
        </p>
      </div>
    );
  }

  if (jeopardy.hasBuzzed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
        <p className="text-3xl font-bold text-amber-400">Je hebt ingebuzzed!</p>
        {jeopardy.myBuzzOrder ? (
          <p className="mt-3 text-xl text-white/70">Volgorde: #{jeopardy.myBuzzOrder}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-950 to-black px-6">
      <p className="mb-10 text-sm font-medium uppercase tracking-[0.3em] text-zinc-500">
        Druk om in te buzzen
      </p>

      <button
        type="button"
        disabled={!jeopardy.canBuzz || submitting}
        onClick={() => void handleBuzz()}
        aria-label="Buzz in"
        className="group relative flex flex-col items-center disabled:cursor-not-allowed disabled:opacity-40"
      >
        {/* Base / stand */}
        <div className="relative flex flex-col items-center">
          <div className="h-8 w-52 rounded-b-2xl bg-gradient-to-b from-zinc-700 to-zinc-900 shadow-[0_8px_24px_rgba(0,0,0,0.6)] sm:w-64" />
          <div className="absolute -top-1 h-3 w-44 rounded-full bg-zinc-800 sm:w-56" />

          {/* Dome button */}
          <div
            className={`relative -mt-2 flex h-44 w-44 items-center justify-center rounded-full transition-transform duration-100 sm:h-52 sm:w-52 ${
              submitting ? "scale-[0.92] translate-y-2" : "group-enabled:active:scale-[0.92] group-enabled:active:translate-y-2 group-enabled:hover:scale-[1.02]"
            }`}
          >
            {/* Outer ring */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-b from-red-400 via-red-600 to-red-900 shadow-[0_0_80px_rgba(220,38,38,0.45),0_12px_0_#7f1d1d,0_20px_40px_rgba(0,0,0,0.5)]" />

            {/* Gloss highlight */}
            <div className="absolute inset-2 rounded-full bg-gradient-to-b from-white/30 via-transparent to-transparent" />

            {/* Inner dome depth */}
            <div className="absolute inset-4 rounded-full bg-gradient-to-b from-red-500 via-red-600 to-red-800 shadow-[inset_0_-8px_16px_rgba(0,0,0,0.35),inset_0_4px_8px_rgba(255,255,255,0.15)]" />

            {/* Center label */}
            <span className="relative z-10 select-none text-3xl font-black uppercase tracking-widest text-red-950/80 drop-shadow-[0_1px_0_rgba(255,255,255,0.25)] sm:text-4xl">
              {submitting ? "…" : "Buzz"}
            </span>
          </div>
        </div>
      </button>

      {error ? <p className="mt-8 text-center text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

export function JeopardyWaitingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-white">
      <p className="text-xl text-white/80">{message}</p>
    </div>
  );
}

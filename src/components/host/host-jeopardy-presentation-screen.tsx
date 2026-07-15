"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import { getImagePreviewUrl } from "@/lib/storage";
import type { BuzzEntry, Chapter, ParsedQuestion, Quiz } from "@/lib/types";

interface HostJeopardyPresentationScreenProps {
  quiz: Quiz;
  chapter: Chapter;
  question: ParsedQuestion;
  userId: string;
  quizId: string;
  saving: boolean;
  onBackToBoard: () => void;
  onExit: () => void;
}

export function HostJeopardyPresentationScreen({
  quiz,
  chapter,
  question,
  userId,
  quizId,
  saving,
  onBackToBoard,
  onExit,
}: HostJeopardyPresentationScreenProps) {
  const [buzzes, setBuzzes] = useState<BuzzEntry[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [scoring, setScoring] = useState(false);
  const [scoreError, setScoreError] = useState("");

  const meta = question.jeopardyMeta;
  const pointValue = meta?.pointValue ?? 0;
  const hasImage = Boolean(question.imageFileId);
  const hasText = Boolean(question.text.trim());
  const selectedBuzz = buzzes.find((buzz) => buzz.participantId === selectedParticipantId) ?? null;

  useEffect(() => {
    setShowAnswer(false);
    setSelectedParticipantId(null);
    setScoreError("");
  }, [question.$id]);

  useEffect(() => {
    let cancelled = false;

    async function fetchBuzzes() {
      try {
        const response = await fetch(
          apiUrl(
            `/api/host/${quizId}/buzzes?userId=${encodeURIComponent(userId)}&questionId=${encodeURIComponent(question.$id)}`,
          ),
          { cache: "no-store" },
        );

        const data = (await response.json()) as {
          buzzes?: BuzzEntry[];
          error?: string;
        };

        if (!cancelled && response.ok) {
          setBuzzes(data.buzzes ?? []);
        }
      } catch {
        // Keep last known buzz list while polling.
      }
    }

    fetchBuzzes();
    const interval = window.setInterval(fetchBuzzes, 500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [question.$id, quizId, userId]);

  async function awardScore(correct: boolean) {
    if (!selectedParticipantId || scoring) {
      return;
    }

    setScoring(true);
    setScoreError("");

    try {
      const response = await fetch(apiUrl(`/api/host/${quizId}/jeopardy-score`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          questionId: question.$id,
          participantId: selectedParticipantId,
          correct,
        }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Kon score niet toekennen.");
      }

      const refresh = await fetch(
        apiUrl(
          `/api/host/${quizId}/buzzes?userId=${encodeURIComponent(userId)}&questionId=${encodeURIComponent(question.$id)}`,
        ),
        { cache: "no-store" },
      );
      const refreshData = (await refresh.json()) as { buzzes?: BuzzEntry[] };

      if (refresh.ok) {
        setBuzzes(refreshData.buzzes ?? []);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Kon score niet toekennen.";
      setScoreError(message);
    } finally {
      setScoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-[#060d1f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.12)_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(245,158,11,0.06)_0%,_transparent_50%)]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl sm:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <span className="shrink-0 rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-bold tabular-nums text-amber-300">
            {pointValue}
          </span>
          <span className="shrink-0 truncate rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-medium text-white/70">
            {meta?.category ?? "Categorie"}
          </span>
          <span className="hidden truncate text-xs text-white/30 sm:inline">
            {quiz.title} · {chapter.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="secondary" disabled={saving || scoring} onClick={onBackToBoard}>
            ← Bord
          </Button>
          <Button type="button" variant="secondary" onClick={onExit}>
            Sluiten
          </Button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 overflow-hidden">
        {/* Clue */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {hasText ? (
              <div className="shrink-0 border-b border-white/10 px-4 py-3">
                <p className="line-clamp-3 text-center text-lg font-semibold leading-snug tracking-tight sm:text-2xl lg:text-3xl">
                  {question.text}
                </p>
              </div>
            ) : null}

            {hasImage ? (
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getImagePreviewUrl(question.imageFileId!, 1920, 1080)}
                  alt={question.text || "Clue"}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="min-h-0 flex-1" />
            )}

            <div className="shrink-0 border-t border-white/10 px-4 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-amber-200/70">Antwoord (host)</p>
                <button
                  type="button"
                  onClick={() => setShowAnswer((current) => !current)}
                  className="shrink-0 rounded-md border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium transition hover:bg-white/10"
                >
                  {showAnswer ? "Verberg" : "Toon"}
                </button>
              </div>
              {showAnswer ? (
                <p className="mt-1 line-clamp-2 text-lg font-bold sm:text-xl">{meta?.answer || "—"}</p>
              ) : (
                <p className="mt-0.5 text-xs text-white/30">Verborgen voor spelers</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex w-56 shrink-0 flex-col overflow-hidden border-l border-white/10 bg-white/[0.03] sm:w-72">
          <div className="shrink-0 border-b border-white/10 px-3 py-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Buzzes</h2>
              {buzzes.length > 0 ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] tabular-nums text-white/50">
                  {buzzes.length}
                </span>
              ) : null}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden p-2">
            {buzzes.length === 0 ? (
              <p className="py-4 text-center text-xs text-white/35">Nog niemand ingebuzzed</p>
            ) : (
              <ol
                className="grid h-full gap-1 overflow-hidden"
                style={{ gridTemplateRows: `repeat(${buzzes.length}, minmax(0, 1fr))` }}
              >
                {buzzes.map((buzz) => {
                  const isSelected = selectedParticipantId === buzz.participantId;
                  const hasScore = buzz.scoredPoints !== null && buzz.scoredPoints !== undefined;

                  return (
                    <li key={`${buzz.participantId}-${buzz.buzzedAt}`} className="min-h-0">
                      <button
                        type="button"
                        onClick={() => setSelectedParticipantId(buzz.participantId)}
                        className={`flex h-full w-full items-center gap-2 rounded-lg border px-2 text-left transition ${
                          isSelected
                            ? "border-amber-400/60 bg-amber-500/15"
                            : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                        }`}
                      >
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-[10px] font-black tabular-nums ${
                            buzz.order === 1
                              ? "bg-amber-500/25 text-amber-300"
                              : "bg-white/10 text-white/50"
                          }`}
                        >
                          {buzz.order}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold">{buzz.displayName}</p>
                          {buzz.groupName ? (
                            <p className="truncate text-[10px] text-white/40">{buzz.groupName}</p>
                          ) : null}
                        </div>
                        {hasScore ? (
                          <span
                            className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                              buzz.isCorrect
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {buzz.scoredPoints! > 0 ? "+" : ""}
                            {buzz.scoredPoints}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          <div className="shrink-0 border-t border-white/10 p-2">
            {selectedBuzz ? (
              <div className="space-y-1.5">
                <p className="truncate text-[10px] text-white/40">
                  {selectedBuzz.groupName ?? selectedBuzz.displayName}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={scoring || saving}
                    onClick={() => void awardScore(true)}
                    className="rounded-lg bg-emerald-600 py-2 text-xs font-bold transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Goed +{pointValue}
                  </button>
                  <button
                    type="button"
                    disabled={scoring || saving}
                    onClick={() => void awardScore(false)}
                    className="rounded-lg bg-red-600/90 py-2 text-xs font-bold transition hover:bg-red-500 disabled:opacity-50"
                  >
                    Fout −{pointValue}
                  </button>
                </div>
              </div>
            ) : (
              <p className="py-1 text-center text-[10px] text-white/30">Selecteer buzzer</p>
            )}
            {scoreError ? (
              <p className="mt-1 truncate text-center text-[10px] text-red-400">{scoreError}</p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

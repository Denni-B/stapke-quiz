"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui";
import { buildJeopardyBoard, jeopardyCellKey } from "@/lib/jeopardy-utils";
import type { Chapter, ParsedQuestion, Quiz } from "@/lib/types";

interface HostJeopardyBoardScreenProps {
  quiz: Quiz;
  chapter: Chapter;
  questions: ParsedQuestion[];
  saving: boolean;
  onSelectQuestion: (question: ParsedQuestion) => void;
  onExit: () => void;
}

export function HostJeopardyBoardScreen({
  quiz,
  chapter,
  questions,
  saving,
  onSelectQuestion,
  onExit,
}: HostJeopardyBoardScreenProps) {
  const board = buildJeopardyBoard(questions);

  const stats = useMemo(() => {
    const total = board.cells.size;
    const played = [...board.cells.values()].filter(
      (question) => question.jeopardyMeta?.isPlayed,
    ).length;
    return { total, played, remaining: total - played };
  }, [board.cells]);

  const rowCount = board.pointValues.length;

  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-[#060d1f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(59,130,246,0.15)_0%,_transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(245,158,11,0.08)_0%,_transparent_50%)]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
            Live
          </span>
          <p className="truncate text-sm text-white/50">
            {quiz.title} · {chapter.title}
          </p>
          <span className="hidden shrink-0 text-xs text-white/30 sm:inline">·</span>
          <p className="hidden shrink-0 text-xs tabular-nums text-amber-400/80 sm:block">
            {stats.remaining} over · {stats.played} gespeeld
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onExit}>
          Sluiten
        </Button>
      </header>

      <main className="relative z-10 min-h-0 flex-1 p-2 sm:p-4">
        {board.categories.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-white/60">Geen clues in dit Jeopardy-bord.</p>
          </div>
        ) : (
          <div
            className="h-full gap-1.5 sm:gap-2"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${board.categories.length}, minmax(0, 1fr))`,
              gridTemplateRows: rowCount > 0 ? `auto repeat(${rowCount}, minmax(0, 1fr))` : "auto",
            }}
          >
            {board.categories.map((category) => (
              <div
                key={`cat-${category}`}
                className="flex min-h-0 items-center justify-center rounded-lg border border-blue-500/30 bg-gradient-to-b from-blue-600/90 to-blue-800/90 px-2 py-1 text-center shadow-lg shadow-blue-900/20 sm:rounded-xl sm:px-3 sm:py-2"
              >
                <span className="line-clamp-2 text-[10px] font-bold uppercase leading-tight tracking-wide text-white sm:text-xs">
                  {category}
                </span>
              </div>
            ))}

            {board.pointValues.map((pointValue) =>
              board.categories.map((category) => {
                const cellQuestion = board.cells.get(jeopardyCellKey(category, pointValue));
                const isPlayed = cellQuestion?.jeopardyMeta?.isPlayed;
                const isEmpty = !cellQuestion;

                return (
                  <button
                    key={`${category}-${pointValue}`}
                    type="button"
                    disabled={saving || isEmpty || isPlayed}
                    onClick={() => cellQuestion && onSelectQuestion(cellQuestion)}
                    className={`group relative flex min-h-0 items-center justify-center overflow-hidden rounded-lg border transition-all duration-150 sm:rounded-xl ${
                      isEmpty
                        ? "cursor-not-allowed border-white/5 bg-white/[0.02]"
                        : isPlayed
                          ? "cursor-not-allowed border-white/5 bg-white/[0.03]"
                          : "border-amber-500/20 bg-gradient-to-br from-[#1a2744] to-[#0f1729] hover:border-amber-400/50 hover:shadow-md hover:shadow-amber-500/10 active:scale-[0.98]"
                    }`}
                  >
                    {!isEmpty && !isPlayed ? (
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-400/0 to-amber-400/0 transition group-hover:from-amber-400/5 group-hover:to-amber-500/10" />
                    ) : null}
                    <span
                      className={`relative font-black tabular-nums ${
                        isEmpty
                          ? "text-transparent"
                          : isPlayed
                            ? "text-base text-white/15 line-through sm:text-lg"
                            : "bg-gradient-to-b from-amber-200 to-amber-400 bg-clip-text text-xl text-transparent sm:text-2xl lg:text-3xl"
                      }`}
                    >
                      {isEmpty ? "" : isPlayed ? "—" : pointValue}
                    </span>
                  </button>
                );
              }),
            )}
          </div>
        )}
      </main>
    </div>
  );
}

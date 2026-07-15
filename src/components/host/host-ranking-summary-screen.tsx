import { Button } from "@/components/ui";
import { HostRankingItemImage } from "@/components/host/host-question-image";
import { HostScreenFooter, HostScreenShell } from "@/components/host/host-screen-shell";
import type { Chapter, Quiz, ScaleQuestionResult } from "@/lib/types";

interface HostRankingSummaryScreenProps {
  quiz: Quiz;
  chapter: Chapter;
  results: ScaleQuestionResult[];
  onBackToLastItem: () => void;
  onExit: () => void;
}

function getRankBadgeStyle(rank: number) {
  if (rank === 1) {
    return "bg-yellow-400/20 text-yellow-300 border-yellow-400/40";
  }
  if (rank === 2) {
    return "bg-slate-300/20 text-slate-200 border-slate-300/40";
  }
  if (rank === 3) {
    return "bg-amber-600/20 text-amber-300 border-amber-500/40";
  }
  return "bg-white/10 text-white/60 border-white/20";
}

export function HostRankingSummaryScreen({
  quiz,
  chapter,
  results,
  onBackToLastItem,
  onExit,
}: HostRankingSummaryScreenProps) {
  const sortedResults = [...results].sort((a, b) => {
    const avgA = a.average ?? -1;
    const avgB = b.average ?? -1;
    return avgB - avgA;
  });

  const footer = (
    <HostScreenFooter>
      <Button type="button" variant="secondary" onClick={onBackToLastItem}>
        Terug naar laatste item
      </Button>
    </HostScreenFooter>
  );

  return (
    <HostScreenShell
      breadcrumb={`${quiz.title} · ${chapter.title}`}
      title="Ranking resultaten"
      onExit={onExit}
      footer={footer}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        {sortedResults.length === 0 ? (
          <p className="text-center text-lg text-white/60">
            Geen ranking-items in dit hoofdstuk.
          </p>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {sortedResults.map((result, index) => {
              const rank = index + 1;

              return (
                <div
                  key={result.questionId}
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-lg"
                >
                  <span
                    className={`absolute right-3 top-3 z-10 rounded-full border px-2.5 py-0.5 text-xs font-bold ${getRankBadgeStyle(rank)}`}
                  >
                    #{rank}
                  </span>
                  {result.imageFileId ? (
                    <HostRankingItemImage
                      fileId={result.imageFileId}
                      alt={result.text || `Item ${index + 1}`}
                    />
                  ) : (
                    <div className="flex h-48 items-center justify-center bg-white/5 text-white/40 lg:h-56">
                      Geen afbeelding
                    </div>
                  )}
                  <div className="p-4">
                    {result.text ? (
                      <p className="pr-10 font-medium text-white">{result.text}</p>
                    ) : null}
                    <p
                      className={`text-4xl font-bold text-emerald-400 ${result.text ? "mt-2" : ""}`}
                    >
                      {result.average !== null ? result.average.toFixed(2) : "—"}
                    </p>
                    <p className="mt-1 text-sm text-white/50">
                      {result.responseCount} antwoord
                      {result.responseCount === 1 ? "" : "en"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </HostScreenShell>
  );
}

import { Button } from "@/components/ui";
import { getImagePreviewUrl } from "@/lib/storage";
import type { Chapter, Quiz, ScaleQuestionResult } from "@/lib/types";

interface HostRankingSummaryScreenProps {
  quiz: Quiz;
  chapter: Chapter;
  results: ScaleQuestionResult[];
  onBackToLastItem: () => void;
  onExit: () => void;
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm text-white/60">
            {quiz.title} · {chapter.title}
          </p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Ranking results</h1>
        </div>
        <Button type="button" variant="secondary" onClick={onExit}>
          Exit
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        {sortedResults.length === 0 ? (
          <p className="text-center text-lg text-white/60">No ranking items in this chapter.</p>
        ) : (
          <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {sortedResults.map((result, index) => (
              <div
                key={result.questionId}
                className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
              >
                {result.imageFileId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getImagePreviewUrl(result.imageFileId, 640, 480)}
                    alt={result.text || `Item ${index + 1}`}
                    className="aspect-video w-full object-cover"
                  />
                ) : (
                  <div className="flex aspect-video items-center justify-center bg-white/10 text-white/40">
                    No image
                  </div>
                )}
                <div className="p-4">
                  {result.text ? (
                    <p className="font-medium text-white">{result.text}</p>
                  ) : null}
                  <p className={`text-3xl font-bold text-emerald-400 ${result.text ? "mt-2" : ""}`}>
                    {result.average !== null ? result.average.toFixed(2) : "—"}
                  </p>
                  <p className="mt-1 text-sm text-white/50">
                    {result.responseCount} response{result.responseCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="secondary" onClick={onBackToLastItem}>
            Back to last item
          </Button>
        </div>
      </div>
    </div>
  );
}

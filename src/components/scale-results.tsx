import type { ScaleQuestionResult } from "@/lib/types";

interface ScaleResultsProps {
  results: ScaleQuestionResult[];
  participantCount?: number;
}

export function ScaleResults({ results, participantCount }: ScaleResultsProps) {
  if (results.length === 0) {
    return (
      <p className="text-sm text-muted">No scale questions in this chapter.</p>
    );
  }

  return (
    <div className="space-y-4">
      {results.map((result) => {
        const maxCount = Math.max(...Object.values(result.distribution), 1);

        return (
          <div
            key={result.questionId}
            className="rounded-xl border border-border bg-slate-50 p-4"
          >
            <p className="font-medium">{result.text}</p>
            <div className="mt-2 flex flex-wrap gap-4 text-sm">
              <p>
                <span className="text-muted">Average: </span>
                <span className="font-semibold">
                  {result.average !== null ? result.average.toFixed(1) : "—"}
                </span>
              </p>
              <p>
                <span className="text-muted">Responses: </span>
                <span className="font-semibold">
                  {participantCount !== undefined
                    ? `${result.responseCount} / ${participantCount}`
                    : result.responseCount}
                </span>
              </p>
            </div>

            <div className="mt-4 space-y-1.5">
              {Array.from(
                { length: result.scaleMax - result.scaleMin + 1 },
                (_, offset) => result.scaleMin + offset,
              ).map((value) => {
                const count = result.distribution[value] ?? 0;
                const widthPercent = (count / maxCount) * 100;

                return (
                  <div key={value} className="flex items-center gap-2 text-xs">
                    <span className="w-5 shrink-0 text-right font-medium text-muted">
                      {value}
                    </span>
                    <div className="h-5 flex-1 overflow-hidden rounded bg-white">
                      <div
                        className="flex h-full items-center rounded bg-primary/80 px-2 text-white transition-all duration-300"
                        style={{ width: `${count > 0 ? Math.max(widthPercent, 8) : 0}%` }}
                      >
                        {count > 0 ? (
                          <span className="text-[10px] font-semibold">{count}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

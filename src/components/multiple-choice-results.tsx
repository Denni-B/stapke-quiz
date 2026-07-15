import type { MultipleChoiceQuestionResult } from "@/lib/types";
import { getImagePreviewUrl } from "@/lib/storage";

interface MultipleChoiceResultsProps {
  results: MultipleChoiceQuestionResult[];
  participantCount?: number;
  highlightQuestionId?: string;
  showOptionImages?: boolean;
}

export function MultipleChoiceResults({
  results,
  participantCount,
  highlightQuestionId,
  showOptionImages = false,
}: MultipleChoiceResultsProps) {
  const visibleResults = highlightQuestionId
    ? results.filter((result) => result.questionId === highlightQuestionId)
    : results;

  if (visibleResults.length === 0) {
    return (
      <p className="text-sm text-muted">No multiple-choice questions in this chapter.</p>
    );
  }

  return (
    <div className="space-y-4">
      {visibleResults.map((result) => {
        const maxCount = Math.max(...Object.values(result.distribution), 1);

        return (
          <div
            key={result.questionId}
            className="rounded-xl border border-border bg-slate-50 p-4"
          >
            <p className="font-medium">{result.text}</p>
            <p className="mt-2 text-sm">
              <span className="text-muted">Responses: </span>
              <span className="font-semibold">
                {participantCount !== undefined
                  ? `${result.responseCount} / ${participantCount}`
                  : result.responseCount}
              </span>
            </p>

            <div className="mt-4 space-y-2">
              {result.options.map((option, optionIndex) => {
                const count = result.distribution[optionIndex] ?? 0;
                const widthPercent = (count / maxCount) * 100;

                return (
                  <div key={optionIndex} className="space-y-1">
                    <div className="flex items-center gap-3">
                      {showOptionImages && option.imageFileId ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={getImagePreviewUrl(option.imageFileId, 96, 96)}
                          alt={option.text || `Option ${optionIndex + 1}`}
                          className="h-12 w-12 shrink-0 rounded-lg object-cover"
                        />
                      ) : null}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">
                            {option.text || `Option ${optionIndex + 1}`}
                          </span>
                          <span className="text-muted">{count}</span>
                        </div>
                        <div className="mt-1 h-5 overflow-hidden rounded bg-white">
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
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 border-t border-border pt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">
                Per player
              </p>
              <div className="mt-2 space-y-1">
                {result.responses.length === 0 ? (
                  <p className="text-sm text-muted">No answers yet.</p>
                ) : (
                  [...result.responses]
                    .sort((a, b) => b.points - a.points)
                    .map((response) => (
                    <div
                      key={response.participantId}
                      className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{response.displayName}</span>
                      <div className="text-right">
                        <p className="text-muted">
                          {result.options[response.optionIndex]?.text ||
                            `Option ${response.optionIndex + 1}`}
                        </p>
                        <p className="font-semibold text-primary">
                          {response.points > 0 ? `+${response.points}` : "0"} pts
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

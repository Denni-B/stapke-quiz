import { Button } from "@/components/ui";
import { getKahootColor } from "@/lib/kahoot-colors";
import { getImagePreviewUrl } from "@/lib/storage";
import type { Chapter, ParsedQuestion, Quiz } from "@/lib/types";

interface HostPresentationScreenProps {
  quiz: Quiz;
  chapter: Chapter;
  question: ParsedQuestion;
  questionIndex: number;
  questionCount: number;
  isRankingChapter: boolean;
  saving: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onShowResults: () => void;
  onShowScore: () => void;
  onExit: () => void;
}

export function HostPresentationScreen({
  quiz,
  chapter,
  question,
  questionIndex,
  questionCount,
  isRankingChapter,
  saving,
  onPrevious,
  onNext,
  onShowResults,
  onShowScore,
  onExit,
}: HostPresentationScreenProps) {
  const hasImage = Boolean(question.imageFileId);
  const itemLabel = isRankingChapter ? "Item" : "Question";
  const isLastItem = questionIndex >= questionCount - 1;
  const nextDisabled = saving || (isLastItem && !isRankingChapter);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm text-white/60">
            {quiz.title} · {chapter.title} · {itemLabel} {questionIndex + 1} of {questionCount}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-400">
            Live for players
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onExit}>
          Exit
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-6 py-8">
        {question.text ? (
          <h1
            className={`shrink-0 text-center font-semibold leading-tight ${
              hasImage ? "text-3xl sm:text-4xl md:text-5xl" : "text-4xl sm:text-5xl md:text-6xl"
            }`}
          >
            {question.text}
          </h1>
        ) : null}

        {hasImage ? (
          <div className="mt-6 flex min-h-0 flex-1 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getImagePreviewUrl(question.imageFileId!, 1920, 1080)}
              alt={question.text || "Question"}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        ) : question.type === "scale1to10" ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-2xl text-white/70 sm:text-3xl">
              Players rate from {question.scaleMin ?? 1} to {question.scaleMax ?? 10}
            </p>
          </div>
        ) : null}

        {question.type === "multipleChoice" ? (
          <div
            className={`grid shrink-0 gap-3 sm:grid-cols-2 ${hasImage ? "mt-6" : "mt-8 flex-1 content-center"}`}
          >
            {question.options.map((option, optionIndex) => {
              const color = getKahootColor(optionIndex);

              return (
                <div
                  key={optionIndex}
                  className={`overflow-hidden rounded-xl ${color.bg} text-white shadow-lg`}
                >
                  {option.imageFileId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getImagePreviewUrl(option.imageFileId, 480, 320)}
                      alt={option.text || `Option ${optionIndex + 1}`}
                      className="aspect-video w-full object-cover"
                    />
                  ) : null}
                  {option.text ? (
                    <p className="p-4 text-lg font-semibold sm:text-xl">{option.text}</p>
                  ) : (
                    <p className="p-4 text-lg font-semibold sm:text-xl">
                      Option {optionIndex + 1}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <div className="border-t border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={questionIndex === 0 || saving}
            onClick={onPrevious}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={nextDisabled}
            onClick={onNext}
          >
            {isRankingChapter && isLastItem ? "Show results" : "Next"}
          </Button>
          <Button type="button" variant="secondary" onClick={onShowResults}>
            Show results
          </Button>
          {!isRankingChapter ? (
            <Button type="button" variant="secondary" onClick={onShowScore}>
              Show score
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

import { MultipleChoiceResults } from "@/components/multiple-choice-results";
import { ScaleResults } from "@/components/scale-results";
import { Button } from "@/components/ui";
import { getKahootColor } from "@/lib/kahoot-colors";
import { getImagePreviewUrl } from "@/lib/storage";
import type { Chapter, HostChapterResults, ParsedQuestion, Quiz } from "@/lib/types";

interface HostResultsScreenProps {
  quiz: Quiz;
  chapter: Chapter;
  question: ParsedQuestion;
  questionIndex: number;
  questionCount: number;
  results: HostChapterResults;
  isRankingChapter: boolean;
  onBackToQuestion: () => void;
  onNext: () => void;
  onExit: () => void;
  saving: boolean;
  hasNext: boolean;
}

export function HostResultsScreen({
  quiz,
  chapter,
  question,
  questionIndex,
  questionCount,
  results,
  isRankingChapter,
  onBackToQuestion,
  onNext,
  onExit,
  saving,
  hasNext,
}: HostResultsScreenProps) {
  const hasImage = Boolean(question.imageFileId);
  const isLastItem = questionIndex >= questionCount - 1;
  const nextLabel =
    isRankingChapter && isLastItem ? "Show all results" : "Next question";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div className="min-w-0">
          <p className="text-sm text-white/60">
            {quiz.title} · {chapter.title} · Results · Question {questionIndex + 1} of{" "}
            {questionCount}
          </p>
          {question.text ? (
            <h1 className="mt-1 truncate text-lg font-semibold sm:text-xl">{question.text}</h1>
          ) : null}
        </div>
        <Button type="button" variant="secondary" onClick={onExit}>
          Exit
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              {hasImage ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImagePreviewUrl(question.imageFileId!, 1280, 720)}
                    alt={question.text || "Question"}
                    className="aspect-video w-full object-contain"
                  />
                </div>
              ) : null}

              {question.type === "multipleChoice" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => {
                    const color = getKahootColor(optionIndex);

                    return (
                      <div
                        key={optionIndex}
                        className={`overflow-hidden rounded-xl ${color.bg} ${
                          option.isCorrect ? "ring-4 ring-emerald-400" : ""
                        }`}
                      >
                        {option.imageFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getImagePreviewUrl(option.imageFileId, 480, 320)}
                            alt={option.text || `Option ${optionIndex + 1}`}
                            className="aspect-video w-full object-cover"
                          />
                        ) : null}
                        <p className="p-3 text-sm font-semibold sm:text-base">
                          {option.text || `Option ${optionIndex + 1}`}
                          {option.isCorrect ? (
                            <span className="ml-2 text-xs font-medium text-emerald-200">
                              Correct
                            </span>
                          ) : null}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-lg text-white/70">
                  Players rated from {question.scaleMin ?? 1} to {question.scaleMax ?? 10}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white p-4 text-foreground">
              {question.type === "scale1to10" ? (
                <ScaleResults
                  results={results.scaleResults.filter(
                    (result) => result.questionId === question.$id,
                  )}
                  participantCount={results.participantCount}
                />
              ) : (
                <MultipleChoiceResults
                  results={results.multipleChoiceResults}
                  participantCount={results.participantCount}
                  highlightQuestionId={question.$id}
                  showOptionImages
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10 bg-slate-900/80 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="secondary" onClick={onBackToQuestion}>
            Back to question
          </Button>
          <Button type="button" disabled={!hasNext || saving} onClick={onNext}>
            {nextLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

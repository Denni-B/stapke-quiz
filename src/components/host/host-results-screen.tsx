import { MultipleChoiceResults } from "@/components/multiple-choice-results";
import { ScaleResults } from "@/components/scale-results";
import { Button } from "@/components/ui";
import { HostMcOptionCard } from "@/components/host/host-mc-option-card";
import { HostQuestionImage } from "@/components/host/host-question-image";
import { HostScreenFooter, HostScreenShell } from "@/components/host/host-screen-shell";
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
    isRankingChapter && isLastItem ? "Toon alle resultaten" : "Volgende vraag";

  const footer = (
    <HostScreenFooter>
      <Button type="button" variant="secondary" onClick={onBackToQuestion}>
        Terug naar vraag
      </Button>
      <Button type="button" disabled={!hasNext || saving} onClick={onNext}>
        {nextLabel}
      </Button>
    </HostScreenFooter>
  );

  return (
    <HostScreenShell
      breadcrumb={`${quiz.title} · ${chapter.title} · Resultaten`}
      title={question.text || undefined}
      currentIndex={questionIndex}
      totalCount={questionCount}
      onExit={onExit}
      footer={footer}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-4">
            {hasImage ? (
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <HostQuestionImage
                  fileId={question.imageFileId!}
                  alt={question.text || "Vraag"}
                  width={1280}
                  height={720}
                  fill={false}
                  className="min-h-[200px] lg:min-h-[280px]"
                />
              </div>
            ) : null}

            {question.type === "multipleChoice" ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {question.options.map((option, optionIndex) => (
                  <HostMcOptionCard
                    key={optionIndex}
                    option={option}
                    optionIndex={optionIndex}
                    imageSize="sm"
                    textSize="sm"
                    highlightCorrect
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white p-4 text-foreground shadow-xl">
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
    </HostScreenShell>
  );
}

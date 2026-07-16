"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui";
import { HostMcOptionCard } from "@/components/host/host-mc-option-card";
import { HostQuestionImage } from "@/components/host/host-question-image";
import { HostScreenFooter, HostScreenShell } from "@/components/host/host-screen-shell";
import { apiUrl } from "@/lib/api-url";
import type { Chapter, ParsedQuestion, Quiz } from "@/lib/types";

interface HostPresentationScreenProps {
  quiz: Quiz;
  quizId: string;
  userId: string;
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

function ScaleVisualization({ min, max }: { min: number; max: number }) {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-4 sm:p-6">
      <div className="flex w-full max-w-2xl flex-wrap items-center justify-center gap-2 sm:gap-3">
        {values.map((value) => (
          <div
            key={value}
            className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-lg font-bold shadow-lg sm:h-14 sm:w-14 sm:text-xl"
          >
            {value}
          </div>
        ))}
      </div>
      <div className="mt-6 h-2 w-full max-w-2xl overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-full bg-gradient-to-r from-red-500/60 via-yellow-400/60 to-emerald-500/60" />
      </div>
      <div className="mt-2 flex w-full max-w-2xl justify-between text-xs text-white/40">
        <span>Laag ({min})</span>
        <span>Hoog ({max})</span>
      </div>
    </div>
  );
}

function MultipleChoiceOptions({
  question,
}: {
  question: ParsedQuestion;
}) {
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 sm:gap-3 lg:gap-4">
      {question.options.map((option, optionIndex) => (
        <HostMcOptionCard
          key={optionIndex}
          option={option}
          optionIndex={optionIndex}
          imageSize="sm"
          textSize="md"
        />
      ))}
    </div>
  );
}

function MultipleChoiceLayout({
  question,
  hasImage,
}: {
  question: ParsedQuestion;
  hasImage: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4 lg:p-6">
      {question.text ? (
        <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
          <p className="text-center text-xl font-semibold leading-snug sm:text-2xl md:text-3xl lg:text-4xl">
            {question.text}
          </p>
        </div>
      ) : null}

      {hasImage ? (
        <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] sm:mt-4">
          <HostQuestionImage
            fileId={question.imageFileId!}
            alt={question.text || "Vraag"}
          />
        </div>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <div className="mt-auto shrink-0 border-t border-white/10 pt-3 sm:pt-4">
        <div className="mx-auto w-full max-w-5xl">
          <MultipleChoiceOptions question={question} />
        </div>
      </div>
    </div>
  );
}

export function HostPresentationScreen({
  quiz,
  quizId,
  userId,
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
  const [responseStatus, setResponseStatus] = useState<{
    responseCount: number;
    voterCount: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchResponseStatus() {
      try {
        const response = await fetch(
          apiUrl(
            `/api/host/${quizId}/response-status?userId=${encodeURIComponent(userId)}&questionId=${encodeURIComponent(question.$id)}`,
          ),
          { cache: "no-store" },
        );

        const data = (await response.json()) as {
          responseCount?: number;
          voterCount?: number;
          error?: string;
        };

        if (!cancelled && response.ok) {
          setResponseStatus({
            responseCount: data.responseCount ?? 0,
            voterCount: data.voterCount ?? 0,
          });
        }
      } catch {
        // Keep last known status while polling.
      }
    }

    fetchResponseStatus();
    const interval = window.setInterval(fetchResponseStatus, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [question.$id, quizId, userId]);

  const hasImage = Boolean(question.imageFileId);
  const isLastItem = questionIndex >= questionCount - 1;
  const nextDisabled = saving || (isLastItem && !isRankingChapter);
  const isMultipleChoice = question.type === "multipleChoice";
  const scaleMin = question.scaleMin ?? 1;
  const scaleMax = question.scaleMax ?? 10;

  const footer = (
    <HostScreenFooter>
      <Button
        type="button"
        variant="secondary"
        disabled={questionIndex === 0 || saving}
        onClick={onPrevious}
      >
        Vorige
      </Button>
      <Button type="button" variant="secondary" disabled={nextDisabled} onClick={onNext}>
        {isRankingChapter && isLastItem ? "Toon resultaten" : "Volgende"}
      </Button>
      <Button type="button" variant="secondary" onClick={onShowResults}>
        Toon resultaten
      </Button>
      {!isRankingChapter ? (
        <Button type="button" variant="secondary" onClick={onShowScore}>
          Toon score
        </Button>
      ) : null}
    </HostScreenFooter>
  );

  return (
    <HostScreenShell
      breadcrumb={`${quiz.title} · ${chapter.title}`}
      currentIndex={questionIndex}
      totalCount={questionCount}
      responseStatus={responseStatus ?? undefined}
      onExit={onExit}
      footer={footer}
    >
      {isMultipleChoice ? (
        <MultipleChoiceLayout question={question} hasImage={hasImage} />
      ) : isRankingChapter && hasImage ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          {question.text ? (
            <div className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
              <p className="text-center text-lg font-semibold leading-snug sm:text-2xl lg:text-3xl">
                {question.text}
              </p>
            </div>
          ) : null}
          <div className="mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] sm:mt-4">
            <HostQuestionImage
              fileId={question.imageFileId!}
              alt={question.text || "Item"}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 sm:p-4">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
            {question.text ? (
              <div className="shrink-0 border-b border-white/10 px-4 py-3">
                <p className="text-center text-lg font-semibold leading-snug sm:text-2xl lg:text-3xl">
                  {question.text}
                </p>
              </div>
            ) : null}
            {hasImage ? (
              <HostQuestionImage
                fileId={question.imageFileId!}
                alt={question.text || "Item"}
              />
            ) : (
              <ScaleVisualization min={scaleMin} max={scaleMax} />
            )}
          </div>
        </div>
      )}
    </HostScreenShell>
  );
}

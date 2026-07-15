"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BlackjackPlayerScreen } from "@/components/blackjack/blackjack-player-screen";
import {
  JeopardyBuzzButton,
  JeopardyWaitingScreen,
} from "@/components/jeopardy-buzz-button";
import { apiUrl } from "@/lib/api-url";
import { getKahootColor } from "@/lib/kahoot-colors";
import type {
  BlackjackPlayerState,
  JeopardyPlayState,
  QuestionType,
  QuizStatus,
} from "@/lib/types";
import { GUEST_SESSION_KEY } from "@/lib/types";

interface StoredGuestSession {
  quizId: string;
  displayName: string;
  sessionToken: string;
  quizTitle?: string;
}

interface PlayerActiveQuestion {
  id: string;
  type: QuestionType;
  text?: string;
  scaleMin?: number;
  scaleMax?: number;
  options: { text: string }[];
}

interface PlayQuizState {
  status: QuizStatus;
  activeQuestionId: string | null;
  activeQuestion: PlayerActiveQuestion | null;
  jeopardyChapterOpen: boolean;
  blackjackChapterOpen: boolean;
  jeopardy?: JeopardyPlayState;
  blackjack?: BlackjackPlayerState;
  myVotes: Record<string, number>;
  myPoints: Record<string, number>;
  totalScore: number;
  preGroupScore: number;
  groupId: string | null;
  groupName: string | null;
  isInGroup: boolean;
}

async function fetchPlayState(
  quizId: string,
  sessionToken: string,
): Promise<PlayQuizState | null> {
  const response = await fetch(
    apiUrl(`/api/quiz/${quizId}?sessionToken=${encodeURIComponent(sessionToken)}`),
    { cache: "no-store" },
  );
  const contentType = response.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    throw new Error("Could not load quiz data.");
  }

  const data = (await response.json()) as {
    status?: QuizStatus;
    activeQuestionId?: string | null;
    activeQuestion?: PlayerActiveQuestion | null;
    jeopardyChapterOpen?: boolean;
    blackjackChapterOpen?: boolean;
    jeopardy?: JeopardyPlayState;
    blackjack?: BlackjackPlayerState;
    myVotes?: Record<string, number>;
    myPoints?: Record<string, number>;
    totalScore?: number;
    preGroupScore?: number;
    groupId?: string | null;
    groupName?: string | null;
    isInGroup?: boolean;
    error?: string;
  };

  if (!response.ok || !data.status) {
    throw new Error(data.error ?? "Could not load quiz data.");
  }

  return {
    status: data.status,
    activeQuestionId: data.activeQuestionId ?? null,
    activeQuestion: data.activeQuestion ?? null,
    jeopardyChapterOpen: data.jeopardyChapterOpen ?? false,
    blackjackChapterOpen: data.blackjackChapterOpen ?? false,
    jeopardy: data.jeopardy,
    blackjack: data.blackjack,
    myVotes: data.myVotes ?? {},
    myPoints: data.myPoints ?? {},
    totalScore: data.totalScore ?? 0,
    preGroupScore: data.preGroupScore ?? 0,
    groupId: data.groupId ?? null,
    groupName: data.groupName ?? null,
    isInGroup: data.isInGroup ?? false,
  };
}

async function submitVote(
  sessionToken: string,
  questionId: string,
  value: number,
): Promise<{ value: number; points: number }> {
  const response = await fetch(apiUrl("/api/vote"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionToken, questionId, value }),
  });

  const data = (await response.json()) as {
    ok?: boolean;
    value?: number;
    points?: number;
    error?: string;
  };

  if (response.status === 409 && typeof data.value === "number") {
    return { value: data.value, points: data.points ?? 0 };
  }

  if (!response.ok) {
    throw new Error(data.error ?? "Could not submit vote.");
  }

  return {
    value: typeof data.value === "number" ? data.value : value,
    points: data.points ?? 0,
  };
}

function MultipleChoiceQuestionCard({
  question,
  sessionToken,
  confirmedVote,
  confirmedPoints,
  onVoteConfirmed,
}: {
  question: PlayerActiveQuestion;
  sessionToken: string;
  confirmedVote: number | undefined;
  confirmedPoints: number | undefined;
  onVoteConfirmed: (questionId: string, value: number, points: number) => void;
}) {
  const [submittingIndex, setSubmittingIndex] = useState<number | null>(null);
  const [error, setError] = useState("");
  const isLocked = confirmedVote !== undefined;
  const lockedOption = confirmedVote !== undefined ? question.options[confirmedVote] : null;

  async function handleOptionClick(optionIndex: number) {
    if (isLocked || submittingIndex !== null) {
      return;
    }

    setError("");
    setSubmittingIndex(optionIndex);

    try {
      const result = await submitVote(sessionToken, question.id, optionIndex);
      onVoteConfirmed(question.id, result.value, result.points);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Could not submit vote.";
      setError(message);
    } finally {
      setSubmittingIndex(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center gap-4 p-4">
      {isLocked && lockedOption ? (
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {lockedOption.text || `Option ${(confirmedVote ?? 0) + 1}`}
          </p>
          {confirmedPoints !== undefined ? (
            <p className="mt-2 text-3xl font-bold text-primary">
              {confirmedPoints > 0 ? `+${confirmedPoints}` : "0"}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid flex-1 gap-3 sm:grid-cols-2">
        {question.options.map((option, optionIndex) => {
          const color = getKahootColor(optionIndex);
          const isChosen = confirmedVote === optionIndex;
          const isSubmitting = submittingIndex === optionIndex;

          return (
            <button
              key={optionIndex}
              type="button"
              disabled={isLocked || submittingIndex !== null}
              onClick={() => handleOptionClick(optionIndex)}
              className={`flex min-h-28 flex-col justify-end rounded-xl p-4 text-left text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-36 ${
                isChosen ? `ring-4 ${color.ring}` : ""
              } ${color.bg} ${!isLocked ? color.hover : ""}`}
            >
              <p className="text-lg font-semibold sm:text-xl">
                {option.text || `Option ${optionIndex + 1}`}
              </p>
              {isSubmitting ? <p className="mt-1 text-sm text-white/80">...</p> : null}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function ScaleQuestionCard({
  question,
  sessionToken,
  confirmedVote,
  onVoteConfirmed,
}: {
  question: PlayerActiveQuestion;
  sessionToken: string;
  confirmedVote: number | undefined;
  onVoteConfirmed: (questionId: string, value: number, points?: number) => void;
}) {
  const [submittingValue, setSubmittingValue] = useState<number | null>(null);
  const [error, setError] = useState("");
  const isLocked = confirmedVote !== undefined;
  const scaleMin = question.scaleMin ?? 1;
  const scaleMax = question.scaleMax ?? 10;

  async function handleValueClick(value: number) {
    if (isLocked || submittingValue !== null) {
      return;
    }

    setError("");
    setSubmittingValue(value);

    try {
      const result = await submitVote(sessionToken, question.id, value);
      onVoteConfirmed(question.id, result.value, result.points);
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "Could not submit vote.";
      setError(message);
    } finally {
      setSubmittingValue(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center gap-4 p-4">
      {isLocked ? (
        <p className="text-center text-4xl font-semibold text-foreground">{confirmedVote}</p>
      ) : null}

      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {Array.from({ length: scaleMax - scaleMin + 1 }, (_, offset) => scaleMin + offset).map(
          (value) => {
            const isChosen = confirmedVote === value;
            const isSubmitting = submittingValue === value;

            return (
              <button
                key={value}
                type="button"
                disabled={isLocked || submittingValue !== null}
                onClick={() => handleValueClick(value)}
                className={`flex aspect-square items-center justify-center rounded-xl border text-lg font-semibold transition sm:text-xl ${
                  isChosen
                    ? "border-primary bg-indigo-100 text-primary ring-2 ring-primary"
                    : "border-border bg-white hover:border-primary hover:bg-indigo-50"
                } disabled:cursor-not-allowed disabled:opacity-60`}
              >
                {isSubmitting ? "..." : value}
              </button>
            );
          },
        )}
      </div>

      {error ? <p className="text-center text-sm text-danger">{error}</p> : null}
    </div>
  );
}

function PlayerGroupBanner({
  groupName,
  totalScore,
  preGroupScore,
}: {
  groupName: string;
  totalScore: number;
  preGroupScore: number;
}) {
  return (
    <div className="border-b border-border bg-indigo-50 px-4 py-3 text-center">
      <p className="text-sm font-medium text-primary">Team: {groupName}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">
        {totalScore.toLocaleString()} punten
      </p>
      {preGroupScore > 0 ? (
        <p className="text-xs text-muted">
          Waarvan {preGroupScore.toLocaleString()} punten vóór groepering
        </p>
      ) : null}
    </div>
  );
}

function PlayerWaitingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4">
      <p className="text-center text-lg text-muted">{message}</p>
    </div>
  );
}

export default function PlayPage() {
  const params = useParams<{ quizId: string }>();
  const router = useRouter();
  const [session, setSession] = useState<StoredGuestSession | null>(null);
  const [playState, setPlayState] = useState<PlayQuizState | null>(null);
  const [localVotes, setLocalVotes] = useState<Record<string, number>>({});
  const [localPoints, setLocalPoints] = useState<Record<string, number>>({});

  const handleVoteConfirmed = useCallback(
    (questionId: string, value: number, points: number = 0) => {
      setLocalVotes((current) => ({ ...current, [questionId]: value }));
      setLocalPoints((current) => ({ ...current, [questionId]: points }));
      setPlayState((current) => {
        if (!current) {
          return current;
        }

        const nextMyPoints = { ...current.myPoints, [questionId]: points };
        const nextTotalScore = current.isInGroup
          ? current.totalScore + points
          : Object.values(nextMyPoints).reduce((sum, entry) => sum + entry, 0);

        return {
          ...current,
          myVotes: { ...current.myVotes, [questionId]: value },
          myPoints: nextMyPoints,
          totalScore: nextTotalScore,
        };
      });
    },
    [],
  );

  const handleBuzzConfirmed = useCallback((questionId: string, order: number) => {
    setPlayState((current) => {
      if (!current) {
        return current;
      }

      return {
        ...current,
        jeopardy: {
          canBuzz: false,
          hasBuzzed: true,
          myBuzzOrder: order,
        },
      };
    });
  }, []);

  const myVotes = useMemo(() => {
    return { ...(playState?.myVotes ?? {}), ...localVotes };
  }, [playState?.myVotes, localVotes]);

  const myPoints = useMemo(() => {
    return { ...(playState?.myPoints ?? {}), ...localPoints };
  }, [playState?.myPoints, localPoints]);

  useEffect(() => {
    const raw = sessionStorage.getItem(GUEST_SESSION_KEY);

    if (!raw) {
      router.replace("/join");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as StoredGuestSession;

      if (parsed.quizId !== params.quizId) {
        router.replace("/join");
        return;
      }

      setSession(parsed);
    } catch {
      router.replace("/join");
    }
  }, [params.quizId, router]);

  useEffect(() => {
    if (!session) {
      return;
    }

    const sessionToken = session.sessionToken;
    let cancelled = false;
    let timeoutId: number | undefined;
    let lastActiveQuestionId: string | null | undefined;

    function getPollDelay(state: PlayQuizState | null): number {
      if (!state || state.status !== "active") {
        return 4000;
      }

      if (
        state.activeQuestion ||
        state.blackjackChapterOpen ||
        state.jeopardyChapterOpen
      ) {
        return 2000;
      }

      return 4000;
    }

    function scheduleNext(state: PlayQuizState | null, delayOverride?: number) {
      if (cancelled) {
        return;
      }

      timeoutId = window.setTimeout(
        poll,
        delayOverride ?? getPollDelay(state),
      );
    }

    async function poll() {
      try {
        const nextState = await fetchPlayState(params.quizId, sessionToken);

        if (!cancelled && nextState) {
          const questionChanged =
            lastActiveQuestionId !== undefined &&
            lastActiveQuestionId !== nextState.activeQuestionId;
          lastActiveQuestionId = nextState.activeQuestionId;
          setPlayState(nextState);

          if (questionChanged) {
            scheduleNext(nextState, 150);
            return;
          }

          scheduleNext(nextState);
          return;
        }
      } catch {
        // Keep polling silently while waiting for the host.
      }

      if (!cancelled) {
        scheduleNext(null);
      }
    }

    poll();

    return () => {
      cancelled = true;

      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [params.quizId, session]);

  if (!session || !playState) {
    return <PlayerWaitingScreen message="Connecting..." />;
  }

  const activeQuestion = playState.activeQuestion;

  if (!activeQuestion) {
    if (playState.blackjackChapterOpen && playState.status === "active") {
      if (playState.blackjack) {
        return (
          <>
            {playState.isInGroup ? (
              <div className="mx-auto max-w-lg p-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Blackjack is individueel. Verlaat je team om mee te doen.
                </div>
              </div>
            ) : (
              <BlackjackPlayerScreen
                sessionToken={session.sessionToken}
                blackjack={playState.blackjack}
                totalScore={playState.totalScore}
              />
            )}
          </>
        );
      }

      return (
        <PlayerWaitingScreen message="Blackjack laden... wacht even of refresh de pagina." />
      );
    }

    if (playState.jeopardyChapterOpen && playState.status === "active") {
      return (
        <>
          {playState.isInGroup && playState.groupName ? (
            <PlayerGroupBanner
              groupName={playState.groupName}
              totalScore={playState.totalScore}
              preGroupScore={playState.preGroupScore}
            />
          ) : null}
          <JeopardyWaitingScreen message="Wacht tot de host een clue kiest..." />
        </>
      );
    }

    const waitingMessage =
      playState.status === "open"
        ? "Waiting for host to start the quiz"
        : playState.status === "active"
          ? "Waiting for the next question"
          : "The quiz has ended";

    return <PlayerWaitingScreen message={waitingMessage} />;
  }

  if (activeQuestion.type === "jeopardy") {
    const jeopardyState = playState.jeopardy ?? {
      canBuzz: true,
      hasBuzzed: false,
    };

    return (
      <>
        {playState.isInGroup && playState.groupName ? (
          <PlayerGroupBanner
            groupName={playState.groupName}
            totalScore={playState.totalScore}
            preGroupScore={playState.preGroupScore}
          />
        ) : null}
        <JeopardyBuzzButton
          key={activeQuestion.id}
          questionId={activeQuestion.id}
          sessionToken={session.sessionToken}
          jeopardy={jeopardyState}
          onBuzzConfirmed={(order) => handleBuzzConfirmed(activeQuestion.id, order)}
        />
      </>
    );
  }

  if (activeQuestion.type === "scale1to10") {
    return (
      <>
        {playState.isInGroup && playState.groupName ? (
          <PlayerGroupBanner
            groupName={playState.groupName}
            totalScore={playState.totalScore}
            preGroupScore={playState.preGroupScore}
          />
        ) : null}
        <ScaleQuestionCard
          key={activeQuestion.id}
          question={activeQuestion}
          sessionToken={session.sessionToken}
          confirmedVote={myVotes[activeQuestion.id]}
          onVoteConfirmed={handleVoteConfirmed}
        />
      </>
    );
  }

  return (
    <>
      {playState.isInGroup && playState.groupName ? (
        <PlayerGroupBanner
          groupName={playState.groupName}
          totalScore={playState.totalScore}
          preGroupScore={playState.preGroupScore}
        />
      ) : null}
      <MultipleChoiceQuestionCard
        key={activeQuestion.id}
        question={activeQuestion}
        sessionToken={session.sessionToken}
        confirmedVote={myVotes[activeQuestion.id]}
        confirmedPoints={myPoints[activeQuestion.id]}
        onVoteConfirmed={handleVoteConfirmed}
      />
    </>
  );
}

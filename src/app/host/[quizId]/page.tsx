"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { DashboardHeader } from "@/components/dashboard-header";
import { HostBlackjackScreen } from "@/components/host/host-blackjack-screen";
import { HostGroupsPanel } from "@/components/host/host-groups-panel";
import { HostJeopardyBoardScreen } from "@/components/host/host-jeopardy-board-screen";
import { HostJeopardyPresentationScreen } from "@/components/host/host-jeopardy-presentation-screen";
import { HostLeaderboardScreen } from "@/components/host/host-leaderboard-screen";
import { HostPresentationScreen } from "@/components/host/host-presentation-screen";
import { HostRankingSummaryScreen } from "@/components/host/host-ranking-summary-screen";
import { HostResultsScreen } from "@/components/host/host-results-screen";
import { Button, Card } from "@/components/ui";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiUrl } from "@/lib/api-url";
import { getCurrentUser } from "@/lib/auth";
import { presentQuestionForHost } from "@/lib/host-present";
import {
  endQuizForHost,
  getQuizHostData,
  getQuizQuestions,
  markJeopardyQuestionPlayedForHost,
  openQuizForHost,
  setActiveQuestionForHost,
  setChapterOpenForHost,
  startChapterForHost,
  startQuizForHost,
} from "@/lib/quiz";
import { getChapterQuestions, isBlackjackChapter, isJeopardyChapter, isRankingChapter } from "@/lib/chapter-utils";
import type {
  Chapter,
  HostChapterResults,
  LeaderboardEntry,
  GroupWithMembers,
  LeaderboardMode,
  TeamLeaderboardEntry,
  ParsedQuestion,
  Quiz,
  QuizStatus,
} from "@/lib/types";

type HostScreen =
  | "controls"
  | "present"
  | "results"
  | "leaderboard"
  | "rankingSummary"
  | "jeopardyBoard"
  | "jeopardyPresent"
  | "blackjack";

function getStatusDescription(status: QuizStatus | undefined) {
  switch (status) {
    case "draft":
      return "The quiz is in setup. Open it when you want players to join.";
    case "open":
      return "Players can join with your code. Start the quiz when everyone is ready.";
    case "active":
      return "Share your screen and present questions to players.";
    case "closed":
      return "This quiz has ended. Open it again to run another session.";
    default:
      return "";
  }
}

export default function HostQuizPage() {
  useRequireAuth();

  const params = useParams<{ quizId: string }>();
  const quizId = params.quizId;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [questions, setQuestions] = useState<ParsedQuestion[]>([]);
  const [resultsByChapter, setResultsByChapter] = useState<Record<string, HostChapterResults>>(
    {},
  );
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<
    "open" | "start" | "end" | "reset" | null
  >(null);
  const [presentingChapterId, setPresentingChapterId] = useState<string | null>(null);
  const [presentingQuestionIndex, setPresentingQuestionIndex] = useState(0);
  const [hostScreen, setHostScreen] = useState<HostScreen>("controls");
  const [players, setPlayers] = useState<
    { id: string; displayName: string; joinedAt: string; groupId?: string | null }[]
  >([]);
  const [groups, setGroups] = useState<GroupWithMembers[]>([]);
  const [deletingPlayerId, setDeletingPlayerId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardTeams, setLeaderboardTeams] = useState<TeamLeaderboardEntry[]>([]);
  const [leaderboardMode, setLeaderboardMode] = useState<LeaderboardMode>("individual");

  async function load() {
    setError("");
    setLoading(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      setUserId(user.$id);

      const data = await getQuizHostData(quizId, user.$id);
      const quizQuestions = await getQuizQuestions(quizId);
      setQuiz(data.quiz);
      setChapters(data.chapters);
      setQuestions(quizQuestions);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Could not load host data.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLeaderboard() {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(
        apiUrl(`/api/host/${quizId}/leaderboard?userId=${encodeURIComponent(userId)}`),
        { cache: "no-store" },
      );

      const data = (await response.json()) as {
        mode?: LeaderboardMode;
        entries?: LeaderboardEntry[];
        teams?: TeamLeaderboardEntry[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load score.");
      }

      setLeaderboard(data.entries ?? []);
      setLeaderboardTeams(data.teams ?? []);
      setLeaderboardMode(data.mode ?? "individual");
    } catch {
      // Keep showing the last known score while polling.
    }
  }

  async function showScore() {
    setHostScreen("leaderboard");
    await fetchLeaderboard();
  }

  async function showRankingSummary() {
    if (!presentingChapterId) {
      return;
    }

    setHostScreen("rankingSummary");
    await fetchChapterResults(presentingChapterId);

    try {
      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      const updated = await setActiveQuestionForHost(quizId, user.$id, null);
      setQuiz(updated);
    } catch {
      // Summary can still be shown without clearing the active question.
    }
  }

  async function fetchPlayers() {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(
        apiUrl(`/api/host/${quizId}/participants?userId=${encodeURIComponent(userId)}`),
        { cache: "no-store" },
      );

      const data = (await response.json()) as {
        participants?: {
          id: string;
          displayName: string;
          joinedAt: string;
          groupId?: string | null;
        }[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load players.");
      }

      setPlayers(data.participants ?? []);
    } catch {
      // Keep showing the last known player list while polling.
    }
  }

  async function fetchGroups() {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(
        apiUrl(`/api/host/${quizId}/groups?userId=${encodeURIComponent(userId)}`),
        { cache: "no-store" },
      );

      const data = (await response.json()) as {
        groups?: GroupWithMembers[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load groups.");
      }

      setGroups(data.groups ?? []);
    } catch {
      // Keep showing the last known groups while polling.
    }
  }

  async function refreshPlayersAndGroups() {
    await Promise.all([fetchPlayers(), fetchGroups()]);
  }

  async function deletePlayer(playerId: string) {
    if (!userId) {
      return;
    }

    const player = players.find((entry) => entry.id === playerId);

    if (!player) {
      return;
    }

    const confirmed = window.confirm(`Remove ${player.displayName} from this quiz?`);
    if (!confirmed) {
      return;
    }

    setError("");
    setDeletingPlayerId(playerId);

    try {
      const response = await fetch(
        apiUrl(
          `/api/host/${quizId}/participants/${encodeURIComponent(playerId)}?userId=${encodeURIComponent(userId)}`,
        ),
        { method: "DELETE" },
      );

      const data = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not remove player.");
      }

      setPlayers((current) => current.filter((entry) => entry.id !== playerId));
      await refreshPlayersAndGroups();

      if (presentingChapterId) {
        await fetchChapterResults(presentingChapterId);
      }
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Could not remove player.";
      setError(message);
    } finally {
      setDeletingPlayerId(null);
    }
  }

  async function fetchChapterResults(chapterId: string) {
    if (!userId) {
      return;
    }

    try {
      const response = await fetch(
        apiUrl(
          `/api/host/${quizId}/results?userId=${encodeURIComponent(userId)}&chapterId=${encodeURIComponent(chapterId)}`,
        ),
        { cache: "no-store" },
      );

      const data = (await response.json()) as HostChapterResults & {
        results?: HostChapterResults["scaleResults"];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load results.");
      }

      setResultsByChapter((current) => ({
        ...current,
        [chapterId]: {
          scaleResults: data.scaleResults ?? data.results ?? [],
          multipleChoiceResults: data.multipleChoiceResults ?? [],
          participantCount: data.participantCount ?? 0,
        },
      }));
    } catch {
      // Keep showing the last known results while polling.
    }
  }

  async function resetQuiz() {
    if (!userId) {
      return;
    }

    const confirmed = window.confirm(
      "Weet je zeker dat je de hele quiz wilt resetten?\n\n" +
        "• Alle spelers worden verwijderd\n" +
        "• Alle scores worden gewist\n" +
        "• Alle Jeopardy-vragen worden opnieuw geactiveerd\n" +
        "• Blackjack wordt opnieuw opgestart\n\n" +
        "Spelers moeten opnieuw deelnemen met de quizcode.",
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setPendingAction("reset");

    try {
      const response = await fetch(apiUrl(`/api/host/${quizId}/reset`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        quiz?: Quiz;
        chapters?: Chapter[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not reset quiz.");
      }

      if (data.quiz) {
        setQuiz(data.quiz);
      }

      if (data.chapters) {
        setChapters(data.chapters);
      }

      const quizQuestions = await getQuizQuestions(quizId);
      setQuestions(quizQuestions);
      setPlayers([]);
      setGroups([]);
      setResultsByChapter({});
      setLeaderboard([]);
      setLeaderboardTeams([]);
      setPresentingChapterId(null);
      setPresentingQuestionIndex(0);
      setHostScreen("controls");
    } catch (resetError) {
      const message =
        resetError instanceof Error ? resetError.message : "Could not reset quiz.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function runQuizAction(action: "open" | "start" | "end") {
    setError("");
    setPendingAction(action);

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      let updated: Quiz;

      if (action === "open") {
        updated = await openQuizForHost(quizId, user.$id);
        setChapters((current) => current.map((chapter) => ({ ...chapter, isOpen: 0 })));
        setResultsByChapter({});
        setPresentingChapterId(null);
        setPresentingQuestionIndex(0);
        setHostScreen("controls");
      } else if (action === "start") {
        updated = await startQuizForHost(quizId, user.$id);
      } else {
        updated = await endQuizForHost(quizId, user.$id);
        setChapters((current) => current.map((chapter) => ({ ...chapter, isOpen: 0 })));
        setResultsByChapter({});
        setPresentingChapterId(null);
        setPresentingQuestionIndex(0);
        setHostScreen("controls");
      }

      setQuiz(updated);
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Could not update quiz.";
      setError(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function startChapter(chapter: Chapter) {
    const chapterQuestionCount = questions.filter(
      (question) => question.chapterId === chapter.$id,
    ).length;
    const chapterIsBlackjack = isBlackjackChapter(chapter);

    if (chapterQuestionCount === 0 && !chapterIsBlackjack) {
      return;
    }

    setError("");
    setSavingId(chapter.$id);

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      const updated = await startChapterForHost(quizId, user.$id, chapter.$id);

      setChapters((current) =>
        current.map((item) => ({
          ...item,
          isOpen: item.$id === chapter.$id ? 1 : 0,
        })),
      );
      setQuiz(updated);
      setPresentingChapterId(chapter.$id);
      setPresentingQuestionIndex(0);

      const chapterQuestions = getChapterQuestions(questions, chapter.$id);
      if (isBlackjackChapter(chapter)) {
        setHostScreen("blackjack");
      } else if (isJeopardyChapter(chapter, chapterQuestions)) {
        setHostScreen("jeopardyBoard");
      } else {
        await presentQuestion(chapter.$id, 0, "present");
      }
    } catch (startError) {
      const message =
        startError instanceof Error ? startError.message : "Could not start chapter.";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  function continuePresenting(chapter: Chapter) {
    const chapterQuestions = getChapterQuestions(questions, chapter.$id);

    if (isBlackjackChapter(chapter)) {
      setPresentingChapterId(chapter.$id);
      setHostScreen("blackjack");
      return;
    }

    if (isJeopardyChapter(chapter, chapterQuestions)) {
      setPresentingChapterId(chapter.$id);
      if (quiz?.activeQuestionId) {
        const activeQuestion = chapterQuestions.find(
          (question) => question.$id === quiz.activeQuestionId,
        );
        if (activeQuestion) {
          setPresentingQuestionIndex(
            chapterQuestions.findIndex((question) => question.$id === activeQuestion.$id),
          );
          setHostScreen("jeopardyPresent");
          return;
        }
      }
      setHostScreen("jeopardyBoard");
      return;
    }

    let questionIndex = 0;

    if (quiz?.activeQuestionId) {
      const activeIndex = chapterQuestions.findIndex(
        (question) => question.$id === quiz.activeQuestionId,
      );

      if (activeIndex >= 0) {
        questionIndex = activeIndex;
      }
    } else if (presentingChapterId === chapter.$id) {
      questionIndex = presentingQuestionIndex;
    }

    void presentQuestion(chapter.$id, questionIndex, "present", {
      preserveTimer: quiz?.activeQuestionId === chapterQuestions[questionIndex]?.$id,
    });
  }

  async function presentJeopardyQuestion(question: ParsedQuestion) {
    if (!presentingChapter) {
      return;
    }

    const chapterQuestions = getChapterQuestions(questions, presentingChapter.$id);
    const questionIndex = chapterQuestions.findIndex((item) => item.$id === question.$id);

    setError("");
    setSavingId(question.$id);
    setPresentingQuestionIndex(questionIndex >= 0 ? questionIndex : 0);
    setHostScreen("jeopardyPresent");

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      const updated = await presentQuestionForHost(quizId, user.$id, question.$id);
      setQuiz(updated);
    } catch (presentError) {
      const message =
        presentError instanceof Error ? presentError.message : "Could not present clue.";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  async function backToJeopardyBoard(markPlayed: boolean) {
    if (!presentingChapter || !presentedQuestion) {
      setHostScreen("jeopardyBoard");
      return;
    }

    setError("");
    setSavingId(presentedQuestion.$id);

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      if (markPlayed) {
        const updatedQuestion = await markJeopardyQuestionPlayedForHost(
          quizId,
          user.$id,
          presentedQuestion.$id,
        );
        setQuestions((current) =>
          current.map((question) =>
            question.$id === updatedQuestion.$id ? updatedQuestion : question,
          ),
        );
      }

      const updated = await setActiveQuestionForHost(quizId, user.$id, null);
      setQuiz(updated);
      setHostScreen("jeopardyBoard");
    } catch (backError) {
      const message =
        backError instanceof Error ? backError.message : "Could not return to board.";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  async function toggleChapter(chapter: Chapter, open: boolean) {
    setError("");
    setSavingId(chapter.$id);

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      await setChapterOpenForHost(quizId, user.$id, chapter.$id, open);

      setChapters((current) =>
        current.map((item) =>
          item.$id === chapter.$id ? { ...item, isOpen: open ? 1 : 0 } : item,
        ),
      );

      if (open) {
        setPresentingChapterId(chapter.$id);
        setPresentingQuestionIndex(0);
      } else {
        if (presentingChapterId === chapter.$id) {
          setPresentingChapterId(null);
          setPresentingQuestionIndex(0);
          setHostScreen("controls");
        }

        setResultsByChapter((current) => {
          const next = { ...current };
          delete next[chapter.$id];
          return next;
        });

        if (quiz?.activeQuestionId) {
          const activeQuestion = questions.find(
            (question) => question.$id === quiz.activeQuestionId,
          );

          if (activeQuestion?.chapterId === chapter.$id) {
            const updated = await setActiveQuestionForHost(quizId, user.$id, null);
            setQuiz(updated);
          }
        }
      }
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Could not update chapter.";
      setError(message);
    } finally {
      setSavingId(null);
    }
  }

  async function presentQuestion(
    chapterId: string,
    questionIndex: number,
    screen: HostScreen = "present",
    options?: { preserveTimer?: boolean },
  ) {
    const chapterQuestions = questions
      .filter((question) => question.chapterId === chapterId)
      .sort((a, b) => a.order - b.order);

    const question = chapterQuestions[questionIndex];

    if (!question) {
      return;
    }

    setError("");
    setSavingId(question.$id);
    setPresentingChapterId(chapterId);
    setPresentingQuestionIndex(questionIndex);
    setHostScreen(screen);

    try {
      const user = await getCurrentUser();

      if (!user) {
        throw new Error("You must be logged in to host a quiz.");
      }

      const updated = await presentQuestionForHost(quizId, user.$id, question.$id, {
        preserveTimer: options?.preserveTimer ?? false,
      });
      setQuiz(updated);
    } catch (presentError) {
      const message =
        presentError instanceof Error ? presentError.message : "Could not present question.";
      setError(message);
      setHostScreen("controls");
    } finally {
      setSavingId(null);
    }
  }

  async function showResults() {
    if (!presentingChapterId) {
      return;
    }

    setHostScreen("results");
    await fetchChapterResults(presentingChapterId);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quizId]);

  useEffect(() => {
    if (!userId || !quiz || (quiz.status !== "open" && quiz.status !== "active")) {
      return;
    }

    let cancelled = false;

    async function pollPlayers() {
      if (cancelled) {
        return;
      }

      await refreshPlayersAndGroups();
    }

    pollPlayers();
    const interval = window.setInterval(pollPlayers, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, quiz?.status]);

  useEffect(() => {
    if (!quiz?.activeQuestionId || questions.length === 0) {
      return;
    }

    const activeQuestion = questions.find((question) => question.$id === quiz.activeQuestionId);

    if (!activeQuestion?.chapterId) {
      return;
    }

    const chapterQuestions = questions
      .filter((question) => question.chapterId === activeQuestion.chapterId)
      .sort((a, b) => a.order - b.order);
    const questionIndex = chapterQuestions.findIndex(
      (question) => question.$id === activeQuestion.$id,
    );

    if (questionIndex >= 0) {
      setPresentingChapterId(activeQuestion.chapterId);
      setPresentingQuestionIndex(questionIndex);
    }
  }, [quiz?.activeQuestionId, questions]);

  const openChapterIds = chapters
    .filter((chapter) => chapter.isOpen === 1)
    .map((chapter) => chapter.$id);

  useEffect(() => {
    if (!userId || quiz?.status !== "active" || hostScreen !== "results") {
      return;
    }

    if (!presentingChapterId || !openChapterIds.includes(presentingChapterId)) {
      return;
    }

    const chapterId = presentingChapterId;
    let cancelled = false;

    async function pollResults() {
      if (cancelled) {
        return;
      }

      await fetchChapterResults(chapterId);
    }

    pollResults();
    const interval = window.setInterval(pollResults, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, quiz?.status, hostScreen, presentingChapterId, openChapterIds.join(",")]);

  useEffect(() => {
    if (!userId || quiz?.status !== "active" || hostScreen !== "rankingSummary") {
      return;
    }

    if (!presentingChapterId || !openChapterIds.includes(presentingChapterId)) {
      return;
    }

    const chapterId = presentingChapterId;
    let cancelled = false;

    async function pollResults() {
      if (cancelled) {
        return;
      }

      await fetchChapterResults(chapterId);
    }

    pollResults();
    const interval = window.setInterval(pollResults, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, quiz?.status, hostScreen, presentingChapterId, openChapterIds.join(",")]);

  useEffect(() => {
    if (!userId || quiz?.status !== "active" || hostScreen !== "leaderboard") {
      return;
    }

    let cancelled = false;

    async function pollLeaderboard() {
      if (cancelled) {
        return;
      }

      await fetchLeaderboard();
    }

    pollLeaderboard();
    const interval = window.setInterval(pollLeaderboard, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, quiz?.status, hostScreen]);

  const presentingChapter = useMemo(
    () => chapters.find((chapter) => chapter.$id === presentingChapterId) ?? null,
    [chapters, presentingChapterId],
  );

  const presentingQuestions = useMemo(() => {
    if (!presentingChapter) {
      return [];
    }

    return getChapterQuestions(questions, presentingChapter.$id);
  }, [presentingChapter, questions]);

  const presentingChapterIsRanking = isRankingChapter(
    presentingChapter,
    presentingQuestions,
  );

  const presentingChapterIsJeopardy = isJeopardyChapter(
    presentingChapter,
    presentingQuestions,
  );

  const presentingChapterIsBlackjack = isBlackjackChapter(presentingChapter);

  const presentedQuestion = presentingQuestions[presentingQuestionIndex] ?? null;
  const chapterResults = presentingChapter ? resultsByChapter[presentingChapter.$id] : undefined;

  function handlePresentNext() {
    if (!presentingChapter) {
      return;
    }

    if (
      presentingChapterIsRanking &&
      presentingQuestionIndex >= presentingQuestions.length - 1
    ) {
      void showRankingSummary();
      return;
    }

    void presentQuestion(presentingChapter.$id, presentingQuestionIndex + 1);
  }

  function handleResultsNext() {
    if (!presentingChapter) {
      return;
    }

    if (
      presentingChapterIsRanking &&
      presentingQuestionIndex >= presentingQuestions.length - 1
    ) {
      void showRankingSummary();
      return;
    }

    void presentQuestion(presentingChapter.$id, presentingQuestionIndex + 1);
  }

  const quizStarted = quiz?.status === "active";
  const quizEnded = quiz?.status === "closed";
  const isQuestionLive =
    Boolean(presentedQuestion && quiz?.activeQuestionId === presentedQuestion.$id);

  const liveChapterInfo = useMemo(() => {
    if (!quiz?.activeQuestionId) {
      return null;
    }

    const activeQuestion = questions.find((question) => question.$id === quiz.activeQuestionId);

    if (!activeQuestion?.chapterId) {
      return null;
    }

    const chapter = chapters.find((item) => item.$id === activeQuestion.chapterId);

    if (!chapter) {
      return null;
    }

    const chapterQuestions = questions
      .filter((question) => question.chapterId === chapter.$id)
      .sort((a, b) => a.order - b.order);
    const questionIndex = chapterQuestions.findIndex(
      (question) => question.$id === activeQuestion.$id,
    );

    return {
      chapter,
      questionIndex: questionIndex >= 0 ? questionIndex : 0,
      questionCount: chapterQuestions.length,
    };
  }, [quiz?.activeQuestionId, questions, chapters]);

  return (
    <>
      {hostScreen === "blackjack" && quiz && presentingChapter ? (
        <HostBlackjackScreen
          quizId={quizId}
          userId={userId}
          quiz={quiz}
          chapter={presentingChapter}
          onExit={() => setHostScreen("controls")}
        />
      ) : null}

      {hostScreen === "jeopardyBoard" && quiz && presentingChapter ? (
        <HostJeopardyBoardScreen
          quiz={quiz}
          chapter={presentingChapter}
          questions={presentingQuestions}
          saving={savingId !== null}
          onSelectQuestion={(question) => void presentJeopardyQuestion(question)}
          onExit={() => setHostScreen("controls")}
        />
      ) : null}

      {hostScreen === "jeopardyPresent" &&
      quiz &&
      presentingChapter &&
      presentedQuestion ? (
        <HostJeopardyPresentationScreen
          quiz={quiz}
          chapter={presentingChapter}
          question={presentedQuestion}
          userId={userId}
          quizId={quizId}
          saving={savingId !== null}
          onBackToBoard={() => void backToJeopardyBoard(true)}
          onExit={() => setHostScreen("controls")}
        />
      ) : null}

      {hostScreen === "present" && quiz && presentingChapter && presentedQuestion ? (
        <HostPresentationScreen
          quiz={quiz}
          chapter={presentingChapter}
          question={presentedQuestion}
          questionIndex={presentingQuestionIndex}
          questionCount={presentingQuestions.length}
          isRankingChapter={presentingChapterIsRanking}
          saving={savingId !== null}
          onPrevious={() =>
            presentQuestion(presentingChapter.$id, presentingQuestionIndex - 1)
          }
          onNext={handlePresentNext}
          onShowResults={showResults}
          onShowScore={showScore}
          onExit={() => setHostScreen("controls")}
        />
      ) : null}

      {hostScreen === "rankingSummary" && quiz && presentingChapter ? (
        <HostRankingSummaryScreen
          quiz={quiz}
          chapter={presentingChapter}
          results={chapterResults?.scaleResults ?? []}
          onBackToLastItem={() => {
            if (presentingQuestions.length === 0) {
              setHostScreen("controls");
              return;
            }

            void presentQuestion(
              presentingChapter.$id,
              presentingQuestions.length - 1,
              "present",
            );
          }}
          onExit={() => setHostScreen("controls")}
        />
      ) : null}

      {hostScreen === "leaderboard" && quiz ? (
        <HostLeaderboardScreen
          quiz={quiz}
          leaderboard={leaderboard}
          teams={leaderboardTeams}
          mode={leaderboardMode}
          question={presentedQuestion}
          onExit={() => setHostScreen("controls")}
        />
      ) : null}

      {hostScreen === "results" && quiz && presentingChapter && presentedQuestion ? (
        <HostResultsScreen
          quiz={quiz}
          chapter={presentingChapter}
          question={presentedQuestion}
          questionIndex={presentingQuestionIndex}
          questionCount={presentingQuestions.length}
          results={
            chapterResults ?? {
              scaleResults: [],
              multipleChoiceResults: [],
              participantCount: 0,
            }
          }
          isRankingChapter={presentingChapterIsRanking}
          onBackToQuestion={() => setHostScreen("present")}
          onNext={handleResultsNext}
          onExit={() => setHostScreen("controls")}
          saving={savingId !== null}
          hasNext={
            presentingQuestionIndex < presentingQuestions.length - 1 ||
            presentingChapterIsRanking
          }
        />
      ) : null}

      <div className={hostScreen !== "controls" ? "hidden" : undefined}>
        <DashboardHeader />
        <main className="mx-auto max-w-4xl px-4 py-8">
          <div className="mb-6">
            <Link href="/dashboard" className="text-sm text-muted hover:text-foreground">
              ← Back to dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-semibold">Host controls</h1>
            {quiz ? (
              <p className="mt-1 text-sm text-muted">
                {quiz.title} · Code{" "}
                <span className="font-mono font-semibold text-foreground">{quiz.code}</span>
              </p>
            ) : null}
          </div>

          {loading ? (
            <p className="text-sm text-muted">Loading host controls...</p>
          ) : error ? (
            <Card className="border-danger/30 bg-red-50">
              <p className="text-sm text-danger">{error}</p>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted">
                    Quiz status
                  </p>
                  <h2 className="mt-1 text-lg font-semibold capitalize">
                    {quiz?.status ?? "unknown"}
                  </h2>
                  <p className="mt-1 text-sm text-muted">{getStatusDescription(quiz?.status)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {quiz?.status === "draft" || quiz?.status === "closed" ? (
                    <Button
                      type="button"
                      disabled={pendingAction === "open"}
                      onClick={() => runQuizAction("open")}
                    >
                      {pendingAction === "open" ? "Opening..." : "Open quiz"}
                    </Button>
                  ) : null}
                  {quiz?.status === "open" ? (
                    <Button
                      type="button"
                      disabled={pendingAction === "start"}
                      onClick={() => runQuizAction("start")}
                    >
                      {pendingAction === "start" ? "Starting..." : "Start quiz"}
                    </Button>
                  ) : null}
                  {quiz?.status === "active" ? (
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pendingAction === "end"}
                      onClick={() => runQuizAction("end")}
                    >
                      {pendingAction === "end" ? "Ending..." : "End quiz"}
                    </Button>
                  ) : null}
                  {quiz?.status === "open" || quiz?.status === "active" ? (
                    <Button
                      type="button"
                      variant="danger"
                      disabled={pendingAction === "reset"}
                      onClick={() => resetQuiz()}
                    >
                      {pendingAction === "reset" ? "Resetten..." : "Reset quiz"}
                    </Button>
                  ) : null}
                </div>
              </Card>

              {quiz?.status === "open" || quiz?.status === "active" ? (
                <Card className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      Players
                    </p>
                    <h2 className="mt-1 text-lg font-semibold">
                      {players.length === 1 ? "1 player" : `${players.length} players`}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      Maak groepen van aangemelde spelers. Team-punten worden samengesteld en
                      eerlijk verdeeld bij het splitsen.
                    </p>
                  </div>
                  <HostGroupsPanel
                    quizId={quizId}
                    userId={userId}
                    players={players}
                    groups={groups}
                    deletingId={deletingPlayerId}
                    onDeletePlayer={deletePlayer}
                    onGroupsChange={refreshPlayersAndGroups}
                    onError={setError}
                  />
                </Card>
              ) : null}

              {quizStarted ? (
                <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      Live quiz
                    </p>
                    {liveChapterInfo ? (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {liveChapterInfo.chapter.title} ·{" "}
                        {isJeopardyChapter(
                          liveChapterInfo.chapter,
                          getChapterQuestions(questions, liveChapterInfo.chapter.$id),
                        )
                          ? "Jeopardy clue"
                          : isRankingChapter(
                                liveChapterInfo.chapter,
                                getChapterQuestions(questions, liveChapterInfo.chapter.$id),
                              )
                            ? "Item"
                            : "Question"}{" "}
                        {!isJeopardyChapter(
                          liveChapterInfo.chapter,
                          getChapterQuestions(questions, liveChapterInfo.chapter.$id),
                        )
                          ? `${liveChapterInfo.questionIndex + 1} of ${liveChapterInfo.questionCount}`
                          : "live"}
                      </p>
                    ) : presentingChapterIsBlackjack && presentingChapter?.isOpen ? (
                      <p className="mt-1 text-sm text-muted">
                        {presentingChapter.title} · Blackjack-tafel open
                      </p>
                    ) : presentingChapterIsJeopardy && presentingChapter?.isOpen ? (
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {presentingChapter.title} · Jeopardy-bord open
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-muted">No question is live yet.</p>
                    )}
                    <p className="mt-1 text-sm text-muted">
                      Share the presentation, results, or score with players.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {presentingChapter && presentingChapterIsBlackjack ? (
                      <Button type="button" onClick={() => setHostScreen("blackjack")}>
                        Open blackjack
                      </Button>
                    ) : presentingChapter && presentingChapterIsJeopardy ? (
                      <Button
                        type="button"
                        onClick={() =>
                          setHostScreen(
                            quiz?.activeQuestionId ? "jeopardyPresent" : "jeopardyBoard",
                          )
                        }
                      >
                        Open bord
                      </Button>
                    ) : presentedQuestion && presentingChapter ? (
                      <Button type="button" onClick={() => setHostScreen("present")}>
                        Continue presenting
                      </Button>
                    ) : null}
                    {isQuestionLive ? (
                      <Button type="button" variant="secondary" onClick={showResults}>
                        Show results
                      </Button>
                    ) : null}
                    <Button type="button" variant="secondary" onClick={showScore}>
                      Show score
                    </Button>
                  </div>
                </Card>
              ) : null}

              {quizStarted ? (
                chapters.map((chapter) => {
                  const chapterQuestions = getChapterQuestions(questions, chapter.$id);
                  const chapterIsRanking = isRankingChapter(chapter, chapterQuestions);
                  const chapterIsJeopardy = isJeopardyChapter(chapter, chapterQuestions);
                  const chapterIsBlackjack = isBlackjackChapter(chapter);
                  const chapterQuestionCount = chapterQuestions.length;
                  const liveQuestionIndex = chapterQuestions.findIndex(
                    (question) => question.$id === quiz?.activeQuestionId,
                  );
                  const isChapterLive = liveQuestionIndex >= 0;
                  const isBusy = savingId === chapter.$id;
                  const itemLabel = chapterIsBlackjack
                    ? "spelers"
                    : chapterIsJeopardy
                      ? "clues"
                      : chapterIsRanking
                        ? "items"
                        : "questions";

                  let statusText = chapterIsBlackjack
                    ? "Live blackjack"
                    : `${chapterQuestionCount} ${itemLabel}`;

                  if (isChapterLive) {
                    statusText = chapterIsJeopardy
                      ? `Clue live · ${chapterQuestionCount} ${itemLabel}`
                      : `${chapterIsRanking ? "Item" : "Question"} ${liveQuestionIndex + 1} of ${chapterQuestionCount} · Live`;
                  } else if (chapter.isOpen) {
                    statusText = chapterIsBlackjack
                      ? "Blackjack open"
                      : chapterIsJeopardy
                        ? `Bord open · ${chapterQuestionCount} ${itemLabel}`
                        : `Open · ${chapterQuestionCount} ${itemLabel}`;
                  } else {
                    statusText = chapterIsBlackjack
                      ? "Blackjack"
                      : `Closed · ${chapterQuestionCount} ${itemLabel}`;
                  }

                  return (
                    <Card key={chapter.$id} className="space-y-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            Chapter {chapter.order + 1}
                          </p>
                          <h2 className="text-lg font-semibold">{chapter.title}</h2>
                          <p className="mt-1 text-sm text-muted">
                            {isChapterLive ? (
                              <span className="font-medium text-emerald-600">{statusText}</span>
                            ) : (
                              statusText
                            )}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {chapter.isOpen ? (
                            <>
                              <Button
                                type="button"
                                disabled={
                                  (!chapterIsBlackjack && chapterQuestionCount === 0) ||
                                  savingId !== null
                                }
                                onClick={() => continuePresenting(chapter)}
                              >
                                {chapterIsBlackjack
                                  ? "Open blackjack"
                                  : chapterIsJeopardy
                                    ? "Open bord"
                                    : "Continue presenting"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                disabled={isBusy || quizEnded}
                                onClick={() => toggleChapter(chapter, false)}
                              >
                                {isBusy ? "Saving..." : "Close chapter"}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              disabled={
                                isBusy ||
                                quizEnded ||
                                (!chapterIsBlackjack && chapterQuestionCount === 0) ||
                                savingId !== null
                              }
                              onClick={() => startChapter(chapter)}
                            >
                              {isBusy ? "Starting..." : "Start chapter"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <Card>
                  <p className="text-sm text-muted">
                    {quiz?.status === "open"
                      ? "Players can join now. Start the quiz to unlock chapter controls."
                      : "Open the quiz first so players can join with your code."}
                  </p>
                </Card>
              )}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

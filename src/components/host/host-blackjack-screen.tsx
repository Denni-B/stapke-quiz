"use client";

import { useCallback, useEffect, useState } from "react";

import { PlayingCard } from "@/components/blackjack/playing-card";
import { Button } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import type { BlackjackHostState, Chapter, Quiz } from "@/lib/types";

interface HostBlackjackScreenProps {
  quizId: string;
  userId: string;
  quiz: Quiz;
  chapter: Chapter;
  onExit: () => void;
}

export function HostBlackjackScreen({
  quizId,
  userId,
  quiz,
  chapter,
  onExit,
}: HostBlackjackScreenProps) {
  const [state, setState] = useState<BlackjackHostState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadState = useCallback(async () => {
    try {
      const response = await fetch(apiUrl(`/api/host/${quizId}/blackjack`));

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Kon blackjack-status niet laden.");
      }

      const data = (await response.json()) as { state: BlackjackHostState };
      setState(data.state);
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Laden mislukt.");
    }
  }, [quizId]);

  useEffect(() => {
    void loadState();
    const interval = window.setInterval(() => {
      void loadState();
    }, 500);

    return () => window.clearInterval(interval);
  }, [loadState]);

  const runAction = useCallback(
    async (action: "start" | "deal" | "continue-insurance" | "next-round" | "reset") => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(apiUrl(`/api/host/${quizId}/blackjack`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, action }),
        });

        const data = (await response.json()) as {
          state?: BlackjackHostState;
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Actie mislukt.");
        }

        if (data.state) {
          setState(data.state);
        } else {
          await loadState();
        }
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Actie mislukt.");
      } finally {
        setLoading(false);
      }
    },
    [loadState, quizId, userId],
  );

  if (!state) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a1f12] text-white">
        <p>{error || "Blackjack laden..."}</p>
      </div>
    );
  }

  const phaseLabel: Record<BlackjackHostState["phase"], string> = {
    seating: "Stoelen kiezen",
    betting: "Inzetten",
    insurance: "Insurance",
    playing: "Spelers aan beurt",
    dealer: "Dealer speelt",
    results: "Resultaten",
  };

  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-[#0a1f12] text-white">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-wide text-emerald-300/80">Blackjack · Live</p>
          <p className="text-sm text-white/70">
            {quiz.title} · {chapter.title} · Ronde {state.roundNumber}
          </p>
          <p className="text-xs text-amber-300">{phaseLabel[state.phase]}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="danger"
            disabled={loading}
            onClick={() => {
              if (
                window.confirm(
                  "Weet je zeker dat je het blackjack-spel wilt resetten? Stoelen en rondes worden gewist.",
                )
              ) {
                void runAction("reset");
              }
            }}
          >
            Reset spel
          </Button>
          <Button type="button" variant="secondary" onClick={onExit}>
            Sluiten
          </Button>
        </div>
      </header>

      {error ? (
        <div className="bg-red-500/20 px-4 py-2 text-center text-sm text-red-200">{error}</div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <section className="mb-8 text-center">
          <h2 className="mb-4 text-lg font-semibold text-emerald-200">Dealer</h2>
          <div className="flex justify-center gap-3">
            {state.dealerCards.length > 0 ? (
              state.dealerCards.map((card, index) => (
                <PlayingCard key={`dealer-${index}`} card={card} size="lg" />
              ))
            ) : (
              <p className="text-white/50">Nog geen kaarten</p>
            )}
          </div>
          {state.dealerValue ? (
            <p className="mt-2 text-sm text-white/60">Waarde: {state.dealerValue}</p>
          ) : null}
        </section>

        {state.phase === "seating" ? (
          <section className="mx-auto max-w-3xl">
            <h2 className="mb-4 text-center text-lg font-semibold">Stoelen</h2>
            {state.seatCount === 0 ? (
              <p className="text-center text-white/70">
                Nog geen spelers. Laat deelnemers joinen voordat je stoelen toewijst.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: state.seatCount }, (_, index) => {
                  const seatNumber = index + 1;
                  const seat = state.seats.find((item) => item.seatNumber === seatNumber);

                  return (
                    <div
                      key={seatNumber}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 text-center"
                    >
                      <p className="text-sm text-white/50">Stoel {seatNumber}</p>
                      <p className="mt-1 font-medium">{seat?.displayName ?? "Vrij"}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                disabled={loading || !state.allSeatsTaken}
                onClick={() => runAction("start")}
              >
                Start spel
              </Button>
            </div>
          </section>
        ) : null}

        {state.phase === "betting" ? (
          <section className="mx-auto max-w-2xl">
            <h2 className="mb-4 text-center text-lg font-semibold">Inzetten</h2>
            <div className="space-y-2">
              {state.bettingStatus.map((item) => (
                <div
                  key={item.seatNumber}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-4 py-3"
                >
                  <span>
                    Stoel {item.seatNumber} · {item.displayName}
                  </span>
                  <span className={item.betConfirmed ? "text-emerald-300" : "text-amber-300"}>
                    {item.betConfirmed ? `${item.bet} pts ✓` : item.bet > 0 ? `${item.bet} pts` : "—"}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                disabled={loading || !state.allBetsConfirmed}
                onClick={() => runAction("deal")}
              >
                Deel hand
              </Button>
            </div>
          </section>
        ) : null}

        {state.phase === "insurance" ? (
          <section className="mx-auto max-w-md text-center">
            <p className="text-white/70">Spelers kiezen insurance...</p>
            <Button
              type="button"
              className="mt-4"
              disabled={loading || !state.allInsuranceDecided}
              onClick={() => runAction("continue-insurance")}
            >
              Verder spelen
            </Button>
          </section>
        ) : null}

        {["playing", "dealer", "results"].includes(state.phase) ? (
          <section>
            <h2 className="mb-4 text-center text-lg font-semibold">Spelers</h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {state.playerHands.map((hand) => {
                const isCurrent =
                  state.phase === "playing" &&
                  state.currentSeat === hand.seatNumber &&
                  state.currentHandIndex === hand.handIndex;

                return (
                  <div
                    key={`${hand.seatNumber}-${hand.handIndex}`}
                    className={`rounded-xl border p-4 ${
                      isCurrent
                        ? "border-amber-400/60 bg-amber-400/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="font-medium">
                      Stoel {hand.seatNumber} · {hand.displayName}
                      {hand.handIndex > 0 ? ` (hand ${hand.handIndex + 1})` : ""}
                    </p>
                    <div className="mt-3 flex gap-2">
                      {hand.cards.map((card, index) => (
                        <PlayingCard key={index} card={card} size="sm" />
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-white/60">
                      {hand.handValue ? `Waarde ${hand.handValue}` : ""} · Inzet {hand.bet} ·{" "}
                      {hand.status}
                      {hand.outcome ? ` · ${hand.outcome}` : ""}
                      {hand.payout ? ` (${hand.payout > 0 ? "+" : ""}${hand.payout})` : ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {state.phase === "results" ? (
          <div className="mt-6 flex justify-center">
            <Button
              type="button"
              disabled={loading}
              onClick={() => runAction("next-round")}
            >
              Volgende ronde
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}

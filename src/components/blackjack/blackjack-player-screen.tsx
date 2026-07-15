"use client";

import { useCallback, useEffect, useState } from "react";

import { PlayingCard } from "@/components/blackjack/playing-card";
import { Button, Card, Input } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import type { BlackjackPlayerState } from "@/lib/types";

interface BlackjackPlayerScreenProps {
  sessionToken: string;
  blackjack: BlackjackPlayerState;
  totalScore: number;
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(data.error ?? "Request failed.");
  }

  return data;
}

export function BlackjackPlayerScreen({
  sessionToken,
  blackjack,
  totalScore,
}: BlackjackPlayerScreenProps) {
  const [betInput, setBetInput] = useState(String(blackjack.myHands[0]?.bet || 10));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentBet = blackjack.myHands[0]?.bet;
    if (currentBet && currentBet > 0) {
      setBetInput(String(currentBet));
    }
  }, [blackjack.myHands]);

  const chooseSeat = useCallback(
    async (seatNumber: number) => {
      setError("");
      setLoading(true);

      try {
        await postJson(apiUrl("/api/blackjack/seat"), { sessionToken, seatNumber });
      } catch (seatError) {
        setError(seatError instanceof Error ? seatError.message : "Kon stoel niet kiezen.");
      } finally {
        setLoading(false);
      }
    },
    [sessionToken],
  );

  const submitBet = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      const bet = Number.parseInt(betInput, 10);
      await postJson(apiUrl("/api/blackjack/bet"), { sessionToken, bet });
    } catch (betError) {
      setError(betError instanceof Error ? betError.message : "Kon inzet niet plaatsen.");
    } finally {
      setLoading(false);
    }
  }, [betInput, sessionToken]);

  const confirmBet = useCallback(async () => {
    setError("");
    setLoading(true);

    try {
      await postJson(apiUrl("/api/blackjack/confirm-bet"), { sessionToken });
    } catch (confirmError) {
      setError(
        confirmError instanceof Error ? confirmError.message : "Kon inzet niet bevestigen.",
      );
    } finally {
      setLoading(false);
    }
  }, [sessionToken]);

  const takeInsurance = useCallback(
    async (take: boolean) => {
      setError("");
      setLoading(true);

      try {
        await postJson(apiUrl("/api/blackjack/insurance"), { sessionToken, takeInsurance: take });
      } catch (insuranceError) {
        setError(
          insuranceError instanceof Error ? insuranceError.message : "Insurance mislukt.",
        );
      } finally {
        setLoading(false);
      }
    },
    [sessionToken],
  );

  const performAction = useCallback(
    async (action: "hit" | "stand" | "double" | "split") => {
      setError("");
      setLoading(true);

      try {
        await postJson(apiUrl("/api/blackjack/action"), { sessionToken, action });
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Actie mislukt.");
      } finally {
        setLoading(false);
      }
    },
    [sessionToken],
  );

  const occupiedSeatNumbers = new Set(
    blackjack.occupiedSeats.map((seat) => seat.seatNumber),
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-4 p-4">
      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Blackjack · Ronde {blackjack.roundNumber}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{totalScore} punten</p>
        {blackjack.mySeatNumber ? (
          <p className="mt-1 text-sm text-muted">Jouw stoel: {blackjack.mySeatNumber}</p>
        ) : null}
      </Card>

      {error ? (
        <Card className="border-red-200 bg-red-50 text-sm text-red-700">{error}</Card>
      ) : null}

      {blackjack.phase === "seating" ? (
        <Card>
          <h2 className="text-lg font-semibold">Kies je stoel</h2>
          {blackjack.seatCount === 0 ? (
            <p className="mt-2 text-sm text-amber-700">
              Nog geen spelers beschikbaar voor blackjack. Wacht tot er deelnemers
              zijn ingelogd (niet in een team).
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted">
                Er zijn {blackjack.seatCount} stoelen. Kies een vrije positie.
              </p>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {Array.from({ length: blackjack.seatCount }, (_, index) => {
                  const seatNumber = index + 1;
                  const occupied = blackjack.occupiedSeats.find(
                    (seat) => seat.seatNumber === seatNumber,
                  );
                  const isMine = blackjack.mySeatNumber === seatNumber;

                  return (
                    <Button
                      key={seatNumber}
                      type="button"
                      variant={isMine ? "primary" : "secondary"}
                      disabled={
                        loading || (occupiedSeatNumbers.has(seatNumber) && !isMine)
                      }
                      onClick={() => chooseSeat(seatNumber)}
                      className="flex h-20 flex-col"
                    >
                      <span className="text-lg font-bold">Stoel {seatNumber}</span>
                      <span className="text-xs opacity-80">
                        {occupied ? occupied.displayName : "Vrij"}
                      </span>
                    </Button>
                  );
                })}
              </div>
            </>
          )}
          <p className="mt-4 text-sm text-muted">
            Wacht tot de host start wanneer iedereen een stoel heeft.
          </p>
        </Card>
      ) : null}

      {blackjack.phase === "betting" ? (
        <Card>
          <h2 className="text-lg font-semibold">Plaats je inzet</h2>
          <p className="mt-1 text-sm text-muted">
            Beschikbaar saldo: {blackjack.availableBalance} punten
          </p>
          {blackjack.myHands[0]?.betConfirmed ? (
            <p className="mt-4 text-sm font-medium text-emerald-700">
              Inzet bevestigd: {blackjack.myHands[0].bet} punten. Wacht op de dealer.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <Input
                type="number"
                min={1}
                max={blackjack.availableBalance}
                value={betInput}
                onChange={(event) => setBetInput(event.target.value)}
              />
              <div className="flex gap-2">
                <Button type="button" disabled={loading} onClick={submitBet}>
                  Inzet instellen
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading || !blackjack.myHands[0]?.bet}
                  onClick={confirmBet}
                >
                  Bevestig inzet
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : null}

      {blackjack.phase === "insurance" && !blackjack.needsInsurance ? (
        <Card>
          <p className="text-sm text-muted">Wacht tot iedereen insurance heeft gekozen...</p>
        </Card>
      ) : null}

      {blackjack.phase === "insurance" && blackjack.needsInsurance ? (
        <Card>
          <h2 className="text-lg font-semibold">Insurance?</h2>
          <p className="mt-1 text-sm text-muted">
            De dealer toont een Aas. Wil je insurance nemen (max helft van je inzet)?
          </p>
          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={loading} onClick={() => takeInsurance(true)}>
              Ja
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => takeInsurance(false)}
            >
              Nee
            </Button>
          </div>
        </Card>
      ) : null}

      {["playing", "dealer", "results", "insurance"].includes(blackjack.phase) ? (
        <Card>
          <h2 className="text-lg font-semibold">Dealer</h2>
          <div className="mt-4 flex gap-3">
            {blackjack.dealerCards && blackjack.dealerCards.length > 0 ? (
              blackjack.dealerCards.map((card, index) => (
                <PlayingCard key={`dealer-${index}`} card={card} />
              ))
            ) : blackjack.dealerUpCard ? (
              <PlayingCard card={blackjack.dealerUpCard} />
            ) : (
              <p className="text-sm text-muted">Nog geen kaarten</p>
            )}
          </div>
          {blackjack.dealerValue ? (
            <p className="mt-2 text-sm text-muted">Dealer: {blackjack.dealerValue}</p>
          ) : null}
        </Card>
      ) : null}

      {blackjack.myHands.length > 0 &&
      ["playing", "dealer", "results", "insurance"].includes(blackjack.phase) ? (
        <div className="space-y-4">
          {blackjack.myHands.map((hand) => (
            <Card key={hand.handIndex}>
              <h2 className="text-lg font-semibold">
                Jouw hand{blackjack.myHands.length > 1 ? ` ${hand.handIndex + 1}` : ""}
              </h2>
              <div className="mt-4 flex gap-3">
                {hand.cards.map((card, index) => (
                  <PlayingCard key={`${hand.handIndex}-${index}`} card={card} />
                ))}
              </div>
              <p className="mt-2 text-sm text-muted">
                Waarde: {hand.handValue} · Inzet: {hand.bet}
              </p>
              {hand.outcome ? (
                <p className="mt-2 text-sm font-medium">
                  {hand.outcome === "won"
                    ? `Gewonnen (+${hand.payout ?? 0})`
                    : hand.outcome === "lost"
                      ? `Verloren (${hand.payout ?? 0})`
                      : "Gelijk (push)"}
                </p>
              ) : null}
            </Card>
          ))}
        </div>
      ) : null}

      {blackjack.phase === "playing" && blackjack.isMyTurn ? (
        <Card>
          <h2 className="text-lg font-semibold">Jouw beurt</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {blackjack.allowedActions.includes("hit") ? (
              <Button type="button" disabled={loading} onClick={() => performAction("hit")}>
                Hit
              </Button>
            ) : null}
            {blackjack.allowedActions.includes("stand") ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => performAction("stand")}
              >
                Stand
              </Button>
            ) : null}
            {blackjack.allowedActions.includes("double") ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => performAction("double")}
              >
                Double
              </Button>
            ) : null}
            {blackjack.allowedActions.includes("split") ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loading}
                onClick={() => performAction("split")}
              >
                Split
              </Button>
            ) : null}
          </div>
        </Card>
      ) : null}

      {blackjack.phase === "playing" && !blackjack.isMyTurn ? (
        <Card>
          <p className="text-sm text-muted">
            Wacht op speler aan stoel {blackjack.currentSeat ?? "?"}...
          </p>
        </Card>
      ) : null}

      {blackjack.phase === "dealer" ? (
        <Card>
          <p className="text-sm text-muted">De dealer speelt...</p>
        </Card>
      ) : null}

      {blackjack.phase === "results" ? (
        <Card>
          <p className="text-sm text-muted">Ronde afgerond. Wacht op de volgende ronde.</p>
        </Card>
      ) : null}
    </div>
  );
}

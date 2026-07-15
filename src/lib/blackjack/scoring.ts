import type { BlackjackCard, BlackjackHandOutcome } from "@/lib/types";

import { handValue, isBlackjack, isBust } from "@/lib/blackjack/hand";

export function calculateHandPayout(
  playerCards: BlackjackCard[],
  dealerCards: BlackjackCard[],
  bet: number,
  insuranceBet: number,
): { outcome: BlackjackHandOutcome; payout: number } {
  const playerBlackjack = isBlackjack(playerCards);
  const dealerBlackjack = isBlackjack(dealerCards);
  const playerBust = isBust(playerCards);
  const dealerBust = isBust(dealerCards);
  const playerValue = handValue(playerCards).value;
  const dealerValue = handValue(dealerCards).value;

  let insurancePayout = 0;

  if (insuranceBet > 0 && dealerBlackjack) {
    insurancePayout = insuranceBet * 2;
  } else if (insuranceBet > 0) {
    insurancePayout = -insuranceBet;
  }

  if (playerBust) {
    return { outcome: "lost", payout: -bet + insurancePayout };
  }

  if (playerBlackjack && dealerBlackjack) {
    return { outcome: "push", payout: insurancePayout };
  }

  if (playerBlackjack) {
    return { outcome: "won", payout: Math.round(bet * 1.5) + insurancePayout };
  }

  if (dealerBlackjack) {
    return { outcome: "lost", payout: -bet + insurancePayout };
  }

  if (dealerBust) {
    return { outcome: "won", payout: bet + insurancePayout };
  }

  if (playerValue > dealerValue) {
    return { outcome: "won", payout: bet + insurancePayout };
  }

  if (playerValue < dealerValue) {
    return { outcome: "lost", payout: -bet + insurancePayout };
  }

  return { outcome: "push", payout: insurancePayout };
}

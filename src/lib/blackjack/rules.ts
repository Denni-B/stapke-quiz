import type { BlackjackCard } from "@/lib/types";

import { canSplit, handValue, isBlackjack, isBust, isTwentyOne } from "@/lib/blackjack/hand";

export type BlackjackAction = "hit" | "stand" | "double" | "split";

export function getAllowedActions(
  cards: BlackjackCard[],
  hasSplit: boolean,
): BlackjackAction[] {
  if (cards.length === 0) {
    return [];
  }

  if (isBust(cards) || isBlackjack(cards) || isTwentyOne(cards)) {
    return [];
  }

  const actions: BlackjackAction[] = ["hit", "stand"];

  if (cards.length === 2) {
    actions.push("double");

    if (canSplit(cards) && !hasSplit) {
      actions.push("split");
    }
  }

  return actions;
}

export function dealerShouldHit(cards: BlackjackCard[]): boolean {
  const { value, isSoft } = handValue(cards);

  if (value < 17) {
    return true;
  }

  if (value === 17 && isSoft) {
    return true;
  }

  return false;
}

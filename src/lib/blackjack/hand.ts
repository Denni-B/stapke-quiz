import type { BlackjackCard, BlackjackRank } from "@/lib/types";

function rankValue(rank: BlackjackRank): number {
  if (rank === "A") {
    return 11;
  }

  if (rank === "K" || rank === "Q" || rank === "J") {
    return 10;
  }

  return Number(rank);
}

export function handValue(cards: BlackjackCard[]): {
  value: number;
  isSoft: boolean;
} {
  let value = 0;
  let aces = 0;

  for (const card of cards) {
    value += rankValue(card.rank);

    if (card.rank === "A") {
      aces += 1;
    }
  }

  while (value > 21 && aces > 0) {
    value -= 10;
    aces -= 1;
  }

  const isSoft = aces > 0 && value <= 21 && value + 10 <= 21;

  return { value, isSoft };
}

export function isBlackjack(cards: BlackjackCard[]): boolean {
  return cards.length === 2 && handValue(cards).value === 21;
}

export function isBust(cards: BlackjackCard[]): boolean {
  return handValue(cards).value > 21;
}

export function isTwentyOne(cards: BlackjackCard[]): boolean {
  return cards.length > 0 && handValue(cards).value === 21;
}

export function resolveHandStatusAfterCards(
  cards: BlackjackCard[],
  options?: { allowNaturalBlackjack?: boolean },
): "active" | "stand" | "bust" | "blackjack" {
  if (isBust(cards)) {
    return "bust";
  }

  const allowNaturalBlackjack = options?.allowNaturalBlackjack ?? true;

  if (allowNaturalBlackjack && isBlackjack(cards)) {
    return "blackjack";
  }

  if (isTwentyOne(cards)) {
    return "stand";
  }

  return "active";
}

export function canSplit(cards: BlackjackCard[]): boolean {
  if (cards.length !== 2) {
    return false;
  }

  const [first, second] = cards;
  const firstValue = first.rank === "10" || first.rank === "J" || first.rank === "Q" || first.rank === "K"
    ? "10"
    : first.rank;
  const secondValue = second.rank === "10" || second.rank === "J" || second.rank === "Q" || second.rank === "K"
    ? "10"
    : second.rank;

  return firstValue === secondValue;
}

import type { BlackjackCard } from "@/lib/types";

import { RANKS, SUITS } from "@/lib/blackjack/cards";

export function createDeck(): BlackjackCard[] {
  const deck: BlackjackCard[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

export function shuffleDeck(deck: BlackjackCard[]): BlackjackCard[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function freshShuffledDeck(): BlackjackCard[] {
  return shuffleDeck(createDeck());
}

export function drawCard(deck: BlackjackCard[]): {
  card: BlackjackCard;
  remaining: BlackjackCard[];
} {
  if (deck.length === 0) {
    throw new Error("Deck is empty.");
  }

  const [card, ...remaining] = deck;
  return { card, remaining };
}

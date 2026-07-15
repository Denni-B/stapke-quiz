import type { BlackjackCard, BlackjackRank, BlackjackSuit } from "@/lib/types";

export const SUITS: BlackjackSuit[] = ["hearts", "diamonds", "clubs", "spades"];

export const RANKS: BlackjackRank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function parseCards(json: string): BlackjackCard[] {
  if (!json) {
    return [];
  }

  try {
    return JSON.parse(json) as BlackjackCard[];
  } catch {
    return [];
  }
}

export function serializeCards(cards: BlackjackCard[]): string {
  return JSON.stringify(cards);
}

export function cardDisplayRank(rank: BlackjackRank): string {
  return rank;
}

export function cardDisplaySuit(suit: BlackjackSuit): string {
  switch (suit) {
    case "hearts":
      return "♥";
    case "diamonds":
      return "♦";
    case "clubs":
      return "♣";
    case "spades":
      return "♠";
    default:
      return suit;
  }
}

export function isRedSuit(suit: BlackjackSuit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

import type { BlackjackCard } from "@/lib/types";

import {
  cardDisplayRank,
  cardDisplaySuit,
  isRedSuit,
} from "@/lib/blackjack/cards";

interface PlayingCardProps {
  card?: BlackjackCard;
  hidden?: boolean;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-20 w-14 text-lg",
  md: "h-28 w-20 text-2xl",
  lg: "h-36 w-26 text-3xl",
};

export function PlayingCard({ card, hidden = false, size = "md" }: PlayingCardProps) {
  if (hidden || !card) {
    return (
      <div
        className={`flex ${sizeClasses[size]} items-center justify-center rounded-xl border-2 border-emerald-700 bg-gradient-to-br from-emerald-800 to-emerald-950 shadow-lg`}
      >
        <div className="h-8 w-8 rounded-full border-2 border-emerald-500/40" />
      </div>
    );
  }

  const red = isRedSuit(card.suit);

  return (
    <div
      className={`flex ${sizeClasses[size]} flex-col justify-between rounded-xl border border-slate-200 bg-white p-2 shadow-lg`}
    >
      <span className={`font-bold leading-none ${red ? "text-red-600" : "text-slate-900"}`}>
        {cardDisplayRank(card.rank)}
      </span>
      <span
        className={`self-center text-3xl leading-none ${red ? "text-red-600" : "text-slate-900"}`}
      >
        {cardDisplaySuit(card.suit)}
      </span>
      <span
        className={`self-end rotate-180 font-bold leading-none ${red ? "text-red-600" : "text-slate-900"}`}
      >
        {cardDisplayRank(card.rank)}
      </span>
    </div>
  );
}

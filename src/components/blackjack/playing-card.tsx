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
  className?: string;
}

const sizeClasses = {
  sm: "h-16 w-11 text-sm sm:h-20 sm:w-14 sm:text-lg",
  md: "h-16 w-11 text-sm sm:h-28 sm:w-20 sm:text-2xl",
  lg: "h-24 w-16 text-xl sm:h-36 sm:w-26 sm:text-3xl",
};

const suitSizeClasses = {
  sm: "text-xl sm:text-3xl",
  md: "text-xl sm:text-3xl",
  lg: "text-2xl sm:text-3xl",
};

export function PlayingCard({
  card,
  hidden = false,
  size = "md",
  className = "",
}: PlayingCardProps) {
  if (hidden || !card) {
    return (
      <div
        className={`flex shrink-0 ${sizeClasses[size]} items-center justify-center rounded-xl border-2 border-emerald-700 bg-gradient-to-br from-emerald-800 to-emerald-950 shadow-lg ${className}`}
      >
        <div className="h-6 w-6 rounded-full border-2 border-emerald-500/40 sm:h-8 sm:w-8" />
      </div>
    );
  }

  const red = isRedSuit(card.suit);

  return (
    <div
      className={`flex shrink-0 ${sizeClasses[size]} flex-col justify-between rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg sm:p-2 ${className}`}
    >
      <span className={`font-bold leading-none ${red ? "text-red-600" : "text-slate-900"}`}>
        {cardDisplayRank(card.rank)}
      </span>
      <span
        className={`self-center leading-none ${suitSizeClasses[size]} ${red ? "text-red-600" : "text-slate-900"}`}
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

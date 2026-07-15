import type { ReactNode } from "react";

import { Button } from "@/components/ui";

interface HostScreenShellProps {
  breadcrumb: string;
  title?: string;
  badge?: string;
  currentIndex?: number;
  totalCount?: number;
  itemLabel?: string;
  responseStatus?: {
    responseCount: number;
    voterCount: number;
  };
  onExit: () => void;
  exitLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}

export function HostScreenShell({
  breadcrumb,
  title,
  badge,
  currentIndex,
  totalCount,
  itemLabel = "Vraag",
  responseStatus,
  onExit,
  exitLabel = "Sluiten",
  footer,
  children,
}: HostScreenShellProps) {
  const showProgress =
    currentIndex !== undefined && totalCount !== undefined && totalCount > 0;
  const progressPercent = showProgress
    ? ((currentIndex + 1) / totalCount) * 100
    : 0;
  const allAnswered =
    responseStatus !== undefined &&
    responseStatus.voterCount > 0 &&
    responseStatus.responseCount >= responseStatus.voterCount;
  const responsePercent =
    responseStatus && responseStatus.voterCount > 0
      ? Math.min(
          100,
          (responseStatus.responseCount / responseStatus.voterCount) * 100,
        )
      : 0;

  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-[#060d1f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.12)_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(245,158,11,0.06)_0%,_transparent_50%)]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-white/50 sm:text-sm">{breadcrumb}</p>
          {title ? (
            <h1 className="mt-0.5 truncate text-lg font-semibold sm:text-xl">{title}</h1>
          ) : null}
          {badge ? (
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-400">
              {badge}
            </p>
          ) : null}
          {showProgress ? (
            <div className="mt-2 max-w-md">
              <div className="mb-1 flex items-center justify-between text-xs text-white/50">
                <span>
                  {itemLabel} {currentIndex! + 1} van {totalCount}
                </span>
                <span className="tabular-nums">{Math.round(progressPercent)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}
          {responseStatus !== undefined ? (
            <div className="mt-2 max-w-md">
              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span
                  className={`font-semibold tabular-nums ${
                    allAnswered ? "text-emerald-300" : "text-white/60"
                  }`}
                >
                  {responseStatus.voterCount === 0
                    ? "Geen spelers verbonden"
                    : allAnswered
                      ? "Alle spelers geantwoord"
                      : `${responseStatus.responseCount} / ${responseStatus.voterCount} geantwoord`}
                </span>
                {responseStatus.voterCount > 0 ? (
                  <span className="tabular-nums text-white/40">
                    {Math.round(responsePercent)}%
                  </span>
                ) : null}
              </div>
              {responseStatus.voterCount > 0 ? (
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      allAnswered ? "bg-emerald-500" : "bg-amber-400"
                    }`}
                    style={{ width: `${responsePercent}%` }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <Button type="button" variant="secondary" onClick={onExit} className="shrink-0">
          {exitLabel}
        </Button>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>

      {footer ? (
        <footer className="relative z-10 shrink-0 border-t border-white/10 bg-white/5 px-4 py-4 backdrop-blur-xl sm:px-6">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

interface HostScreenFooterProps {
  children: ReactNode;
}

export function HostScreenFooter({ children }: HostScreenFooterProps) {
  return (
    <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
      {children}
    </div>
  );
}

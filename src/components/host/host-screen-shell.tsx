import type { ReactNode } from "react";

import { Button } from "@/components/ui";

interface HostScreenShellProps {
  breadcrumb: string;
  title?: string;
  badge?: string;
  currentIndex?: number;
  totalCount?: number;
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
  responseStatus,
  onExit,
  exitLabel = "Sluiten",
  footer,
  children,
}: HostScreenShellProps) {
  const showProgress =
    currentIndex !== undefined && totalCount !== undefined && totalCount > 0;
  const allAnswered =
    responseStatus !== undefined &&
    responseStatus.voterCount > 0 &&
    responseStatus.responseCount >= responseStatus.voterCount;

  return (
    <div className="fixed inset-0 z-50 flex h-dvh flex-col overflow-hidden bg-[#060d1f] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.12)_0%,_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(245,158,11,0.06)_0%,_transparent_50%)]" />

      <header className="relative z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-white/5 px-4 py-2 backdrop-blur-xl sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {showProgress ? (
            <span className="shrink-0 text-sm font-semibold tabular-nums text-white">
              {currentIndex! + 1}/{totalCount}
            </span>
          ) : null}
          {responseStatus !== undefined ? (
            <span
              className={`shrink-0 text-sm font-semibold tabular-nums ${
                allAnswered ? "text-emerald-300" : "text-white/60"
              }`}
            >
              {responseStatus.voterCount === 0
                ? "0/0"
                : `${responseStatus.responseCount}/${responseStatus.voterCount}`}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-xs text-white/50">{breadcrumb}</p>
            {title ? (
              <h1 className="truncate text-sm font-semibold sm:text-base">{title}</h1>
            ) : null}
            {badge ? (
              <p className="truncate text-xs font-medium text-emerald-400">{badge}</p>
            ) : null}
          </div>
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

import { HostMcOptionCard } from "@/components/host/host-mc-option-card";
import { HostQuestionImage } from "@/components/host/host-question-image";
import { HostScreenShell } from "@/components/host/host-screen-shell";
import type {
  LeaderboardEntry,
  LeaderboardMode,
  ParsedQuestion,
  Quiz,
  TeamLeaderboardEntry,
} from "@/lib/types";

interface HostLeaderboardScreenProps {
  quiz: Quiz;
  leaderboard: LeaderboardEntry[];
  teams?: TeamLeaderboardEntry[];
  mode?: LeaderboardMode;
  question?: ParsedQuestion | null;
  onExit: () => void;
}

function getRankBadgeStyle(rank: number) {
  if (rank === 1) {
    return "border-yellow-400/60 bg-yellow-400/15 text-yellow-300";
  }
  if (rank === 2) {
    return "border-slate-300/50 bg-slate-300/10 text-slate-200";
  }
  if (rank === 3) {
    return "border-amber-500/50 bg-amber-600/15 text-amber-300";
  }
  return "border-white/10 bg-white/5 text-white/70";
}

export function HostLeaderboardScreen({
  quiz,
  leaderboard,
  teams = [],
  mode = "individual",
  question,
  onExit,
}: HostLeaderboardScreenProps) {
  const hasImage = Boolean(question?.imageFileId);
  const teamNamesById = new Map(teams.map((team) => [team.groupId, team.memberNames.join(", ")]));

  return (
    <HostScreenShell
      breadcrumb={quiz.title}
      title={mode === "mixed" ? "Teamscore" : "Scorebord"}
      badge={question ? "Huidige vraag" : undefined}
      onExit={onExit}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[3fr_2fr]">
          {question ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                {question.text ? (
                  <div className="border-b border-white/10 px-4 py-3">
                    <h2 className="text-center text-lg font-semibold leading-snug sm:text-xl lg:text-2xl">
                      {question.text}
                    </h2>
                  </div>
                ) : null}

                {hasImage ? (
                  <HostQuestionImage
                    fileId={question.imageFileId!}
                    alt={question.text || "Vraag"}
                    width={1280}
                    height={720}
                    fill={false}
                    className="min-h-[160px] lg:min-h-[220px]"
                  />
                ) : null}
              </div>

              {question.type === "multipleChoice" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => (
                    <HostMcOptionCard
                      key={optionIndex}
                      option={option}
                      optionIndex={optionIndex}
                      imageSize="sm"
                      textSize="sm"
                    />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={question ? "" : "lg:col-span-2"}>
            <div className="mx-auto max-w-3xl space-y-3">
              {leaderboard.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
                  <p className="text-lg text-white/60">Nog geen spelers met punten.</p>
                </div>
              ) : (
                leaderboard.map((entry) => {
                  const memberNames = teamNamesById.get(entry.participantId);

                  return (
                    <div
                      key={entry.participantId}
                      className={`flex items-center gap-4 rounded-2xl border px-4 py-4 shadow-lg sm:px-5 ${getRankBadgeStyle(entry.rank)}`}
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/30 text-xl font-bold tabular-nums">
                        {entry.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-lg font-semibold sm:text-xl">
                          {entry.displayName}
                        </span>
                        {memberNames ? (
                          <span className="mt-0.5 block truncate text-sm text-white/50">
                            {memberNames}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-xl font-bold tabular-nums text-emerald-400 sm:text-2xl">
                        {entry.totalScore.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </HostScreenShell>
  );
}

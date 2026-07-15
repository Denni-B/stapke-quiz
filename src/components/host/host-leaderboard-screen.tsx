import { Button } from "@/components/ui";
import { getKahootColor } from "@/lib/kahoot-colors";
import { getImagePreviewUrl } from "@/lib/storage";
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

function getRankStyle(rank: number) {
  if (rank === 1) {
    return "border-yellow-400/60 bg-yellow-400/10";
  }

  if (rank === 2) {
    return "border-slate-300/60 bg-slate-300/10";
  }

  if (rank === 3) {
    return "border-amber-600/60 bg-amber-600/10";
  }

  return "border-white/10 bg-white/5";
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
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white">
      <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-4">
        <div>
          <p className="text-sm text-white/60">{quiz.title}</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">
            {mode === "mixed" ? "Teamscore" : "Score"}
          </h1>
        </div>
        <Button type="button" variant="secondary" onClick={onExit}>
          Exit
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-2">
          {question ? (
            <div className="space-y-4">
              {question.text ? (
                <h2 className="text-xl font-semibold sm:text-2xl">{question.text}</h2>
              ) : null}

              {hasImage ? (
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getImagePreviewUrl(question.imageFileId!, 1280, 720)}
                    alt={question.text || "Question"}
                    className="aspect-video w-full object-contain"
                  />
                </div>
              ) : null}

              {question.type === "multipleChoice" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {question.options.map((option, optionIndex) => {
                    const color = getKahootColor(optionIndex);

                    return (
                      <div
                        key={optionIndex}
                        className={`overflow-hidden rounded-xl ${color.bg}`}
                      >
                        {option.imageFileId ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={getImagePreviewUrl(option.imageFileId, 480, 320)}
                            alt={option.text || `Option ${optionIndex + 1}`}
                            className="aspect-video w-full object-cover"
                          />
                        ) : null}
                        <p className="p-3 text-sm font-semibold">
                          {option.text || `Option ${optionIndex + 1}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className={question ? "" : "lg:col-span-2"}>
            <div className="mx-auto max-w-3xl space-y-3">
              {leaderboard.length === 0 ? (
                <p className="text-center text-lg text-white/60">No players have scored yet.</p>
              ) : (
                leaderboard.map((entry) => {
                  const memberNames = teamNamesById.get(entry.participantId);

                  return (
                    <div
                      key={entry.participantId}
                      className={`flex items-center gap-4 rounded-2xl border px-5 py-4 ${getRankStyle(entry.rank)}`}
                    >
                      <span className="w-10 shrink-0 text-center text-2xl font-bold text-white/80">
                        {entry.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xl font-semibold">
                          {entry.displayName}
                        </span>
                        {memberNames ? (
                          <span className="mt-0.5 block truncate text-sm text-white/60">
                            {memberNames}
                          </span>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-2xl font-bold text-primary">
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
    </div>
  );
}

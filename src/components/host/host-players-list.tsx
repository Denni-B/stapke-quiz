import { Button } from "@/components/ui";

export interface HostPlayer {
  id: string;
  displayName: string;
  joinedAt: string;
}

interface HostPlayersListProps {
  players: HostPlayer[];
  deletingId: string | null;
  onDelete: (playerId: string) => void;
}

export function HostPlayersList({ players, deletingId, onDelete }: HostPlayersListProps) {
  if (players.length === 0) {
    return <p className="text-sm text-muted">No players have joined yet.</p>;
  }

  return (
    <div className="space-y-2">
      {players.map((player) => (
        <div
          key={player.id}
          className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3"
        >
          <div className="min-w-0">
            <p className="truncate font-medium">{player.displayName}</p>
            <p className="text-xs text-muted">
              Joined {new Date(player.joinedAt).toLocaleTimeString()}
            </p>
          </div>
          <Button
            type="button"
            variant="danger"
            disabled={deletingId !== null}
            onClick={() => onDelete(player.id)}
            className="shrink-0"
          >
            {deletingId === player.id ? "Removing..." : "Remove"}
          </Button>
        </div>
      ))}
    </div>
  );
}

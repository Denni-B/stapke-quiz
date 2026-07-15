"use client";

import { useMemo, useState } from "react";

import { Button, Input, Label } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import type { GroupWithMembers } from "@/lib/types";

export interface HostPlayer {
  id: string;
  displayName: string;
  joinedAt: string;
  groupId?: string | null;
}

interface HostGroupsPanelProps {
  quizId: string;
  userId: string;
  players: HostPlayer[];
  groups: GroupWithMembers[];
  deletingId: string | null;
  onDeletePlayer: (playerId: string) => void;
  onGroupsChange: () => void;
  onError: (message: string) => void;
}

export function HostGroupsPanel({
  quizId,
  userId,
  players,
  groups,
  deletingId,
  onDeletePlayer,
  onGroupsChange,
  onError,
}: HostGroupsPanelProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [dissolvingId, setDissolvingId] = useState<string | null>(null);

  const ungroupedPlayers = useMemo(
    () => players.filter((player) => !player.groupId),
    [players],
  );

  const groupedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of groups) {
      for (const memberId of group.memberIds) {
        ids.add(memberId);
      }
    }
    return ids;
  }, [groups]);

  function togglePlayer(playerId: string) {
    setSelectedIds((current) =>
      current.includes(playerId)
        ? current.filter((id) => id !== playerId)
        : [...current, playerId],
    );
  }

  async function handleCreateGroup() {
    if (selectedIds.length < 2) {
      onError("Selecteer minimaal twee spelers om een groep te maken.");
      return;
    }

    setCreating(true);
    onError("");

    try {
      const response = await fetch(
        apiUrl(`/api/host/${quizId}/groups?userId=${encodeURIComponent(userId)}`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantIds: selectedIds,
            name: groupName.trim() || undefined,
          }),
        },
      );

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Kon groep niet maken.");
      }

      setSelectedIds([]);
      setGroupName("");
      onGroupsChange();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Kon groep niet maken.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDissolveGroup(groupId: string, name: string) {
    const confirmed = window.confirm(
      `Groep "${name}" splitsen? Team-punten worden eerlijk verdeeld onder de spelers.`,
    );

    if (!confirmed) {
      return;
    }

    setDissolvingId(groupId);
    onError("");

    try {
      const response = await fetch(
        apiUrl(
          `/api/host/${quizId}/groups/${encodeURIComponent(groupId)}?userId=${encodeURIComponent(userId)}`,
        ),
        { method: "DELETE" },
      );

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Kon groep niet splitsen.");
      }

      onGroupsChange();
    } catch (error) {
      onError(error instanceof Error ? error.message : "Kon groep niet splitsen.");
    } finally {
      setDissolvingId(null);
    }
  }

  if (players.length === 0) {
    return <p className="text-sm text-muted">Nog geen spelers aangemeld.</p>;
  }

  return (
    <div className="space-y-6">
      {groups.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">Actieve groepen</p>
          {groups.map((group) => (
            <div
              key={group.id}
              className="rounded-xl border border-primary/20 bg-indigo-50/60 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{group.name}</p>
                  <p className="mt-1 text-sm text-muted">{group.memberNames.join(", ")}</p>
                  <p className="mt-2 text-sm font-medium text-primary">
                    {group.totalScore.toLocaleString()} punten
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={dissolvingId !== null}
                  onClick={() => handleDissolveGroup(group.id, group.name)}
                  className="shrink-0"
                >
                  {dissolvingId === group.id ? "Splitsen..." : "Groep splitsen"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {ungroupedPlayers.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Spelers zonder groep ({ungroupedPlayers.length})
          </p>

          <div className="space-y-2">
            {ungroupedPlayers.map((player) => {
              const isSelected = selectedIds.includes(player.id);

              return (
                <label
                  key={player.id}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-4 py-3 transition ${
                    isSelected
                      ? "border-primary bg-indigo-50"
                      : "border-border bg-slate-50"
                  }`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlayer(player.id)}
                      className="h-4 w-4 rounded border-border text-primary"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{player.displayName}</p>
                      <p className="text-xs text-muted">
                        Aangemeld {new Date(player.joinedAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deletingId !== null}
                    onClick={(event) => {
                      event.preventDefault();
                      onDeletePlayer(player.id);
                    }}
                    className="shrink-0"
                  >
                    {deletingId === player.id ? "Verwijderen..." : "Verwijderen"}
                  </Button>
                </label>
              );
            })}
          </div>

          <div className="space-y-2 rounded-xl border border-border bg-white p-4">
            <Label htmlFor="group-name">Groepsnaam (optioneel)</Label>
            <Input
              id="group-name"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Bijv. Team Rood"
            />
            <Button
              type="button"
              disabled={creating || selectedIds.length < 2}
              onClick={handleCreateGroup}
            >
              {creating
                ? "Groep maken..."
                : selectedIds.length < 2
                  ? "Selecteer minimaal 2 spelers"
                  : `Groep maken (${selectedIds.length} spelers)`}
            </Button>
          </div>
        </div>
      ) : null}

      {groupedPlayerIds.size > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Spelers in groepen</p>
          {players
            .filter((player) => player.groupId)
            .map((player) => {
              const group = groups.find((entry) => entry.memberIds.includes(player.id));

              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-slate-50 px-4 py-3 opacity-80"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{player.displayName}</p>
                    <p className="text-xs text-muted">
                      In groep: {group?.name ?? "Onbekend"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="danger"
                    disabled={deletingId !== null}
                    onClick={() => onDeletePlayer(player.id)}
                    className="shrink-0"
                  >
                    {deletingId === player.id ? "Verwijderen..." : "Verwijderen"}
                  </Button>
                </div>
              );
            })}
        </div>
      ) : null}
    </div>
  );
}

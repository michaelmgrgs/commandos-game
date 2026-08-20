"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Team = { id: string; name: string; color: string; maxPlayers: number; _count: { players: number } };
type GameResponse = {
  game: { id: string; name: string; phase: string; teams: Team[] } | null;
};

export default function JoinPage() {
  const router = useRouter();
  const [game, setGame] = useState<GameResponse["game"]>(null);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/admin/game", { cache: "no-store" });
        const data: GameResponse = await res.json();
        if (cancelled) return;
        setGame(data.game);
      } catch {
        if (!cancelled) setError("Couldn't load the game. Try refreshing.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  async function submit() {
    if (!game || !teamId || !name.trim()) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId: game.id, teamId, name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(`/p/${data.player.token}`);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="cc-container">
        <p>Loading…</p>
      </div>
    );
  }

  if (!game || game.phase === "SETUP") {
    return (
      <div className="cc-container">
        <div className="cc-card" style={{ textAlign: "center" }}>
          <div className="cc-card-title">Not open yet</div>
          <p>The game admin hasn't opened registration yet. Check back shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="cc-container">
      <div className="cc-title" style={{ marginBottom: 4 }}>
        {game.name}
      </div>
      <p className="cc-subtitle" style={{ marginBottom: 24 }}>
        Enter your name and pick your team.
      </p>

      <div className="cc-card">
        <label className="cc-label">Your name</label>
        <input
          className="cc-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alex"
          maxLength={40}
        />

        <label className="cc-label">Pick a team</label>
        <div className="cc-team-list">
          {game.teams.map((t) => {
            const full = t._count.players >= t.maxPlayers;
            return (
              <button
                key={t.id}
                type="button"
                disabled={full}
                className={`cc-team-option ${teamId === t.id ? "selected" : ""}`}
                onClick={() => setTeamId(t.id)}
              >
                <div className="cc-team-swatch" style={{ background: t.color }} />
                <div style={{ fontWeight: 700 }}>{t.name}</div>
                <div className="cc-subtitle">
                  {t._count.players} / {t.maxPlayers} joined{full ? " — full" : ""}
                </div>
              </button>
            );
          })}
        </div>

        {error && <div className="cc-error">{error}</div>}

        <button
          className="cc-btn cc-btn-primary cc-btn-block"
          disabled={!name.trim() || !teamId || submitting}
          onClick={submit}
          style={{ marginTop: 16 }}
        >
          {submitting ? "Joining…" : "Join the game"}
        </button>
      </div>
    </div>
  );
}

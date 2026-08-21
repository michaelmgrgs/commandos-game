"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Team = { id: string; name: string; color: string; maxPlayers: number; _count: { players: number } };
type GameResponse = {
  game: { id: string; name: string; phase: string; teams: Team[] } | null;
};

// Where a player's own token gets stashed after they register, so this
// device can find its way back to their profile even if they land back on
// /join later (back button, closed tab, bookmark) — without this they had
// no way back in and had to register again as a brand-new player.
const TOKEN_STORAGE_KEY = "cc_player_token";

export default function JoinPage() {
  const router = useRouter();
  const [game, setGame] = useState<GameResponse["game"]>(null);
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [returningName, setReturningName] = useState<string | null>(null);
  const [checkingReturning, setCheckingReturning] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function checkReturning() {
      const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
      if (!savedToken) {
        setCheckingReturning(false);
        return;
      }
      try {
        const res = await fetch(`/api/player/${savedToken}`, { cache: "no-store" });
        if (!cancelled && res.ok) {
          const data = await res.json();
          setReturningName(data.player.callsign || data.player.name);
        } else if (!cancelled) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
        }
      } catch {
        // Offline or unreachable — fall through to the normal join form.
      } finally {
        if (!cancelled) setCheckingReturning(false);
      }
    }
    checkReturning();
    return () => {
      cancelled = true;
    };
  }, []);

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

  function continueAsReturning() {
    const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (savedToken) router.replace(`/p/${savedToken}`);
  }

  function joinAsSomeoneElse() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setReturningName(null);
  }

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
      localStorage.setItem(TOKEN_STORAGE_KEY, data.player.token);
      router.replace(`/p/${data.player.token}`);
    } catch {
      setError("Something went wrong. Check your connection and try again.");
      setSubmitting(false);
    }
  }

  if (loading || checkingReturning) {
    return (
      <>
        <div className="cc-join-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-operator.png" alt="Carbon Commandos" />
        </div>
        <div className="cc-container">
          <p>Loading…</p>
        </div>
      </>
    );
  }

  if (returningName) {
    return (
      <>
        <div className="cc-join-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-operator.png" alt="Carbon Commandos" />
        </div>
        <div className="cc-container">
          <div className="cc-card" style={{ textAlign: "center" }}>
            <div className="cc-card-title">Welcome back</div>
            <p>
              You're already signed in as <strong>{returningName}</strong> on this device.
            </p>
            <button className="cc-btn cc-btn-primary cc-btn-block" style={{ marginTop: 12 }} onClick={continueAsReturning}>
              Continue as {returningName}
            </button>
            <button className="cc-btn cc-btn-block" style={{ marginTop: 8 }} onClick={joinAsSomeoneElse}>
              Not you? Join as someone else
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!game || game.phase === "SETUP") {
    return (
      <>
        <div className="cc-join-hero">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-operator.png" alt="Carbon Commandos" />
        </div>
        <div className="cc-container">
          <div className="cc-card" style={{ textAlign: "center" }}>
            <div className="cc-card-title">Not open yet</div>
            <p>The game admin hasn't opened registration yet. Check back shortly.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="cc-join-hero">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-operator.png" alt="Carbon Commandos" />
      </div>
      <div className="cc-container">
      <div className="cc-card">
        <div className="cc-card-title">{game.name}</div>
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
    </>
  );
}

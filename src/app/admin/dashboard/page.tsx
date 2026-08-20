"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAdmin } from "@/lib/useRequireAdmin";

type Role = { id: string; name: string; slotsPerTeam: number | null; startingLives: number };
type Team = { id: string; name: string; color: string; credits: number; score: number; maxPlayers: number };
type Player = {
  id: string;
  name: string;
  callsign: string | null;
  livesCurrent: number;
  livesMax: number;
  status: "ACTIVE" | "ELIMINATED";
  credits: number;
  adminLock: "NONE" | "PAUSED" | "TASK_LOCKED";
  eliminationsCount: number;
  team: Team;
  role: Role | null;
};
type CombatEvent = {
  id: string;
  status: "SUCCESS" | "DENIED";
  reason: string | null;
  createdAt: string;
  attacker: Player;
  target: Player;
};
type AuditEntry = { id: string; action: string; actorType: string; createdAt: string };
type Game = { id: string; name: string; phase: string };

export default function AdminDashboardPage() {
  const { admin, checking } = useRequireAdmin();
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [events, setEvents] = useState<CombatEvent[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameId, setGameId] = useState<string | null>(null);

  const loadGameId = useCallback(async () => {
    const res = await fetch("/api/admin/game", { cache: "no-store" });
    const data = await res.json();
    setGameId(data.game?.id ?? null);
  }, []);

  const loadState = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/state?gameId=${id}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setGame(data.game);
    setTeams(data.teams);
    setPlayers(data.players);
    setRoles(data.roles);
    setEvents(data.recentEvents);
    setAudit(data.recentAudit);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!checking && admin) loadGameId();
  }, [checking, admin, loadGameId]);

  useEffect(() => {
    if (!gameId) return;
    loadState(gameId);
    const interval = setInterval(() => loadState(gameId), 3000);
    return () => clearInterval(interval);
  }, [gameId, loadState]);

  if (checking) return <div className="cc-container">Loading…</div>;
  if (!admin) return null;
  if (!gameId) {
    return (
      <div className="cc-container">
        <p>No active game yet.</p>
        <Link href="/admin/setup" className="cc-btn cc-btn-primary">
          Go to setup
        </Link>
      </div>
    );
  }

  async function playerAction(playerId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/admin/players/${playerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok && gameId) loadState(gameId);
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "That action failed.");
    }
  }

  function roleCountOnTeam(teamId: string, roleId: string, excludePlayerId: string) {
    return players.filter((p) => p.team.id === teamId && p.role?.id === roleId && p.id !== excludePlayerId).length;
  }

  return (
    <div className="cc-container" style={{ maxWidth: 1100 }}>
      <div className="cc-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="cc-title">{game?.name || "Command Center"}</div>
          <div className="cc-subtitle">Phase: {game?.phase}</div>
        </div>
        <Link href="/admin/setup" className="cc-btn">
          Setup →
        </Link>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <>
          <div className="cc-row" style={{ marginTop: 16 }}>
            {teams.map((t) => {
              const teamPlayers = players.filter((p) => p.team.id === t.id);
              const activeCount = teamPlayers.filter((p) => p.status === "ACTIVE").length;
              return (
                <div key={t.id} className="cc-card" style={{ flex: 1, minWidth: 180 }}>
                  <div className="cc-team-swatch" style={{ background: t.color }} />
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div className="cc-subtitle">
                    {activeCount}/{teamPlayers.length} active · {t.credits} credits · score {t.score}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="cc-card">
            <div className="cc-card-title">Roster</div>
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Team</th>
                  <th>Role</th>
                  <th>Lives</th>
                  <th>Status</th>
                  <th>Credits</th>
                  <th>Lock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id}>
                    <td>{p.callsign || p.name}</td>
                    <td>{p.team.name}</td>
                    <td>
                      <select
                        className="cc-select"
                        style={{ marginBottom: 0 }}
                        value={p.role?.id || ""}
                        onChange={(e) => playerAction(p.id, { action: "ASSIGN_ROLE", roleId: e.target.value })}
                      >
                        <option value="" disabled>
                          Awaiting…
                        </option>
                        {roles.map((r) => {
                          const count = roleCountOnTeam(p.team.id, r.id, p.id);
                          const full = r.slotsPerTeam !== null && count >= r.slotsPerTeam && p.role?.id !== r.id;
                          return (
                            <option key={r.id} value={r.id} disabled={full}>
                              {r.name}
                              {full ? " (full)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </td>
                    <td>
                      {p.livesCurrent}/{p.livesMax}
                    </td>
                    <td>
                      <span className={`cc-badge ${p.status === "ACTIVE" ? "cc-badge-active" : "cc-badge-eliminated"}`}>
                        {p.status}
                      </span>
                      {p.adminLock !== "NONE" && <span className="cc-badge cc-badge-locked" style={{ marginLeft: 4 }}>{p.adminLock}</span>}
                    </td>
                    <td>{p.credits}</td>
                    <td>
                      {p.adminLock === "NONE" ? (
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "PAUSE" })}>
                          Pause
                        </button>
                      ) : (
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "RESUME" })}>
                          Resume
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="cc-row">
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "ADJUST_LIFE", delta: 1 })}>
                          +Life
                        </button>
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "ADJUST_LIFE", delta: -1 })}>
                          −Life
                        </button>
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "ADJUST_CREDITS", delta: 10 })}>
                          +10cr
                        </button>
                        {p.status === "ELIMINATED" ? (
                          <button className="cc-btn cc-btn-primary" onClick={() => playerAction(p.id, { action: "REVIVE" })}>
                            Revive
                          </button>
                        ) : (
                          <button className="cc-btn cc-btn-danger" onClick={() => playerAction(p.id, { action: "FORCE_ELIMINATE" })}>
                            Eliminate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="cc-card">
            <div className="cc-card-title">Live activity</div>
            {events.map((e) => (
              <div key={e.id} className="cc-feed-item">
                {e.status === "SUCCESS" ? (
                  <>
                    <strong>{e.attacker.name}</strong> eliminated <strong>{e.target.name}</strong>
                  </>
                ) : (
                  <>
                    <strong>{e.attacker.name}</strong> scan denied on <strong>{e.target.name}</strong> ({e.reason})
                  </>
                )}{" "}
                — {new Date(e.createdAt).toLocaleTimeString()}
              </div>
            ))}
            {audit
              .filter((a) => !["ELIMINATION", "LIFE_LOST"].includes(a.action))
              .map((a) => (
                <div key={a.id} className="cc-feed-item">
                  <strong>{a.action}</strong> by {a.actorType.toLowerCase()} — {new Date(a.createdAt).toLocaleTimeString()}
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAdmin } from "@/lib/useRequireAdmin";
import BrandHeader from "@/components/BrandHeader";

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
type Announcement = { type: string; text: string; ts: string };
type Game = { id: string; name: string; phase: string; config?: { currentTask?: string | null; announcement?: Announcement | null } };

const ANNOUNCEMENT_WINDOW_MS = 9000;

const AUDIT_META: Record<string, { icon: string; tone: string; label: string }> = {
  ROLE_ASSIGNED: { icon: "🎖️", tone: "tone-info", label: "Role assigned" },
  LIFE_ADJUSTED: { icon: "❤️", tone: "tone-good", label: "Life adjusted" },
  CREDITS_ADJUSTED: { icon: "💰", tone: "tone-good", label: "Credits adjusted" },
  REVIVED: { icon: "✨", tone: "tone-good", label: "Player revived" },
  FORCE_ELIMINATED: { icon: "☠️", tone: "tone-danger", label: "Force eliminated" },
  PAUSED: { icon: "⏸️", tone: "tone-amber", label: "Player paused" },
  RESUMED: { icon: "▶️", tone: "tone-good", label: "Player resumed" },
  TEAM_CHANGED: { icon: "🔁", tone: "tone-info", label: "Team changed" },
  GAME_CREATED: { icon: "🎮", tone: "tone-info", label: "Game created" },
  PHASE_CHANGED: { icon: "🚦", tone: "tone-info", label: "Phase changed" },
  TASK_PUSHED: { icon: "📋", tone: "tone-amber", label: "Task pushed to everyone" },
  TASK_RELEASED: { icon: "✅", tone: "tone-good", label: "Task released" },
  TEAM_PAUSED: { icon: "⏸️", tone: "tone-amber", label: "Team paused" },
  TEAM_RESUMED: { icon: "▶️", tone: "tone-good", label: "Team resumed" },
};

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
  const [taskMessage, setTaskMessage] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [dismissedAnnouncementTs, setDismissedAnnouncementTs] = useState<string | null>(null);

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
        <BrandHeader />
        <p>No active game yet.</p>
        <Link href="/admin/setup" className="cc-btn cc-btn-primary">
          Go to setup
        </Link>
      </div>
    );
  }

  async function teamPauseAction(teamId: string, action: "PAUSE_TEAM" | "RESUME_TEAM") {
    const res = await fetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teamId, action }),
    });
    if (res.ok && gameId) loadState(gameId);
    else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "That action failed.");
    }
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

  async function pushTask() {
    if (!gameId || !taskMessage.trim()) return;
    setTaskBusy(true);
    try {
      const res = await fetch("/api/admin/task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId, message: taskMessage.trim() }),
      });
      if (res.ok) {
        loadState(gameId);
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Couldn't push the task.");
      }
    } finally {
      setTaskBusy(false);
    }
  }

  async function releaseTask() {
    if (!gameId) return;
    setTaskBusy(true);
    try {
      const res = await fetch("/api/admin/task", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameId }),
      });
      if (res.ok) {
        setTaskMessage("");
        loadState(gameId);
      }
    } finally {
      setTaskBusy(false);
    }
  }

  function roleCountOnTeam(teamId: string, roleId: string, excludePlayerId: string) {
    return players.filter((p) => p.team.id === teamId && p.role?.id === roleId && p.id !== excludePlayerId).length;
  }

  const announcement = game?.config?.announcement || null;
  const announcementFresh =
    announcement &&
    announcement.ts !== dismissedAnnouncementTs &&
    Date.now() - new Date(announcement.ts).getTime() < ANNOUNCEMENT_WINDOW_MS;
  const taskLockedCount = players.filter((p) => p.adminLock === "TASK_LOCKED").length;

  return (
    <div className="cc-container" style={{ maxWidth: 1100 }}>
      {announcementFresh && announcement && (
        <div className="cc-general-down-overlay" onClick={() => setDismissedAnnouncementTs(announcement.ts)}>
          <div className="cc-siren">🚨</div>
          <div className="cc-general-down-title">{announcement.text}</div>
          <p className="cc-subtitle">Tap anywhere to continue</p>
        </div>
      )}

      <div className="cc-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <BrandHeader size="sm" title={game?.name || "Command Center"} subtitle={`Phase: ${game?.phase}`} />
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
              const pausedCount = teamPlayers.filter((p) => p.adminLock === "PAUSED").length;
              return (
                <div key={t.id} className="cc-card" style={{ flex: 1, minWidth: 180 }}>
                  <div className="cc-team-swatch" style={{ background: t.color }} />
                  <div style={{ fontWeight: 700 }}>{t.name}</div>
                  <div className="cc-subtitle">
                    🟢 {activeCount}/{teamPlayers.length} active · 💰 {t.credits} · 🏆 {t.score}
                  </div>
                  <button
                    className="cc-btn"
                    style={{ marginTop: 10, width: "100%" }}
                    onClick={() => teamPauseAction(t.id, pausedCount > 0 ? "RESUME_TEAM" : "PAUSE_TEAM")}
                  >
                    {pausedCount > 0 ? `▶️ Resume team (${pausedCount})` : "⏸️ Pause team"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="cc-card">
            <div className="cc-card-title">📋 Push a task (pauses the game)</div>
            <p className="cc-subtitle" style={{ marginTop: -6, marginBottom: 12 }}>
              Write instructions and push them to every active player — their screen swaps to this task and combat
              locks until you release everyone. Good for forcing a group challenge or a pause between rounds.
            </p>
            <textarea
              className="cc-textarea"
              placeholder="e.g. Everyone freeze! Gather at the flagpole and do 10 jumping jacks before you can fight again."
              value={taskMessage}
              onChange={(e) => setTaskMessage(e.target.value)}
            />
            <div className="cc-row">
              <button className="cc-btn cc-btn-primary" disabled={taskBusy || !taskMessage.trim()} onClick={pushTask}>
                📋 Push to everyone
              </button>
              <button className="cc-btn" disabled={taskBusy || taskLockedCount === 0} onClick={releaseTask}>
                ✅ Release everyone {taskLockedCount > 0 ? `(${taskLockedCount})` : ""}
              </button>
            </div>
          </div>

          <div className="cc-card">
            <div className="cc-card-title">Roster</div>
            <p className="cc-subtitle" style={{ marginTop: -6, marginBottom: 12 }}>
              Pick a role for each player in the Role column below — that's what unlocks their lives and lets them
              appear as assigned on their own phone screen. Life/pause/eliminate controls stay off until a role is
              set, since lives don't mean anything until then.
            </p>
            <div className="cc-table-wrap">
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
                      {p.role ? (
                        `❤️ ${p.livesCurrent}/${p.livesMax}`
                      ) : (
                        <span className="cc-subtitle" title="Lives are set the moment you assign a role">
                          — (no role yet)
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`cc-badge ${p.status === "ACTIVE" ? "cc-badge-active" : "cc-badge-eliminated"}`}>
                        {p.status === "ACTIVE" ? "🟢 ACTIVE" : "💀 ELIMINATED"}
                      </span>
                      {p.adminLock !== "NONE" && (
                        <span className="cc-badge cc-badge-locked" style={{ marginLeft: 4 }}>
                          {p.adminLock === "PAUSED" ? "⏸️ PAUSED" : "📋 TASK"}
                        </span>
                      )}
                    </td>
                    <td>💰 {p.credits}</td>
                    <td>
                      {p.adminLock === "NONE" ? (
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "PAUSE" })}>
                          ⏸️ Pause
                        </button>
                      ) : (
                        <button className="cc-btn" onClick={() => playerAction(p.id, { action: "RESUME" })}>
                          ▶️ Resume
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="cc-actions-grid">
                        <button
                          className="cc-btn"
                          disabled={!p.role}
                          title={p.role ? "Give this player one more life" : "Assign a role first"}
                          onClick={() => playerAction(p.id, { action: "ADJUST_LIFE", delta: 1 })}
                        >
                          ❤️+1 Life
                        </button>
                        <button
                          className="cc-btn"
                          disabled={!p.role}
                          title={p.role ? "Take away one life" : "Assign a role first"}
                          onClick={() => playerAction(p.id, { action: "ADJUST_LIFE", delta: -1 })}
                        >
                          💔−1 Life
                        </button>
                        <button
                          className="cc-btn"
                          title="Manually give this player 10 credits — e.g. as a task reward or to fix a mistake. Doesn't require a role."
                          onClick={() => playerAction(p.id, { action: "ADJUST_CREDITS", delta: 10 })}
                        >
                          💰+10 Credits
                        </button>
                        <button
                          className="cc-btn"
                          title="Manually take away 10 credits from this player"
                          onClick={() => playerAction(p.id, { action: "ADJUST_CREDITS", delta: -10 })}
                        >
                          💸−10 Credits
                        </button>
                        {p.status === "ELIMINATED" ? (
                          <button
                            className="cc-btn cc-btn-primary"
                            disabled={!p.role}
                            title={p.role ? "Bring this player back into the game" : "Assign a role first"}
                            onClick={() => playerAction(p.id, { action: "REVIVE" })}
                          >
                            ✨ Revive
                          </button>
                        ) : (
                          <button
                            className="cc-btn cc-btn-danger"
                            disabled={!p.role}
                            title={p.role ? "Manually eliminate this player" : "Assign a role first"}
                            onClick={() => playerAction(p.id, { action: "FORCE_ELIMINATE" })}
                          >
                            ☠️ Eliminate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>

          <div className="cc-card">
            <div className="cc-card-title">Live activity</div>
            {events.length === 0 && audit.length === 0 && (
              <p className="cc-subtitle">Nothing's happened yet — combat and admin actions will show up here live.</p>
            )}
            {events.map((e) => {
              const eliminated = e.status === "SUCCESS" && e.target.status === "ELIMINATED";
              const icon = e.status === "DENIED" ? "🚫" : eliminated ? "💀" : "⚔️";
              const tone = e.status === "DENIED" ? "tone-amber" : eliminated ? "tone-danger" : "tone-info";
              return (
                <div key={e.id} className="cc-feed-item">
                  <div className={`cc-feed-icon ${tone}`}>{icon}</div>
                  <div className="cc-feed-text">
                    {e.status === "SUCCESS" ? (
                      <>
                        <strong>{e.attacker.name}</strong> {eliminated ? "eliminated" : "hit"}{" "}
                        <strong>{e.target.name}</strong>
                      </>
                    ) : (
                      <>
                        <strong>{e.attacker.name}</strong> was denied on <strong>{e.target.name}</strong> ({e.reason})
                      </>
                    )}
                  </div>
                  <div className="cc-feed-time">{new Date(e.createdAt).toLocaleTimeString()}</div>
                </div>
              );
            })}
            {audit
              .filter((a) => !["ELIMINATION", "LIFE_LOST"].includes(a.action))
              .map((a) => {
                const meta = AUDIT_META[a.action] || { icon: "•", tone: "tone-info", label: a.action };
                return (
                  <div key={a.id} className="cc-feed-item">
                    <div className={`cc-feed-icon ${meta.tone}`}>{meta.icon}</div>
                    <div className="cc-feed-text">
                      <strong>{meta.label}</strong> by {a.actorType.toLowerCase()}
                    </div>
                    <div className="cc-feed-time">{new Date(a.createdAt).toLocaleTimeString()}</div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

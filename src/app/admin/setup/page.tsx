"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAdmin } from "@/lib/useRequireAdmin";

type Role = {
  id: string;
  name: string;
  rankOrder: number;
  startingLives: number;
  isSecret: boolean;
  slotsPerTeam: number | null;
};
type Team = { id: string; name: string; color: string; maxPlayers: number; _count?: { players: number } };
type Game = { id: string; name: string; phase: string; teams: Team[]; roles: Role[] };
type Rule = { attackerRoleId: string; targetRoleId: string; canEliminate: boolean };

export default function AdminSetupPage() {
  const { admin, checking } = useRequireAdmin();
  const [game, setGame] = useState<Game | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newGameName, setNewGameName] = useState("Carbon Commandos");

  const [teamName, setTeamName] = useState("");
  const [teamColor, setTeamColor] = useState("#5b9ee0");
  const [teamMax, setTeamMax] = useState(8);

  const [roleName, setRoleName] = useState("");
  const [roleLives, setRoleLives] = useState(1);
  const [roleSecret, setRoleSecret] = useState(false);
  const [roleSlots, setRoleSlots] = useState<string>("");

  const loadGame = useCallback(async () => {
    const res = await fetch("/api/admin/game", { cache: "no-store" });
    const data = await res.json();
    setGame(data.game);
    if (data.game) {
      const rres = await fetch(`/api/admin/elimination-rules?gameId=${data.game.id}`);
      if (rres.ok) {
        const rdata = await rres.json();
        setRules(rdata.rules);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!checking && admin) loadGame();
  }, [checking, admin, loadGame]);

  if (checking || loading) return <div className="cc-container">Loading…</div>;
  if (!admin) return null;

  async function createGame() {
    setError("");
    const res = await fetch("/api/admin/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGameName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    loadGame();
  }

  async function addTeam() {
    if (!game || !teamName.trim()) return;
    setError("");
    const res = await fetch("/api/admin/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id, name: teamName.trim(), color: teamColor, maxPlayers: teamMax }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setTeamName("");
    loadGame();
  }

  async function updateTeamMax(teamId: string, maxPlayers: number) {
    await fetch("/api/admin/teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: teamId, maxPlayers }),
    });
    loadGame();
  }

  async function quickSetupRoles() {
    if (!game) return;
    setError("");
    const res = await fetch("/api/admin/roles", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    loadGame();
  }

  async function addRole() {
    if (!game || !roleName.trim()) return;
    setError("");
    const res = await fetch("/api/admin/roles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId: game.id,
        name: roleName.trim(),
        rankOrder: game.roles.length,
        startingLives: roleLives,
        isSecret: roleSecret,
        slotsPerTeam: roleSlots === "" ? null : Number(roleSlots),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setRoleName("");
    setRoleSlots("");
    loadGame();
  }

  async function toggleRule(attackerRoleId: string, targetRoleId: string, current: boolean) {
    if (!game) return;
    await fetch("/api/admin/elimination-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id, attackerRoleId, targetRoleId, canEliminate: !current }),
    });
    loadGame();
  }

  async function setPhase(phase: string) {
    if (!game) return;
    setError("");
    const res = await fetch("/api/admin/game", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: game.id, phase }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    loadGame();
  }

  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/join` : "/join";

  return (
    <div className="cc-container">
      <div className="cc-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="cc-title">Game Setup</div>
        <Link href="/admin/dashboard" className="cc-btn">
          Go to Command Center →
        </Link>
      </div>

      {error && <div className="cc-error">{error}</div>}

      {!game && (
        <div className="cc-card">
          <div className="cc-card-title">Create a game</div>
          <input className="cc-input" value={newGameName} onChange={(e) => setNewGameName(e.target.value)} />
          <button className="cc-btn cc-btn-primary" onClick={createGame}>
            Create game
          </button>
        </div>
      )}

      {game && (
        <>
          <div className="cc-card">
            <div className="cc-card-title">
              {game.name} — phase: {game.phase}
            </div>
            <div className="cc-row">
              <button className="cc-btn" disabled={game.phase !== "SETUP"} onClick={() => setPhase("REGISTRATION")}>
                Open registration
              </button>
              <button className="cc-btn cc-btn-primary" disabled={game.phase === "ACTIVE"} onClick={() => setPhase("ACTIVE")}>
                Go live
              </button>
              <button className="cc-btn" disabled={game.phase !== "ACTIVE"} onClick={() => setPhase("PAUSED")}>
                Pause game
              </button>
              <button className="cc-btn" disabled={game.phase !== "PAUSED"} onClick={() => setPhase("ACTIVE")}>
                Resume game
              </button>
              <button className="cc-btn cc-btn-danger" onClick={() => setPhase("ENDED")}>
                End game
              </button>
            </div>
            {game.phase === "REGISTRATION" && (
              <p style={{ marginTop: 12 }}>
                Share this link with players: <a href={joinUrl}>{joinUrl}</a>
              </p>
            )}
          </div>

          <div className="cc-card">
            <div className="cc-card-title">Teams (how many, and how big each one is)</div>
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Players</th>
                  <th>Capacity</th>
                </tr>
              </thead>
              <tbody>
                {game.teams.map((t) => (
                  <tr key={t.id}>
                    <td>
                      <span className="cc-team-swatch" style={{ background: t.color, display: "inline-block", width: 12, height: 12, borderRadius: "50%" }} />{" "}
                      {t.name}
                    </td>
                    <td>{t._count?.players ?? "—"}</td>
                    <td>
                      <input
                        className="cc-input"
                        style={{ marginBottom: 0, width: 80 }}
                        type="number"
                        min={1}
                        defaultValue={t.maxPlayers}
                        onBlur={(e) => updateTeamMax(t.id, Number(e.target.value))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="cc-row" style={{ marginTop: 12 }}>
              <input className="cc-input" style={{ flex: 2 }} placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
              <input className="cc-input" style={{ width: 60 }} type="color" value={teamColor} onChange={(e) => setTeamColor(e.target.value)} />
              <input
                className="cc-input"
                style={{ width: 90 }}
                type="number"
                min={1}
                value={teamMax}
                onChange={(e) => setTeamMax(Number(e.target.value))}
              />
              <button className="cc-btn cc-btn-primary" onClick={addTeam}>
                Add team
              </button>
            </div>
          </div>

          <div className="cc-card">
            <div className="cc-card-title">Roles (Spy / General / Colonel / Soldier — all editable)</div>

            {game.roles.length === 0 && (
              <button className="cc-btn cc-btn-primary" onClick={quickSetupRoles}>
                Quick setup: 2 Spies, 1 General, 2 Colonels, rest Soldiers
              </button>
            )}

            <table className="cc-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Lives</th>
                  <th>Secret?</th>
                  <th>Slots / team</th>
                </tr>
              </thead>
              <tbody>
                {game.roles.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.startingLives}</td>
                    <td>{r.isSecret ? "Yes" : "No"}</td>
                    <td>{r.slotsPerTeam === null ? "Unlimited" : r.slotsPerTeam}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="cc-row" style={{ marginTop: 12, alignItems: "center" }}>
              <input className="cc-input" style={{ flex: 2 }} placeholder="Role name" value={roleName} onChange={(e) => setRoleName(e.target.value)} />
              <input
                className="cc-input"
                style={{ width: 80 }}
                type="number"
                min={1}
                value={roleLives}
                onChange={(e) => setRoleLives(Number(e.target.value))}
                title="Starting lives"
              />
              <input
                className="cc-input"
                style={{ width: 110 }}
                type="number"
                min={0}
                placeholder="Unlimited"
                value={roleSlots}
                onChange={(e) => setRoleSlots(e.target.value)}
                title="Slots per team (blank = unlimited)"
              />
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={roleSecret} onChange={(e) => setRoleSecret(e.target.checked)} /> Secret
              </label>
              <button className="cc-btn cc-btn-primary" onClick={addRole}>
                Add role
              </button>
            </div>
          </div>

          {game.roles.length > 0 && (
            <div className="cc-card">
              <div className="cc-card-title">Elimination matrix — rows attack columns</div>
              <table className="cc-table cc-matrix-table">
                <thead>
                  <tr>
                    <th></th>
                    {game.roles.map((r) => (
                      <th key={r.id}>{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {game.roles.map((attacker) => (
                    <tr key={attacker.id}>
                      <th>{attacker.name}</th>
                      {game.roles.map((target) => {
                        const rule = rules.find((r) => r.attackerRoleId === attacker.id && r.targetRoleId === target.id);
                        const checked = rule?.canEliminate ?? false;
                        return (
                          <td key={target.id}>
                            <input
                              type="checkbox"
                              className="cc-matrix-check"
                              checked={checked}
                              onChange={() => toggleRule(attacker.id, target.id, checked)}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

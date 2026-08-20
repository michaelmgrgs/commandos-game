"use client";

import { useCallback, useEffect, useState } from "react";
import QrModal from "./QrModal";
import ScanModal from "./ScanModal";

type PlayerState = {
  id: string;
  name: string;
  callsign: string | null;
  token: string;
  livesCurrent: number;
  livesMax: number;
  status: "ACTIVE" | "ELIMINATED";
  credits: number;
  adminLock: "NONE" | "PAUSED" | "TASK_LOCKED";
  eliminationsCount: number;
  deathsCount: number;
  team: { id: string; name: string; color: string };
  role: { id: string; name: string; isSecret: boolean } | null;
};

type GameState = { id: string; name: string; phase: string };

export default function PlayerProfileClient({ token }: { token: string }) {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showScan, setShowScan] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "deny"; text: string } | null>(null);
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/player/${token}`, { cache: "no-store" });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setPlayer(data.player);
      setGame(data.game);
    } catch {
      // Silently ignore transient poll failures — next poll will retry.
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleScan(raw: string) {
    setShowScan(false);
    setScanning(true);
    try {
      const res = await fetch("/api/combat/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attackerToken: token, scannedRaw: raw }),
      });
      const data = await res.json();
      setBanner({
        kind: data.status === "SUCCESS" ? "ok" : "deny",
        text: data.message || (data.status === "SUCCESS" ? "Hit confirmed." : "ACCESS DENIED."),
      });
      load();
    } catch {
      setBanner({ kind: "deny", text: "Couldn't reach the server. Check your connection and try again." });
    } finally {
      setScanning(false);
      setTimeout(() => setBanner(null), 5000);
    }
  }

  if (notFound) {
    return (
      <div className="cc-container">
        <div className="cc-card">
          <div className="cc-card-title">Not found</div>
          <p>This link doesn't match an active player. Ask an admin to re-check your join link.</p>
        </div>
      </div>
    );
  }

  if (!player || !game) {
    return (
      <div className="cc-container">
        <p>Loading…</p>
      </div>
    );
  }

  const profileUrl = typeof window !== "undefined" ? `${window.location.origin}/p/${player.token}` : "";

  if (player.adminLock === "PAUSED") {
    return (
      <div className="cc-container">
        <div className="cc-locked-screen">
          <div className="cc-title">Paused</div>
          <p>You've been paused by the game master. Sit tight — you'll be back in shortly.</p>
        </div>
      </div>
    );
  }

  if (player.adminLock === "TASK_LOCKED") {
    return (
      <div className="cc-container">
        <div className="cc-locked-screen">
          <div className="cc-title">Task in progress</div>
          <p>Command has pulled you into a task. Complete it in the field — this screen will unlock automatically.</p>
        </div>
      </div>
    );
  }

  if (player.status === "ELIMINATED") {
    return (
      <div className="cc-container">
        <div className="cc-locked-screen">
          <div className="cc-title" style={{ color: "var(--cc-red)" }}>
            Mission Failed
          </div>
          <p>You're out of lives. Wait for an admin to revive you.</p>
        </div>
      </div>
    );
  }

  const awaitingRole = !player.role;
  const canFight = !awaitingRole && game.phase === "ACTIVE";

  return (
    <div className="cc-container">
      <div className="cc-row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="cc-title" style={{ fontSize: 20 }}>
            {player.callsign || player.name}
          </div>
          <div className="cc-subtitle">
            {player.team.name} {awaitingRole ? "· Awaiting role assignment" : `· ${player.role!.name}`}
          </div>
        </div>
        <span className={`cc-badge cc-badge-active`}>{game.phase}</span>
      </div>

      {banner && (
        <div
          className="cc-card"
          style={{ borderColor: banner.kind === "ok" ? "var(--cc-accent)" : "var(--cc-red)", marginTop: 16 }}
        >
          {banner.text}
        </div>
      )}

      <div className="cc-card" style={{ marginTop: 16, textAlign: "center" }}>
        <div className="cc-card-title">Lives</div>
        <div className="cc-profile-lives">
          {player.livesCurrent} / {player.livesMax}
        </div>
      </div>

      <div className="cc-row">
        <div className="cc-card" style={{ flex: 1, textAlign: "center" }}>
          <div className="cc-card-title">Credits</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{player.credits}</div>
        </div>
        <div className="cc-card" style={{ flex: 1, textAlign: "center" }}>
          <div className="cc-card-title">Eliminations</div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{player.eliminationsCount}</div>
        </div>
      </div>

      {awaitingRole && (
        <div className="cc-card">
          <p>Command is still assigning roles. Combat unlocks the moment you get yours.</p>
        </div>
      )}

      {!awaitingRole && game.phase !== "ACTIVE" && (
        <div className="cc-card">
          <p>Combat isn't live yet. Command will open it when the mission starts.</p>
        </div>
      )}

      <div className="cc-card">
        <div className="cc-row">
          <button
            className="cc-btn cc-btn-danger"
            style={{ flex: 1 }}
            disabled={!canFight || scanning}
            onClick={() => setShowScan(true)}
          >
            {scanning ? "Confirming…" : "SCAN TARGET"}
          </button>
          <button className="cc-btn" style={{ flex: 1 }} onClick={() => setShowQr(true)}>
            SHOW MY QR
          </button>
        </div>
      </div>

      {showQr && <QrModal url={profileUrl} onClose={() => setShowQr(false)} />}
      {showScan && <ScanModal onScan={handleScan} onClose={() => setShowScan(false)} />}
    </div>
  );
}

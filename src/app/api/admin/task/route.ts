import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// A lightweight version of the "push a task, pause the game" feature from
// the architecture doc (§3/§4) — game-wide for now: write a message, push
// it, and every active player's screen swaps to that task instead of the
// normal scan screen until you release them. Stored on Game.config so no
// schema migration is needed.
export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!gameId || !message) {
    return NextResponse.json({ error: "gameId and message are required." }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const config = (game.config as Record<string, unknown>) || {};
  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: { config: { ...config, currentTask: message, taskPushedAt: new Date().toISOString() } },
  });

  const result = await prisma.player.updateMany({
    where: { gameId, status: "ACTIVE", adminLock: { not: "PAUSED" } },
    data: { adminLock: "TASK_LOCKED" },
  });

  await prisma.auditLog.create({
    data: {
      gameId,
      actorType: "ADMIN",
      actorId: session.adminId,
      action: "TASK_PUSHED",
      newValue: { message, playersLocked: result.count },
    },
  });

  return NextResponse.json({ game: updatedGame, playersLocked: result.count });
}

// Releases everyone currently task-locked back to normal play.
export async function DELETE(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const config = (game.config as Record<string, unknown>) || {};
  const updatedGame = await prisma.game.update({
    where: { id: gameId },
    data: { config: { ...config, currentTask: null } },
  });

  const result = await prisma.player.updateMany({
    where: { gameId, adminLock: "TASK_LOCKED" },
    data: { adminLock: "NONE" },
  });

  await prisma.auditLog.create({
    data: {
      gameId,
      actorType: "ADMIN",
      actorId: session.adminId,
      action: "TASK_RELEASED",
      newValue: { playersReleased: result.count },
    },
  });

  return NextResponse.json({ game: updatedGame, playersReleased: result.count });
}

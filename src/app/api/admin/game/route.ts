import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// v1 scope (per your decision): a single active game at a time. "Current"
// means the most recently created game that isn't ENDED.
export async function GET() {
  const game = await prisma.game.findFirst({
    where: { phase: { not: "ENDED" } },
    orderBy: { createdAt: "desc" },
    include: {
      teams: { include: { _count: { select: { players: true } } } },
      roles: true,
    },
  });
  return NextResponse.json({ game });
}

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "Game name is required." }, { status: 400 });

  // Single-active-game v1: retire any other non-ended game before starting a new one.
  await prisma.game.updateMany({
    where: { phase: { not: "ENDED" } },
    data: { phase: "ENDED", endedAt: new Date() },
  });

  const game = await prisma.game.create({
    data: { name, phase: "SETUP" },
  });

  await prisma.auditLog.create({
    data: {
      gameId: game.id,
      actorType: "ADMIN",
      actorId: session.adminId,
      action: "GAME_CREATED",
      newValue: { name },
    },
  });

  return NextResponse.json({ game });
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const phase = typeof body?.phase === "string" ? body.phase : "";
  const validPhases = ["SETUP", "REGISTRATION", "ACTIVE", "PAUSED", "ENDED"];

  if (!gameId || !validPhases.includes(phase)) {
    return NextResponse.json({ error: "A valid gameId and phase are required." }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  // Safety rail from the architecture doc's edge cases: can't go live with
  // players still waiting on a role.
  if (phase === "ACTIVE") {
    const unassigned = await prisma.player.count({
      where: { gameId, roleId: null, status: "ACTIVE" },
    });
    if (unassigned > 0) {
      return NextResponse.json(
        { error: `${unassigned} player(s) still need a role assigned before you can go live.` },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.game.update({
    where: { id: gameId },
    data: {
      phase: phase as any,
      startedAt: phase === "ACTIVE" && !game.startedAt ? new Date() : game.startedAt,
      endedAt: phase === "ENDED" ? new Date() : game.endedAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      gameId,
      actorType: "ADMIN",
      actorId: session.adminId,
      action: "PHASE_CHANGED",
      oldValue: { phase: game.phase },
      newValue: { phase },
    },
  });

  return NextResponse.json({ game: updated });
}

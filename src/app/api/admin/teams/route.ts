import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const color = typeof body?.color === "string" ? body.color : "#2563eb";
  const maxPlayers = Number.isFinite(body?.maxPlayers) ? Math.max(1, Math.floor(body.maxPlayers)) : 8;

  if (!gameId || !name) {
    return NextResponse.json({ error: "gameId and name are required." }, { status: 400 });
  }

  const team = await prisma.team.create({
    data: { gameId, name, color, maxPlayers },
  });

  return NextResponse.json({ team });
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const action = typeof body?.action === "string" ? body.action : "";
  if (action === "PAUSE_TEAM" || action === "RESUME_TEAM") {
    const team = await prisma.team.findUnique({ where: { id } });
    if (!team) return NextResponse.json({ error: "Team not found." }, { status: 404 });

    // Only touches players who are unlocked (for pause) or paused (for
    // resume) — leaves anyone currently TASK_LOCKED alone so a team-wide
    // pause/resume doesn't fight with an in-progress task push.
    const result = await prisma.player.updateMany({
      where: {
        teamId: id,
        adminLock: action === "PAUSE_TEAM" ? "NONE" : "PAUSED",
      },
      data: { adminLock: action === "PAUSE_TEAM" ? "PAUSED" : "NONE" },
    });

    await prisma.auditLog.create({
      data: {
        gameId: team.gameId,
        actorType: "ADMIN",
        actorId: session.adminId,
        action: action === "PAUSE_TEAM" ? "TEAM_PAUSED" : "TEAM_RESUMED",
        targetType: "Team",
        targetId: id,
        newValue: { count: result.count },
      },
    });

    return NextResponse.json({ count: result.count });
  }

  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (typeof body?.color === "string") data.color = body.color;
  if (Number.isFinite(body?.maxPlayers)) data.maxPlayers = Math.max(1, Math.floor(body.maxPlayers));

  const team = await prisma.team.update({ where: { id }, data });
  return NextResponse.json({ team });
}

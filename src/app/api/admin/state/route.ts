import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

// One aggregate endpoint the dashboard polls every few seconds — game
// phase, every team, every player (with team/role names resolved), and
// a recent activity feed. Keeping this as a single call instead of many
// small ones is what keeps the "every few seconds" refresh cheap.
export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") || "";
  if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

  const [game, teams, players, roles, recentEvents, recentAudit] = await Promise.all([
    prisma.game.findUnique({ where: { id: gameId } }),
    prisma.team.findMany({ where: { gameId }, orderBy: { createdAt: "asc" } }),
    prisma.player.findMany({
      where: { gameId },
      include: { team: true, role: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.role.findMany({ where: { gameId }, orderBy: { rankOrder: "asc" } }),
    prisma.combatEvent.findMany({
      where: { gameId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { attacker: true, target: true },
    }),
    prisma.auditLog.findMany({
      where: { gameId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return NextResponse.json({ game, teams, players, roles, recentEvents, recentAudit });
}

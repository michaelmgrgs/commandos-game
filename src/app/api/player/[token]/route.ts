import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Polled every few seconds by the player's own profile page. Returns only
// what that player is allowed to see about themselves — never anyone
// else's secret role.
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const player = await prisma.player.findUnique({
    where: { qrToken: params.token },
    include: { team: true, role: true, game: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found." }, { status: 404 });
  }

  return NextResponse.json({
    player: {
      id: player.id,
      name: player.name,
      callsign: player.callsign,
      token: player.qrToken,
      livesCurrent: player.livesCurrent,
      livesMax: player.livesMax,
      status: player.status,
      credits: player.credits,
      adminLock: player.adminLock,
      eliminationsCount: player.eliminationsCount,
      deathsCount: player.deathsCount,
      team: { id: player.team.id, name: player.team.name, color: player.team.color },
      role: player.role ? { id: player.role.id, name: player.role.name, isSecret: player.role.isSecret } : null,
    },
    game: { id: player.game.id, name: player.game.name, phase: player.game.phase },
  });
}

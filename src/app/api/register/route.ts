import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateToken } from "@/lib/qr";

// Public self-registration: a player picks their own team. Role assignment
// happens later, from the admin dashboard (see the architecture doc's
// updated §3/§4). Team capacity is enforced here with a row lock so two
// people grabbing the last open slot at the same instant can't both get in.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const teamId = typeof body?.teamId === "string" ? body.teamId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!gameId || !teamId || !name) {
    return NextResponse.json({ error: "gameId, teamId, and name are required." }, { status: 400 });
  }
  if (name.length > 40) {
    return NextResponse.json({ error: "Name is too long." }, { status: 400 });
  }

  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });
  if (game.phase === "ENDED") {
    return NextResponse.json({ error: "This game has ended." }, { status: 400 });
  }

  try {
    const player = await prisma.$transaction(async (tx) => {
      // Row-lock the team so a simultaneous registration can't push it
      // over capacity (architecture doc edge case #9).
      await tx.$queryRawUnsafe('SELECT id FROM "Team" WHERE id = $1 FOR UPDATE', teamId);

      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team || team.gameId !== gameId) {
        throw new Error("TEAM_NOT_FOUND");
      }

      const currentCount = await tx.player.count({ where: { teamId } });
      if (currentCount >= team.maxPlayers) {
        throw new Error("TEAM_FULL");
      }

      return tx.player.create({
        data: {
          gameId,
          teamId,
          name,
          qrToken: generateToken(),
          livesCurrent: 1,
          livesMax: 1,
        },
      });
    });

    return NextResponse.json({ player: { token: player.qrToken, id: player.id } });
  } catch (err: any) {
    if (err?.message === "TEAM_FULL") {
      return NextResponse.json({ error: "That team just filled up — pick another one." }, { status: 409 });
    }
    if (err?.message === "TEAM_NOT_FOUND") {
      return NextResponse.json({ error: "That team no longer exists." }, { status: 404 });
    }
    throw err;
  }
}

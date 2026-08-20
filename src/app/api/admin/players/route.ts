import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") || "";
  if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

  const players = await prisma.player.findMany({
    where: { gameId },
    include: { team: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ players });
}

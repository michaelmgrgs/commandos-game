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

  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (typeof body?.color === "string") data.color = body.color;
  if (Number.isFinite(body?.maxPlayers)) data.maxPlayers = Math.max(1, Math.floor(body.maxPlayers));

  const team = await prisma.team.update({ where: { id }, data });
  return NextResponse.json({ team });
}

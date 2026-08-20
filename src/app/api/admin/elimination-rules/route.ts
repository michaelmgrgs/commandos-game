import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function GET(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const gameId = searchParams.get("gameId") || "";
  if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

  const [roles, rules] = await Promise.all([
    prisma.role.findMany({ where: { gameId }, orderBy: { rankOrder: "asc" } }),
    prisma.eliminationRule.findMany({ where: { gameId } }),
  ]);

  return NextResponse.json({ roles, rules });
}

// Toggles (or creates) a single cell in the elimination matrix.
export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const attackerRoleId = typeof body?.attackerRoleId === "string" ? body.attackerRoleId : "";
  const targetRoleId = typeof body?.targetRoleId === "string" ? body.targetRoleId : "";
  const canEliminate = Boolean(body?.canEliminate);

  if (!gameId || !attackerRoleId || !targetRoleId) {
    return NextResponse.json({ error: "gameId, attackerRoleId, and targetRoleId are required." }, { status: 400 });
  }

  const rule = await prisma.eliminationRule.upsert({
    where: { attackerRoleId_targetRoleId: { attackerRoleId, targetRoleId } },
    create: { gameId, attackerRoleId, targetRoleId, canEliminate },
    update: { canEliminate },
  });

  return NextResponse.json({ rule });
}

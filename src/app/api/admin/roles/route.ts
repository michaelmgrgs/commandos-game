import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const rankOrder = Number.isFinite(body?.rankOrder) ? Math.floor(body.rankOrder) : 0;
  const startingLives = Number.isFinite(body?.startingLives) ? Math.max(1, Math.floor(body.startingLives)) : 1;
  const isSecret = Boolean(body?.isSecret);
  const slotsPerTeam =
    body?.slotsPerTeam === null || body?.slotsPerTeam === undefined || body?.slotsPerTeam === ""
      ? null
      : Math.max(0, Math.floor(Number(body.slotsPerTeam)));

  if (!gameId || !name) {
    return NextResponse.json({ error: "gameId and name are required." }, { status: 400 });
  }

  const role = await prisma.role.create({
    data: { gameId, name, rankOrder, startingLives, isSecret, slotsPerTeam },
  });

  return NextResponse.json({ role });
}

/**
 * Quick setup: creates the standard 4-role lineup (2 Spies, 1 General,
 * 2 Colonels, unlimited Soldiers) plus a sensible starting elimination
 * matrix, so you don't have to click through every combination by hand.
 * Everything it creates is still fully editable afterward.
 */
export async function PUT(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const gameId = typeof body?.gameId === "string" ? body.gameId : "";
  if (!gameId) return NextResponse.json({ error: "gameId is required." }, { status: 400 });

  const existing = await prisma.role.count({ where: { gameId } });
  if (existing > 0) {
    return NextResponse.json(
      { error: "This game already has roles set up — quick setup only works on a fresh game." },
      { status: 400 }
    );
  }

  // Multiple lives per role by default, on purpose — see the architecture
  // doc: the goal is for the game to keep moving on its own without every
  // single hit requiring a trip back to the admin. You can still edit any
  // of these numbers per-role on the Setup page at any time.
  const defaults = [
    { name: "General", rankOrder: 0, startingLives: 3, isSecret: false, slotsPerTeam: 1 },
    { name: "Colonel", rankOrder: 1, startingLives: 3, isSecret: false, slotsPerTeam: 2 },
    { name: "Spy", rankOrder: 2, startingLives: 2, isSecret: true, slotsPerTeam: 2 },
    { name: "Soldier", rankOrder: 3, startingLives: 4, isSecret: false, slotsPerTeam: null },
  ];

  const roles = [];
  for (const r of defaults) {
    roles.push(await prisma.role.create({ data: { gameId, ...r } }));
  }

  const byName = Object.fromEntries(roles.map((r) => [r.name, r]));

  // A sensible starting matrix: General can't attack anyone (protected
  // command figure — see the architecture doc's edge case #1); everyone
  // else can eliminate everyone else, including their own role (Spy vs
  // Spy is intentional, not a bug). All of this is just data — change any
  // cell from the elimination matrix screen.
  const rules: { attackerRoleId: string; targetRoleId: string; canEliminate: boolean }[] = [];
  for (const attacker of roles) {
    for (const target of roles) {
      const canEliminate = attacker.name !== "General";
      rules.push({ attackerRoleId: attacker.id, targetRoleId: target.id, canEliminate });
    }
  }

  await prisma.eliminationRule.createMany({
    data: rules.map((r) => ({ gameId, ...r })),
  });

  return NextResponse.json({ roles: byName });
}

export async function PATCH(req: Request) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required." }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string") data.name = body.name.trim();
  if (Number.isFinite(body?.rankOrder)) data.rankOrder = Math.floor(body.rankOrder);
  if (Number.isFinite(body?.startingLives)) data.startingLives = Math.max(1, Math.floor(body.startingLives));
  if (typeof body?.isSecret === "boolean") data.isSecret = body.isSecret;
  if ("slotsPerTeam" in (body || {})) {
    data.slotsPerTeam =
      body.slotsPerTeam === null || body.slotsPerTeam === "" ? null : Math.max(0, Math.floor(Number(body.slotsPerTeam)));
  }

  const role = await prisma.role.update({ where: { id }, data });
  return NextResponse.json({ role });
}

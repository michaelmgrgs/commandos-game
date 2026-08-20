import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { extractTokenFromScan } from "@/lib/qr";
import { checkCombat, DENY_MESSAGES, type CombatDenyReason } from "@/lib/rules-engine";

// The combat state machine from the architecture doc §5: the loser shows
// their own QR on their own screen, the winner scans it, and — if every
// check passes — the result applies immediately in one transaction. No
// separate digital confirm/dispute step.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const attackerToken = typeof body?.attackerToken === "string" ? body.attackerToken : "";
  const scannedRaw = typeof body?.scannedRaw === "string" ? body.scannedRaw : "";

  if (!attackerToken || !scannedRaw) {
    return NextResponse.json({ error: "attackerToken and scannedRaw are required." }, { status: 400 });
  }

  const targetToken = extractTokenFromScan(scannedRaw);

  const attacker = await prisma.player.findUnique({ where: { qrToken: attackerToken } });
  if (!attacker) {
    return NextResponse.json({ error: "Attacker not found." }, { status: 404 });
  }

  const target = await prisma.player.findUnique({ where: { qrToken: targetToken } });
  if (!target || target.gameId !== attacker.gameId) {
    await prisma.combatEvent.create({
      data: {
        gameId: attacker.gameId,
        attackerId: attacker.id,
        targetId: attacker.id, // no valid target row to reference — log against self
        status: "DENIED",
        reason: "TARGET_NOT_FOUND",
      },
    });
    return NextResponse.json({ status: "DENIED", message: DENY_MESSAGES.TARGET_NOT_FOUND });
  }

  const game = await prisma.game.findUnique({ where: { id: attacker.gameId } });
  if (!game) return NextResponse.json({ error: "Game not found." }, { status: 404 });

  const rules = await prisma.eliminationRule.findMany({ where: { gameId: attacker.gameId } });

  const result = await prisma.$transaction(async (tx) => {
    // Row-lock the target so two simultaneous scans on the same victim
    // can't both succeed (architecture doc §5 / §12 edge case #8).
    await tx.$queryRawUnsafe('SELECT id FROM "Player" WHERE id = $1 FOR UPDATE', target.id);
    const freshTarget = await tx.player.findUniqueOrThrow({ where: { id: target.id } });
    const freshAttacker = await tx.player.findUniqueOrThrow({ where: { id: attacker.id } });

    const denyReason: CombatDenyReason | null = checkCombat({
      gamePhase: game.phase,
      attackerId: freshAttacker.id,
      targetId: freshTarget.id,
      attackerStatus: freshAttacker.status,
      targetStatus: freshTarget.status,
      attackerLock: freshAttacker.adminLock,
      targetLock: freshTarget.adminLock,
      attackerRoleId: freshAttacker.roleId,
      targetRoleId: freshTarget.roleId,
      rules,
    });

    if (denyReason) {
      await tx.combatEvent.create({
        data: {
          gameId: attacker.gameId,
          attackerId: freshAttacker.id,
          targetId: freshTarget.id,
          status: "DENIED",
          reason: denyReason,
        },
      });
      return { status: "DENIED" as const, message: DENY_MESSAGES[denyReason] };
    }

    const config = (game.config as Record<string, unknown>) || {};
    const creditsPerElimination = Number.isFinite(config.creditsPerElimination)
      ? Number(config.creditsPerElimination)
      : 10;
    const teamCreditsPerElimination = Number.isFinite(config.teamCreditsPerElimination)
      ? Number(config.teamCreditsPerElimination)
      : 5;

    const newLives = Math.max(0, freshTarget.livesCurrent - 1);
    const eliminated = newLives === 0;

    const updatedTarget = await tx.player.update({
      where: { id: freshTarget.id },
      data: {
        livesCurrent: newLives,
        status: eliminated ? "ELIMINATED" : "ACTIVE",
        deathsCount: { increment: eliminated ? 1 : 0 },
      },
    });

    await tx.player.update({
      where: { id: freshAttacker.id },
      data: {
        credits: { increment: creditsPerElimination },
        eliminationsCount: { increment: 1 },
      },
    });

    await tx.team.update({
      where: { id: freshAttacker.teamId },
      data: { credits: { increment: teamCreditsPerElimination }, score: { increment: 1 } },
    });

    await tx.combatEvent.create({
      data: {
        gameId: attacker.gameId,
        attackerId: freshAttacker.id,
        targetId: freshTarget.id,
        status: "SUCCESS",
      },
    });

    await tx.auditLog.create({
      data: {
        gameId: attacker.gameId,
        actorType: "PLAYER",
        actorId: freshAttacker.id,
        action: eliminated ? "ELIMINATION" : "LIFE_LOST",
        targetType: "Player",
        targetId: freshTarget.id,
        newValue: { livesCurrent: newLives, eliminated },
      },
    });

    return {
      status: "SUCCESS" as const,
      message: eliminated ? `Target eliminated!` : `Hit confirmed — target has ${newLives} life left.`,
      targetName: updatedTarget.name,
      targetLivesRemaining: newLives,
      eliminated,
    };
  });

  return NextResponse.json(result);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAdminSession } from "@/lib/auth";
import { roleSlotAvailable } from "@/lib/rules-engine";

// Every row action available on the admin dashboard's player table funnels
// through here, each one writing an audit log entry — see architecture
// doc §4 and §30.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = getAdminSession();
  if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action : "";

  const player = await prisma.player.findUnique({ where: { id: params.id } });
  if (!player) return NextResponse.json({ error: "Player not found." }, { status: 404 });

  const logAndReturn = async (data: Record<string, unknown>, auditAction: string, extra?: Record<string, unknown>) => {
    const updated = await prisma.player.update({ where: { id: player.id }, data, include: { team: true, role: true } });
    await prisma.auditLog.create({
      data: {
        gameId: player.gameId,
        actorType: "ADMIN",
        actorId: session!.adminId,
        action: auditAction,
        targetType: "Player",
        targetId: player.id,
        oldValue: extra?.oldValue as any,
        newValue: extra?.newValue as any,
      },
    });
    return NextResponse.json({ player: updated });
  };

  switch (action) {
    case "ASSIGN_ROLE": {
      const roleId = typeof body?.roleId === "string" ? body.roleId : "";
      if (!roleId) return NextResponse.json({ error: "roleId is required." }, { status: 400 });

      const role = await prisma.role.findUnique({ where: { id: roleId } });
      if (!role || role.gameId !== player.gameId) {
        return NextResponse.json({ error: "Role not found." }, { status: 404 });
      }

      const currentCountOnTeam = await prisma.player.count({
        where: { teamId: player.teamId, roleId, NOT: { id: player.id } },
      });
      if (!roleSlotAvailable(role.slotsPerTeam, currentCountOnTeam)) {
        return NextResponse.json(
          { error: `${role.name} is already full on this team (${role.slotsPerTeam} max).` },
          { status: 409 }
        );
      }

      // First-time assignment sets lives to the role's starting lives.
      // Re-assigning an already-active player preserves their current
      // lives, per the architecture doc's edge case #5 default.
      const isFirstAssignment = player.roleId === null;
      const data: Record<string, unknown> = { roleId };
      if (isFirstAssignment) {
        data.livesCurrent = role.startingLives;
        data.livesMax = role.startingLives;
      } else {
        data.livesMax = role.startingLives;
        data.livesCurrent = Math.min(player.livesCurrent, role.startingLives);
      }

      return logAndReturn(data, "ROLE_ASSIGNED", { oldValue: { roleId: player.roleId }, newValue: { roleId } });
    }

    case "ADJUST_LIFE": {
      const delta = Number.isFinite(body?.delta) ? Math.trunc(body.delta) : 0;
      if (!delta) return NextResponse.json({ error: "delta is required." }, { status: 400 });
      // Admin adjustments are never capped by the role's starting lives —
      // you're the final authority on the dashboard, so if you want to
      // hand someone extra lives beyond their role default, that always
      // works. If you push someone's current lives above their previous
      // max, we raise the max to match so their own screen shows a sane
      // "X / X" instead of something like "5 / 2".
      const newLives = Math.max(0, player.livesCurrent + delta);
      const newLivesMax = Math.max(player.livesMax, newLives);
      return logAndReturn(
        { livesCurrent: newLives, livesMax: newLivesMax, status: newLives === 0 ? "ELIMINATED" : "ACTIVE" },
        "LIFE_ADJUSTED",
        { oldValue: { livesCurrent: player.livesCurrent }, newValue: { livesCurrent: newLives } }
      );
    }

    case "ADJUST_CREDITS": {
      const delta = Number.isFinite(body?.delta) ? Math.trunc(body.delta) : 0;
      if (!delta) return NextResponse.json({ error: "delta is required." }, { status: 400 });
      const newCredits = Math.max(0, player.credits + delta);
      return logAndReturn({ credits: newCredits }, "CREDITS_ADJUSTED", {
        oldValue: { credits: player.credits },
        newValue: { credits: newCredits },
      });
    }

    case "REVIVE": {
      return logAndReturn(
        { status: "ACTIVE", livesCurrent: Math.max(1, player.livesCurrent) },
        "REVIVED",
        { oldValue: { status: player.status }, newValue: { status: "ACTIVE" } }
      );
    }

    case "FORCE_ELIMINATE": {
      return logAndReturn({ status: "ELIMINATED", livesCurrent: 0 }, "FORCE_ELIMINATED", {
        oldValue: { status: player.status },
        newValue: { status: "ELIMINATED" },
      });
    }

    case "PAUSE": {
      return logAndReturn({ adminLock: "PAUSED" }, "PAUSED", {
        oldValue: { adminLock: player.adminLock },
        newValue: { adminLock: "PAUSED" },
      });
    }

    case "RESUME": {
      return logAndReturn({ adminLock: "NONE" }, "RESUMED", {
        oldValue: { adminLock: player.adminLock },
        newValue: { adminLock: "NONE" },
      });
    }

    case "CHANGE_TEAM": {
      const teamId = typeof body?.teamId === "string" ? body.teamId : "";
      if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team || team.gameId !== player.gameId) {
        return NextResponse.json({ error: "Team not found." }, { status: 404 });
      }
      // Admin-initiated moves always go through, even onto a "full" team —
      // the capacity number only gates the public join screen.
      return logAndReturn({ teamId }, "TEAM_CHANGED", {
        oldValue: { teamId: player.teamId },
        newValue: { teamId },
      });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

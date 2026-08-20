// Pure, framework-free logic — no database, no Next.js imports. Same philosophy
// as the Carbon Camp Icebreaker plugin's engine.php: the actual rules are
// testable in isolation from everything else.

export type EliminationRuleLite = {
  attackerRoleId: string;
  targetRoleId: string;
  canEliminate: boolean;
};

/**
 * Can `attackerRoleId` eliminate `targetRoleId`, per the game's elimination
 * matrix? Defaults to false (deny) if no rule row exists for that pair —
 * an admin has to explicitly turn a matchup on.
 */
export function canEliminate(
  attackerRoleId: string,
  targetRoleId: string,
  rules: EliminationRuleLite[]
): boolean {
  const rule = rules.find(
    (r) => r.attackerRoleId === attackerRoleId && r.targetRoleId === targetRoleId
  );
  return rule ? rule.canEliminate : false;
}

/**
 * Is there still room for one more player with this role on this team?
 * `slotsPerTeam === null` means unlimited (the Soldier "everyone else" role).
 */
export function roleSlotAvailable(slotsPerTeam: number | null, currentCountOnTeam: number): boolean {
  if (slotsPerTeam === null || slotsPerTeam === undefined) return true;
  return currentCountOnTeam < slotsPerTeam;
}

export type CombatDenyReason =
  | "SELF_SCAN"
  | "GAME_NOT_ACTIVE"
  | "ATTACKER_NOT_ACTIVE"
  | "TARGET_NOT_ACTIVE"
  | "ATTACKER_LOCKED"
  | "TARGET_LOCKED"
  | "NO_ROLE_ASSIGNED"
  | "RULE_DENIED"
  | "TARGET_NOT_FOUND";

export type CombatCheckInput = {
  gamePhase: string;
  attackerId: string;
  targetId: string;
  attackerStatus: "ACTIVE" | "ELIMINATED";
  targetStatus: "ACTIVE" | "ELIMINATED";
  attackerLock: "NONE" | "PAUSED" | "TASK_LOCKED";
  targetLock: "NONE" | "PAUSED" | "TASK_LOCKED";
  attackerRoleId: string | null;
  targetRoleId: string | null;
  rules: EliminationRuleLite[];
};

/**
 * Runs the full combat validation chain from the architecture doc's combat
 * state machine (§5), in order, short-circuiting on the first failure.
 * Returns null if the scan is allowed, or a reason code if it must be denied.
 * This does NOT touch the database — the caller applies the result inside
 * a transaction with a row lock on the target.
 */
export function checkCombat(input: CombatCheckInput): CombatDenyReason | null {
  if (input.attackerId === input.targetId) return "SELF_SCAN";
  if (input.gamePhase !== "ACTIVE") return "GAME_NOT_ACTIVE";
  if (input.attackerStatus !== "ACTIVE") return "ATTACKER_NOT_ACTIVE";
  if (input.targetStatus !== "ACTIVE") return "TARGET_NOT_ACTIVE";
  if (input.attackerLock !== "NONE") return "ATTACKER_LOCKED";
  if (input.targetLock !== "NONE") return "TARGET_LOCKED";
  if (!input.attackerRoleId || !input.targetRoleId) return "NO_ROLE_ASSIGNED";
  if (!canEliminate(input.attackerRoleId, input.targetRoleId, input.rules)) return "RULE_DENIED";
  return null;
}

export const DENY_MESSAGES: Record<CombatDenyReason, string> = {
  SELF_SCAN: "You can't scan yourself.",
  GAME_NOT_ACTIVE: "ACCESS DENIED — the game isn't live right now.",
  ATTACKER_NOT_ACTIVE: "ACCESS DENIED — you're not active.",
  TARGET_NOT_ACTIVE: "ACCESS DENIED — that player is already down.",
  ATTACKER_LOCKED: "ACCESS DENIED — you're currently paused/on a task.",
  TARGET_LOCKED: "ACCESS DENIED — that player is currently paused/on a task.",
  NO_ROLE_ASSIGNED: "ACCESS DENIED — roles aren't set for one of you yet.",
  RULE_DENIED: "ACCESS DENIED.",
  TARGET_NOT_FOUND: "ACCESS DENIED — that code isn't valid for this game.",
};

/**
 * Deadline rigidity — some goals have fixed dates that Closer must not
 * “optimize away” (spring break, concert tickets). Car loans belong in
 * protected obligations, not goals.
 */

import type { Goal } from "./types";

const FIXED_NAME_RE =
  /\b(spring break|concert|ticket|deposit|tuition|rent|flight|festival)\b/i;

/**
 * True when the want-by date (and funding urgency) should stay put.
 * Explicit `timeSensitive` wins; otherwise name/category heuristics.
 */
export function isTimeSensitiveGoal(
  goal: Pick<Goal, "name" | "category" | "optionalTargetDate" | "timeSensitive">
): boolean {
  if (goal.timeSensitive === true) return true;
  if (goal.timeSensitive === false) return false;
  if (FIXED_NAME_RE.test(goal.name)) return true;
  if (
    (goal.category === "Travel" || goal.category === "Experiences") &&
    Boolean(goal.optionalTargetDate)
  ) {
    return true;
  }
  return false;
}

export function isFlexibleGoal(
  goal: Pick<Goal, "name" | "category" | "optionalTargetDate" | "timeSensitive">
): boolean {
  return !isTimeSensitiveGoal(goal);
}

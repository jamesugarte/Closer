/**
 * Demo opening state — Maya (over-goal stretch) built from blueprint so
 * wallets and balanceHistory always agree.
 */

import { buildAppStateFromBlueprint } from "./build-state-from-profile";
import { MAYA_BLUEPRINT } from "./personas";
import type { AppState } from "./types";

/** Months from freshman Aug start → sophomore year begins */
export const SOPHOMORE_START_MONTHS = 12;

/**
 * Live demo seed: Maya sophomore, car note protected, too many goals.
 */
export function createInitialState(): AppState {
  return buildAppStateFromBlueprint({
    ...MAYA_BLUEPRINT,
    useMayaSophomoreSeed: false,
  });
}

/** True when a persisted save is usable. */
export function isValidDemoProgress(state: AppState): boolean {
  const hist = state.balanceHistory?.length ?? 0;
  const year = state.user.collegeYear ?? 1;
  const months = state.monthsAdvanced ?? 0;
  const persona = state.personaId ?? "maya";

  if (persona === "maya" || persona === undefined) {
    // Sophomore open or any progressed Maya session with history
    return (
      (months >= SOPHOMORE_START_MONTHS && year >= 2 && hist >= 1) ||
      (year >= 2 && hist >= 1 && Boolean(state.user?.name))
    );
  }
  return hist >= 1 && Boolean(state.user?.name);
}

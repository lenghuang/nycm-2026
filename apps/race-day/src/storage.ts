import { planFromPreset } from './configs';
import { initialRace } from './plan';
import type { ActivePlan, RaceState } from './types';

const planKey = 'nyc-race-day-plan-v5';
const stateKey = 'nyc-race-day-state-v5';

export function loadPlan(): ActivePlan {
  try { const value: unknown = JSON.parse(localStorage.getItem(planKey) ?? 'null'); return value && typeof value === 'object' && Array.isArray((value as ActivePlan).phases) ? value as ActivePlan : planFromPreset(); }
  catch { return planFromPreset(); }
}
export function loadRace(): RaceState {
  try { const value: unknown = JSON.parse(localStorage.getItem(stateKey) ?? 'null'); return value && typeof value === 'object' ? value as RaceState : initialRace(); }
  catch { return initialRace(); }
}
export const savePlan = (plan: ActivePlan): void => localStorage.setItem(planKey, JSON.stringify(plan));
export const saveRace = (race: RaceState): void => localStorage.setItem(stateKey, JSON.stringify(race));

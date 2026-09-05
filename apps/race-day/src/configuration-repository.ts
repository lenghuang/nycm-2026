import { configurationFromPreset, defaultRunnerPreferences } from './configs';
import { loadPlan, loadRace, savePlan, saveRace } from './storage';
import { initialRaceSession } from './race-session';
import type { RaceConfiguration, RaceSession, RunnerPreferences } from './types';

const preferencesKey = 'nyc-race-day-preferences-v1';
const sessionKey = 'nyc-race-day-session-v1';

export function loadRaceConfiguration(): RaceConfiguration {
  const legacyPlan = loadPlan();
  const fallback = configurationFromPreset(legacyPlan.presetId);
  return {
    plan: { presetId: legacyPlan.presetId, phases: legacyPlan.phases },
    preferences: loadRunnerPreferences({ ...fallback.preferences, ...legacyPlan }),
  };
}

export function saveRaceConfiguration(configuration: RaceConfiguration): void {
  savePlan({ ...configuration.plan, ...configuration.preferences });
}

export function loadRunnerPreferences(fallback = defaultRunnerPreferences()): RunnerPreferences {
  try {
    const value = JSON.parse(localStorage.getItem(preferencesKey) ?? 'null') as Partial<RunnerPreferences> | null;
    if (!value || typeof value !== 'object') return fallback;
    return {
      notificationSounds: { ...fallback.notificationSounds, ...value.notificationSounds },
      notificationSoundVolumes: { ...fallback.notificationSoundVolumes, ...value.notificationSoundVolumes },
      musicVolume:
        typeof value.musicVolume === 'number' ? Math.max(0, Math.min(1, value.musicVolume)) : fallback.musicVolume,
      viewMode: value.viewMode === 'full' ? 'full' : 'simple',
    };
  } catch {
    return fallback;
  }
}

export function saveRunnerPreferences(preferences: RunnerPreferences): void {
  try {
    localStorage.setItem(preferencesKey, JSON.stringify(preferences));
  } catch {
    /* Storage may be unavailable or full. */
  }
}

export function loadRaceSession(): RaceSession {
  try {
    const value = JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Partial<RaceSession> | null;
    if (value && typeof value === 'object' && typeof value.gelScheduleAnchorElapsedMs === 'number')
      return { ...initialRaceSession(), ...value, addedCyclesByPhase: value.addedCyclesByPhase ?? {} };
  } catch {
    /* Fall through to migration. */
  }
  const legacy = loadRace();
  return {
    ...initialRaceSession(legacy.anchor),
    phase: legacy.phase,
    anchor: legacy.anchor,
    pausedAt: legacy.pausedAt,
    pausedTotal: legacy.pausedTotal,
    gelScheduleAnchorElapsedMs: legacy.gelAnchor,
    lastDeliveredGelNumber: legacy.gelFired,
    begun: legacy.begun,
    lastInterval: legacy.lastInterval,
  };
}

export function saveRaceSession(session: RaceSession): void {
  try {
    localStorage.setItem(sessionKey, JSON.stringify(session));
  } catch {
    /* Storage may be unavailable or full. */
  }
  // Keep the last session readable by pre-refactor builds during development.
  saveRace({ ...session, gelAnchor: session.gelScheduleAnchorElapsedMs, gelFired: session.lastDeliveredGelNumber });
}

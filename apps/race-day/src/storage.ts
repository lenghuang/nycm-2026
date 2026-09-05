import { planFromPreset } from './configs';
import { defaultMusicTrackId, defaultNotificationSounds, defaultNotificationSoundVolumes } from './audio-library';
import { initialRace } from './plan';
import type { ActivePlan, RaceState } from './types';
import type { ViewMode } from './types';

const planKey = 'nyc-race-day-plan-v5';
const stateKey = 'nyc-race-day-state-v5';
const viewModeKey = 'nyc-race-day-view-mode-v1';
const musicPositionsKey = 'nyc-race-day-music-positions-v1';

export function loadPlan(): ActivePlan {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(planKey) ?? 'null');
    if (!value || typeof value !== 'object' || !Array.isArray((value as ActivePlan).phases)) return planFromPreset();
    const plan = value as ActivePlan;
    const savedSounds = plan.notificationSounds ?? defaultNotificationSounds;
    const savedVolumes = plan.notificationSoundVolumes ?? defaultNotificationSoundVolumes;
    return {
      ...plan,
      notificationSounds: {
        run: typeof savedSounds.run === 'string' ? savedSounds.run : defaultNotificationSounds.run,
        walk: typeof savedSounds.walk === 'string' ? savedSounds.walk : defaultNotificationSounds.walk,
        gel: typeof savedSounds.gel === 'string' ? savedSounds.gel : defaultNotificationSounds.gel,
      },
      notificationSoundVolumes: {
        run: isNotificationSoundVolume(savedVolumes.run) ? savedVolumes.run : defaultNotificationSoundVolumes.run,
        walk: isNotificationSoundVolume(savedVolumes.walk) ? savedVolumes.walk : defaultNotificationSoundVolumes.walk,
        gel: isNotificationSoundVolume(savedVolumes.gel) ? savedVolumes.gel : defaultNotificationSoundVolumes.gel,
      },
      musicVolume: typeof plan.musicVolume === 'number' ? Math.max(0, Math.min(1, plan.musicVolume)) : 0.78,
      phases: plan.phases.map(phase => ({ ...phase, musicTrackId: typeof phase.musicTrackId === 'string' ? phase.musicTrackId : defaultMusicTrackId })),
    };
  }
  catch { return planFromPreset(); }
}
const isNotificationSoundVolume = (value: unknown): value is 'quiet' | 'normal' | 'loud' => value === 'quiet' || value === 'normal' || value === 'loud';
export function loadRace(): RaceState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(stateKey) ?? 'null');
    if (!value || typeof value !== 'object') return initialRace();
    const race = value as RaceState;
    return { ...race, gelAnchor: typeof race.gelAnchor === 'number' ? race.gelAnchor : 0 };
  }
  catch { return initialRace(); }
}
export const savePlan = (plan: ActivePlan): void => localStorage.setItem(planKey, JSON.stringify(plan));
export const saveRace = (race: RaceState): void => localStorage.setItem(stateKey, JSON.stringify(race));
export const loadViewMode = (): ViewMode => localStorage.getItem(viewModeKey) === 'full' ? 'full' : 'simple';
export const saveViewMode = (viewMode: ViewMode): void => localStorage.setItem(viewModeKey, viewMode);
export function loadMusicPositions(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(musicPositionsKey) ?? '{}');
    if (!value || typeof value !== 'object') return {};
    return Object.fromEntries(Object.entries(value).filter(([, position]) => typeof position === 'number' && Number.isFinite(position) && position >= 0));
  }
  catch { return {}; }
}
export const saveMusicPositions = (positions: Record<string, number>): void => localStorage.setItem(musicPositionsKey, JSON.stringify(positions));

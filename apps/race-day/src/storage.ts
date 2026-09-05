import { z } from 'zod';
import { planFromPreset } from './configs';
import { defaultMusicTrackId, defaultNotificationSounds, defaultNotificationSoundVolumes } from './audio-library';
import { initialRace } from './plan';
import type { ActivePlan, RaceState, ViewMode } from './types';

const planKey = 'nyc-race-day-plan-v5';
const stateKey = 'nyc-race-day-state-v5';
const viewModeKey = 'nyc-race-day-view-mode-v1';
const musicPositionsKey = 'nyc-race-day-music-positions-v1';

const phaseSchema = z.object({
  name: z.string(),
  miles: z.string(),
  note: z.string(),
  runDurationMs: z.number().finite().positive(),
  walkDurationMs: z.number().finite().positive(),
  gelIntervalMs: z.number().finite().positive(),
  plannedCycles: z.number().finite().int().positive(),
  startsWith: z.enum(['RUN', 'WALK']),
  effort: z.enum(['RECOVERY', 'CONTROLLED', 'SURGE', 'FINISH', 'TEST']),
  music: z.enum(['NONE', 'START']),
  musicTrackId: z.string().optional(),
});
const savedPlanSchema = z.object({
  presetId: z.string(),
  phases: z.array(phaseSchema).min(1),
  notificationSounds: z.object({ run: z.string().optional(), walk: z.string().optional(), gel: z.string().optional() }).optional(),
  notificationSoundVolumes: z.object({ run: z.enum(['quiet', 'normal', 'loud']).optional(), walk: z.enum(['quiet', 'normal', 'loud']).optional(), gel: z.enum(['quiet', 'normal', 'loud']).optional() }).optional(),
  musicVolume: z.number().finite().optional(),
});
const savedRaceSchema = z.object({
  phase: z.number().finite().int().nonnegative(),
  anchor: z.number().finite(),
  pausedAt: z.number().finite().nullable(),
  pausedTotal: z.number().finite().nonnegative(),
  gelAnchor: z.number().finite().nonnegative().default(0),
  gelFired: z.number().finite().int().nonnegative(),
  begun: z.boolean(),
  lastInterval: z.string().optional(),
});
const musicPositionsSchema = z.record(z.string(), z.number().finite().nonnegative());

export function loadPlan(): ActivePlan {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(planKey) ?? 'null');
    const result = savedPlanSchema.safeParse(value);
    if (!result.success) return planFromPreset();
    const plan = result.data;
    const savedSounds = plan.notificationSounds;
    const savedVolumes = plan.notificationSoundVolumes;
    return {
      ...plan,
      notificationSounds: {
        run: savedSounds?.run ?? defaultNotificationSounds.run,
        walk: savedSounds?.walk ?? defaultNotificationSounds.walk,
        gel: savedSounds?.gel ?? defaultNotificationSounds.gel,
      },
      notificationSoundVolumes: {
        run: savedVolumes?.run ?? defaultNotificationSoundVolumes.run,
        walk: savedVolumes?.walk ?? defaultNotificationSoundVolumes.walk,
        gel: savedVolumes?.gel ?? defaultNotificationSoundVolumes.gel,
      },
      musicVolume: Math.max(0, Math.min(1, plan.musicVolume ?? 0.78)),
      phases: plan.phases.map(phase => ({ ...phase, musicTrackId: phase.musicTrackId ?? defaultMusicTrackId })),
    };
  }
  catch { return planFromPreset(); }
}
export function loadRace(): RaceState {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(stateKey) ?? 'null');
    const result = savedRaceSchema.safeParse(value);
    return result.success ? result.data : initialRace();
  }
  catch { return initialRace(); }
}
const persist = (key: string, value: unknown): void => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable or full. */ } };
export const savePlan = (plan: ActivePlan): void => persist(planKey, plan);
export const saveRace = (race: RaceState): void => persist(stateKey, race);
export const loadViewMode = (): ViewMode => z.enum(['simple', 'full']).catch('simple').parse(localStorage.getItem(viewModeKey));
export const saveViewMode = (viewMode: ViewMode): void => persist(viewModeKey, viewMode);
export function loadMusicPositions(): Record<string, number> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(musicPositionsKey) ?? '{}');
    const result = musicPositionsSchema.safeParse(value);
    return result.success ? result.data : {};
  }
  catch { return {}; }
}
export const saveMusicPositions = (positions: Record<string, number>): void => persist(musicPositionsKey, positions);

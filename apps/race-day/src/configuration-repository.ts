import { z } from 'zod';
import { defaultMusicTrackId, defaultNotificationSounds, defaultNotificationSoundVolumes } from './audio-library';
import { configurationFromPreset, defaultRunnerPreferences } from './configs';
import { initialRaceSession } from './race-session';
import type { RaceConfiguration, RaceSession } from './types';

const dataKey = 'nyc-race-day-data-v2';
const legacyKeys = [
  'nyc-race-day-plan-v5',
  'nyc-race-day-state-v5',
  'nyc-race-day-preferences-v1',
  'nyc-race-day-session-v1',
];

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
  music: z.enum(['SILENT', 'START_TRACK', 'CONTINUE_TRACK', 'STOP_TRACK', 'NONE', 'START']),
  musicTrackId: z.string().optional(),
  cueOverrides: z
    .partialRecord(
      z.enum(['run', 'walk', 'gel']),
      z.object({ soundId: z.string(), volume: z.enum(['quiet', 'normal', 'loud']) }),
    )
    .optional(),
});
const preferencesSchema = z.object({
  notificationSounds: z.object({ run: z.string(), walk: z.string(), gel: z.string() }),
  notificationSoundVolumes: z.object({
    run: z.enum(['quiet', 'normal', 'loud']),
    walk: z.enum(['quiet', 'normal', 'loud']),
    gel: z.enum(['quiet', 'normal', 'loud']),
  }),
  musicVolume: z.number().finite(),
  viewMode: z.enum(['simple', 'full']),
});
const sessionSchema = z.object({
  phase: z.number().finite().int().nonnegative(),
  anchor: z.number().finite(),
  pausedAt: z.number().finite().nullable(),
  pausedTotal: z.number().finite().nonnegative(),
  gelScheduleAnchorElapsedMs: z.number().finite().nonnegative(),
  lastDeliveredGelNumber: z.number().finite().int().nonnegative(),
  begun: z.boolean(),
  finishedAt: z.number().finite().nullable().optional(),
  lastInterval: z.string().optional(),
  addedCyclesByPhase: z.record(z.string(), z.number().finite().int().nonnegative()).optional(),
});
const recordSchema = z.object({
  version: z.literal(2),
  configuration: z.object({
    plan: z.object({ presetId: z.string(), phases: z.array(phaseSchema).min(1) }),
    preferences: preferencesSchema,
  }),
  session: sessionSchema,
});
type StoredRecord = { version: 2; configuration: RaceConfiguration; session: RaceSession };
let cached: StoredRecord | null = null;

/** Reads only v2 after a one-time import, then deletes all earlier shapes. */
function loadRecord(): StoredRecord {
  if (cached) return cached;
  const current = parse(recordSchema as unknown as z.ZodType<StoredRecord>, localStorage.getItem(dataKey));
  if (current) return (cached = normalize(current));
  cached = migrateLegacy();
  persist(cached);
  removeLegacyKeys();
  return cached;
}
export const loadRaceConfiguration = (): RaceConfiguration => loadRecord().configuration;
export const loadRaceSession = (): RaceSession => loadRecord().session;
export function saveRaceConfiguration(configuration: RaceConfiguration): void {
  cached = { ...loadRecord(), configuration: normalizeConfiguration(configuration) };
  persist(cached);
}
export function saveRaceSession(session: RaceSession): void {
  cached = { ...loadRecord(), session: normalizeSession(session) };
  persist(cached);
}

function migrateLegacy(): StoredRecord {
  const fallback = configurationFromPreset();
  const oldPlan = parse(
    z.object({
      presetId: z.string(),
      phases: z.array(phaseSchema).min(1),
      notificationSounds: z.any().optional(),
      notificationSoundVolumes: z.any().optional(),
      musicVolume: z.number().optional(),
    }),
    localStorage.getItem(legacyKeys[0]),
  );
  const oldPreferences = parse(z.record(z.string(), z.unknown()), localStorage.getItem(legacyKeys[2]));
  const configuration = normalizeConfiguration({
    plan: oldPlan
      ? { presetId: oldPlan.presetId, phases: oldPlan.phases as RaceConfiguration['plan']['phases'] }
      : fallback.plan,
    preferences: { ...fallback.preferences, ...(oldPlan ?? {}), ...(oldPreferences ?? {}) },
  });
  const currentSession = parse(sessionSchema as unknown as z.ZodType<RaceSession>, localStorage.getItem(legacyKeys[3]));
  const oldRace = parse(
    z.object({
      phase: z.number(),
      anchor: z.number(),
      pausedAt: z.number().nullable(),
      pausedTotal: z.number(),
      gelAnchor: z.number().default(0),
      gelFired: z.number().default(0),
      begun: z.boolean(),
      lastInterval: z.string().optional(),
    }),
    localStorage.getItem(legacyKeys[1]),
  );
  const session = normalizeSession(
    currentSession ??
      (oldRace
        ? {
            ...initialRaceSession(oldRace.anchor),
            ...oldRace,
            gelScheduleAnchorElapsedMs: oldRace.gelAnchor,
            lastDeliveredGelNumber: oldRace.gelFired,
          }
        : initialRaceSession()),
  );
  return { version: 2, configuration, session };
}
function normalize(record: StoredRecord): StoredRecord {
  return {
    ...record,
    configuration: normalizeConfiguration(record.configuration),
    session: normalizeSession(record.session),
  };
}
function normalizeConfiguration(configuration: RaceConfiguration): RaceConfiguration {
  const fallback = defaultRunnerPreferences();
  return {
    plan: {
      ...configuration.plan,
      phases: configuration.plan.phases.map((phase) => {
        const legacyMusic = phase.music as string;
        return {
          ...phase,
          music: legacyMusic === 'START' ? 'START_TRACK' : legacyMusic === 'NONE' ? 'CONTINUE_TRACK' : phase.music,
          musicTrackId: phase.musicTrackId || defaultMusicTrackId,
        };
      }),
    },
    preferences: {
      notificationSounds: {
        ...defaultNotificationSounds,
        ...fallback.notificationSounds,
        ...configuration.preferences.notificationSounds,
      },
      notificationSoundVolumes: {
        ...defaultNotificationSoundVolumes,
        ...fallback.notificationSoundVolumes,
        ...configuration.preferences.notificationSoundVolumes,
      },
      musicVolume: Math.max(0, Math.min(1, configuration.preferences.musicVolume)),
      viewMode: configuration.preferences.viewMode === 'full' ? 'full' : 'simple',
    },
  };
}
function normalizeSession(session: RaceSession): RaceSession {
  return {
    ...initialRaceSession(session.anchor),
    ...session,
    finishedAt: session.finishedAt ?? null,
    addedCyclesByPhase: session.addedCyclesByPhase ?? {},
  };
}
function parse<T>(schema: z.ZodType<T>, raw: string | null): T | null {
  try {
    const result = schema.safeParse(JSON.parse(raw ?? 'null'));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
function persist(value: StoredRecord): void {
  try {
    localStorage.setItem(dataKey, JSON.stringify(value));
  } catch {
    /* unavailable/full */
  }
}
function removeLegacyKeys(): void {
  try {
    legacyKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    /* unavailable */
  }
}

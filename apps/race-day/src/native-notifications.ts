import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { elapsed } from './plan';
import { notificationSoundSource } from './audio-library';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { NotificationSoundSettings, NotificationSoundVolumes, Phase, RaceState } from './types';

const testNotificationId = 9_001;
const raceNotificationIdStart = 10_000;
const maximumRaceNotifications = 60;

// Native iOS keeps a finite number of pending local notifications. Sixty leaves
// room for other app notifications while covering every planned boundary in the
// supplied race configurations.
const raceNotificationIds = Array.from(
  { length: maximumRaceNotifications },
  (_, index) => raceNotificationIdStart + index,
);

let synchronization = Promise.resolve();

export const isNativeNotificationPlatform = (): boolean => Capacitor.isNativePlatform();

export async function requestNativeReminderPermission(): Promise<boolean> {
  if (!isNativeNotificationPlatform()) return false;
  const permission = await LocalNotifications.requestPermissions();
  return permission.display === 'granted';
}

/**
 * Replaces this app's pending race reminders with cues for the active phase.
 * The React timer remains the timing source; iOS owns delivery while locked.
 */
export function synchronizeNativeRaceNotifications(plan: Phase[], race: RaceState, sounds: NotificationSoundSettings, volumes: NotificationSoundVolumes): Promise<void> {
  synchronization = synchronization
    .catch(() => undefined)
    .then(() => synchronizeNativeRaceNotificationsNow(plan, race, sounds, volumes));
  return synchronization;
}

async function synchronizeNativeRaceNotificationsNow(plan: Phase[], race: RaceState, sounds: NotificationSoundSettings, volumes: NotificationSoundVolumes): Promise<void> {
  if (!isNativeNotificationPlatform()) return;

  // Cancel by this app's fixed ID range rather than touching unrelated local
  // notifications. The test ID clears a leftover cue from earlier builds too.
  await LocalNotifications.cancel({
    notifications: [
      { id: testNotificationId },
      ...raceNotificationIds.map(id => ({ id })),
    ],
  });

  if (!race.begun || race.pausedAt || !plan[race.phase]) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return;

  const notifications = futurePhaseNotifications(plan[race.phase], race, sounds, volumes, Date.now());
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

function futurePhaseNotifications(phase: Phase, race: RaceState, sounds: NotificationSoundSettings, volumes: NotificationSoundVolumes, now: number): LocalNotificationSchema[] {
  const runMs = Math.max(1_000, phase.runDurationMs);
  const walkMs = Math.max(1_000, phase.walkDurationMs);
  const cycleMs = runMs + walkMs;
  const plannedCycles = Math.max(1, Math.floor(phase.plannedCycles));
  const phaseEndsAt = plannedCycles * cycleMs;
  const phaseElapsed = elapsed(race, now);
  const cues: ScheduledCue[] = [];

  const add = (title: string, body: string, atPhaseElapsed: number, type: ScheduledCue['type'], soundId: string, soundVolume: ScheduledCue['soundVolume']) => {
    if (atPhaseElapsed <= phaseElapsed || cues.length >= maximumRaceNotifications) return;
    cues.push({ title, body, atPhaseElapsed, type, soundId, soundVolume });
  };

  const startsWithWalk = phase.startsWith === 'WALK';
  let boundary = Math.floor(phaseElapsed / cycleMs) * cycleMs + (startsWithWalk ? walkMs : runMs);
  if (boundary <= phaseElapsed) boundary += cycleMs;

  while (boundary <= phaseEndsAt && cues.length < maximumRaceNotifications) {
    const mode = intervalModeAt(phase, boundary, runMs, walkMs);
    add(`${mode} now`, `${phase.name} · switch to ${mode.toLowerCase()}.`, boundary, 'interval', mode === 'RUN' ? sounds.run : sounds.walk, mode === 'RUN' ? volumes.run : volumes.walk);
    boundary += mode === 'RUN' ? runMs : walkMs;
  }

  const gelEveryMs = Math.max(1_000, phase.gelIntervalMs);
  const gelAnchor = Math.max(0, race.gelAnchor);
  let gelAt = gelAnchor + (Math.floor(Math.max(0, phaseElapsed - gelAnchor) / gelEveryMs) + 1) * gelEveryMs;
  while (gelAt <= phaseEndsAt && cues.length < maximumRaceNotifications) {
    add('Gel time', `${phase.name} · take your next gel when you can.`, gelAt, 'gel', sounds.gel, volumes.gel);
    gelAt += gelEveryMs;
  }

  const groupedCues = new Map<number, ScheduledCue[]>();
  for (const cue of cues) groupedCues.set(cue.atPhaseElapsed, [...(groupedCues.get(cue.atPhaseElapsed) ?? []), cue]);

  return [...groupedCues.entries()]
    .sort(([left], [right]) => left - right)
    .slice(0, maximumRaceNotifications)
    .map(([atPhaseElapsed, cuesAtTime], index) => {
      const intervalCue = cuesAtTime.find(cue => cue.type === 'interval');
      const gelCue = cuesAtTime.find(cue => cue.type === 'gel');
      return {
        id: raceNotificationIdStart + index,
        title: intervalCue && gelCue ? `${intervalCue.title} · Gel time` : cuesAtTime[0].title,
        body: intervalCue && gelCue ? `${intervalCue.body} Take your next gel when you can.` : cuesAtTime[0].body,
        schedule: { at: new Date(now + atPhaseElapsed - phaseElapsed) },
        sound: notificationSoundSource((gelCue ?? intervalCue ?? cuesAtTime[0]).soundId, (gelCue ?? intervalCue ?? cuesAtTime[0]).soundVolume),
        extra: { raceDay: true, types: cuesAtTime.map(cue => cue.type) },
      };
    });
}

type ScheduledCue = {
  title: string;
  body: string;
  atPhaseElapsed: number;
  type: 'interval' | 'gel';
  soundId: string;
  soundVolume: NotificationSoundVolumes[keyof NotificationSoundVolumes];
};

function intervalModeAt(phase: Phase, atPhaseElapsed: number, runMs: number, walkMs: number): 'RUN' | 'WALK' {
  const inCycle = atPhaseElapsed % (runMs + walkMs);
  const running = phase.startsWith === 'WALK' ? inCycle >= walkMs : inCycle < runMs;
  return running ? 'RUN' : 'WALK';
}

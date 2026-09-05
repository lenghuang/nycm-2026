import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { futureCueEvents } from './race-projection';
import { notificationSoundSource } from './audio-library';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import type { NotificationSoundSettings, NotificationSoundVolumes, RacePlan, RaceSession } from './types';

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
export function synchronizeNativeRaceNotifications(plan: RacePlan, race: RaceSession, sounds: NotificationSoundSettings, volumes: NotificationSoundVolumes): Promise<void> {
  synchronization = synchronization
    .catch(() => undefined)
    .then(() => synchronizeNativeRaceNotificationsNow(plan, race, sounds, volumes));
  return synchronization;
}

async function synchronizeNativeRaceNotificationsNow(plan: RacePlan, race: RaceSession, sounds: NotificationSoundSettings, volumes: NotificationSoundVolumes): Promise<void> {
  if (!isNativeNotificationPlatform()) return;

  // Cancel by this app's fixed ID range rather than touching unrelated local
  // notifications. The test ID clears a leftover cue from earlier builds too.
  await LocalNotifications.cancel({
    notifications: [
      { id: testNotificationId },
      ...raceNotificationIds.map(id => ({ id })),
    ],
  });

  if (!race.begun || race.pausedAt || !plan.phases[race.phase]) return;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== 'granted') return;

  const notifications = futurePhaseNotifications(plan, race, sounds, volumes, Date.now());
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

function futurePhaseNotifications(plan: RacePlan, race: RaceSession, sounds: NotificationSoundSettings, volumes: NotificationSoundVolumes, now: number): LocalNotificationSchema[] {
  const phase = plan.phases[race.phase];
  const phaseElapsed = Math.max(0, now - race.anchor - race.pausedTotal);
  const cues = futureCueEvents(plan, race, now).slice(0, maximumRaceNotifications).map(event => ({
    type: event.type,
    atPhaseElapsed: event.atPhaseElapsed,
    title: event.type === 'gel' ? 'Gel time' : `${event.mode} now`,
    body: event.type === 'gel' ? `${phase.name} · take your next gel when you can.` : `${phase.name} · switch to ${event.mode?.toLowerCase()}.`,
    soundId: event.type === 'gel' ? sounds.gel : event.mode === 'RUN' ? sounds.run : sounds.walk,
    soundVolume: event.type === 'gel' ? volumes.gel : event.mode === 'RUN' ? volumes.run : volumes.walk,
  }));

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

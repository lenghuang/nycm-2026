import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

const testNotificationId = 9_001;

export async function scheduleLockedScreenTest(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return 'Install the iPhone build to run this test.';

  const permission = await LocalNotifications.requestPermissions();
  if (permission.display !== 'granted') return 'Notifications are not allowed. Enable them in iPhone Settings, then try again.';

  await LocalNotifications.cancel({ notifications: [{ id: testNotificationId }] });
  await LocalNotifications.schedule({
    notifications: [{
      id: testNotificationId,
      title: 'Race Day test',
      body: 'Locked-screen local notification delivered.',
      schedule: { at: new Date(Date.now() + 10_000) },
    }],
  });
  return 'Lock your iPhone now — the local notification fires in 10 seconds.';
}

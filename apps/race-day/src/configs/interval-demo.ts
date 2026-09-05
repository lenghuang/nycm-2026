import type { RacePlanPreset } from '../types';

const seconds = (value: number): number => value * 1_000;

export const intervalDemo: RacePlanPreset = {
  id: '10s-5s-demo',
  label: '10 sec / 5 sec demo',
  description: 'Fast interval loop for checking cues, pause, and resume.',
  isTest: true,
  phases: [
    {
      name: '⚡ Interval demo',
      miles: 'TEST CONFIG',
      note: 'Ten seconds RUN, five seconds WALK. Gel reminder every 30 seconds.',
      runDurationMs: seconds(10),
      walkDurationMs: seconds(5),
      gelIntervalMs: seconds(30),
      plannedCycles: 6,
      startsWith: 'RUN',
      effort: 'TEST',
      music: 'NONE',
    },
  ],
};

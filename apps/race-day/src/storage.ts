import { z } from 'zod';

const musicPositionsKey = 'nyc-race-day-music-positions-v1';
const schema = z.record(z.string(), z.number().finite().nonnegative());
export function loadMusicPositions(): Record<string, number> {
  try {
    const result = schema.safeParse(JSON.parse(localStorage.getItem(musicPositionsKey) ?? '{}'));
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}
export function saveMusicPositions(positions: Record<string, number>): void {
  try {
    localStorage.setItem(musicPositionsKey, JSON.stringify(positions));
  } catch {
    /* unavailable/full */
  }
}

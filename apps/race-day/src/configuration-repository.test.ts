import { afterEach, describe, expect, it, vi } from 'vitest';
import { configurationFromPreset } from './configs';

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });

afterEach(() => {
  storage.values.clear();
  vi.resetModules();
});

describe('configuration repository migration', () => {
  it('imports a legacy record once, upgrades audio policy, and removes old keys', async () => {
    const legacy = configurationFromPreset();
    storage.setItem('nyc-race-day-plan-v5', JSON.stringify({ ...legacy.plan, musicVolume: 0.4 }));
    storage.setItem(
      'nyc-race-day-state-v5',
      JSON.stringify({ phase: 1, anchor: 10, pausedAt: null, pausedTotal: 0, gelAnchor: 0, gelFired: 0, begun: true }),
    );
    const repository = await import('./configuration-repository');
    const configuration = repository.loadRaceConfiguration();
    expect(configuration.preferences.musicVolume).toBe(0.4);
    expect(configuration.plan.phases[0].music).toBe('SILENT');
    expect(repository.loadRaceSession()).toMatchObject({ phase: 1, begun: true, finishedAt: null });
    expect(storage.getItem('nyc-race-day-data-v2')).not.toBeNull();
    expect(storage.getItem('nyc-race-day-plan-v5')).toBeNull();
    expect(storage.getItem('nyc-race-day-state-v5')).toBeNull();
  });

  it('replaces configuration in the v2 record without a legacy side write', async () => {
    const repository = await import('./configuration-repository');
    const next = configurationFromPreset('10s-5s-demo');
    repository.saveRaceConfiguration(next);
    expect(repository.loadRaceConfiguration().plan.presetId).toBe('10s-5s-demo');
    expect(storage.getItem('nyc-race-day-plan-v5')).toBeNull();
    expect(storage.getItem('nyc-race-day-preferences-v1')).toBeNull();
  });
});

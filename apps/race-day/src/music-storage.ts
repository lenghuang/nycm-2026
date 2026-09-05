import { openDB, type DBSchema } from 'idb';
import type { MusicTrack } from './audio-library';

type StoredMusicTrack = { id: string; name: string; file: Blob };

const databaseName = 'nyc-race-day-music';
const storeName = 'tracks';

interface MusicDatabase extends DBSchema {
  tracks: {
    key: string;
    value: StoredMusicTrack;
  };
}

export async function loadImportedMusicTracks(): Promise<MusicTrack[]> {
  if (!('indexedDB' in window)) return [];
  const database = await openMusicDatabase();
  const records = await database.getAll(storeName);
  return records
    .filter((record) => record.file instanceof Blob)
    .map((record) => ({ id: record.id, label: record.name, source: URL.createObjectURL(record.file) }));
}

export async function importMusicTrack(file: File): Promise<MusicTrack> {
  const id = crypto.randomUUID?.() ?? `track-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const record: StoredMusicTrack = { id, name: file.name.replace(/\.[^.]+$/, '') || 'Untitled track', file };
  const database = await openMusicDatabase();
  await database.put(storeName, record);
  return { id, label: record.name, source: URL.createObjectURL(file) };
}

const openMusicDatabase = () =>
  openDB<MusicDatabase>(databaseName, 1, {
    upgrade(database) {
      database.createObjectStore(storeName, { keyPath: 'id' });
    },
  });

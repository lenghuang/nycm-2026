import type { MusicTrack } from './audio-library';

type StoredMusicTrack = { id: string; name: string; file: Blob };

const databaseName = 'nyc-race-day-music';
const storeName = 'tracks';

export async function loadImportedMusicTracks(): Promise<MusicTrack[]> {
  if (!('indexedDB' in window)) return [];
  const database = await openMusicDatabase();
  const transaction = database.transaction(storeName, 'readonly');
  const records = await requestResult<StoredMusicTrack[]>(transaction.objectStore(storeName).getAll());
  return records
    .filter(record => record.file instanceof Blob)
    .map(record => ({ id: record.id, label: record.name, source: URL.createObjectURL(record.file) }));
}

export async function importMusicTrack(file: File): Promise<MusicTrack> {
  const id = crypto.randomUUID();
  const record: StoredMusicTrack = { id, name: file.name.replace(/\.[^.]+$/, '') || 'Untitled track', file };
  const database = await openMusicDatabase();
  const transaction = database.transaction(storeName, 'readwrite');
  transaction.objectStore(storeName).put(record);
  await transactionComplete(transaction);
  return { id, label: record.name, source: URL.createObjectURL(file) };
}

function openMusicDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function requestResult<Result>(request: IDBRequest<Result>): Promise<Result> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

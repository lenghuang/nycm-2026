import { useCallback, useEffect, useRef, useState } from 'react';
import { defaultMusicTrackId, musicTrackFor } from './audio-library';
import { loadMusicPositions, saveMusicPositions } from './storage';
import type { MusicTrack } from './audio-library';
import { MUSIC_POSITION_PERSIST_MS } from './race-constants';

export function useMusicPlayer(tracks: readonly MusicTrack[], volume: number) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const trackIdRef = useRef<string | null>(null);
  const tracksRef = useRef(tracks);
  const volumeRef = useRef(volume);
  const positionsRef = useRef(loadMusicPositions());
  const preparedRef = useRef(false);
  const lastPersistedAt = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => { tracksRef.current = tracks; }, [tracks]);
  useEffect(() => { volumeRef.current = volume; if (audioRef.current && !audioRef.current.paused) audioRef.current.volume = volume; }, [volume]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      setPosition(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
      const id = trackIdRef.current;
      if (!id) return;
      positionsRef.current[id] = audio.currentTime;
      if (Date.now() - lastPersistedAt.current >= MUSIC_POSITION_PERSIST_MS) { saveMusicPositions(positionsRef.current); lastPersistedAt.current = Date.now(); }
    };
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('loadedmetadata', update);
    return () => { audio.removeEventListener('timeupdate', update); audio.removeEventListener('loadedmetadata', update); };
  }, []);
  const unlockAudio = useCallback((requestedTrackId?: string) => {
    if (!audioContextRef.current) {
      const Context = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Context) audioContextRef.current = new Context();
    }
    void audioContextRef.current?.resume();
    const audio = audioRef.current;
    if (!audio) return;
    const id = requestedTrackId ?? trackIdRef.current ?? defaultMusicTrackId;
    if (trackIdRef.current !== id) {
      audio.pause();
      const source = musicTrackFor(id, tracksRef.current).source;
      audio.src = source.startsWith('blob:') ? source : `./${source}`;
      trackIdRef.current = id;
    }
    if (!preparedRef.current) { audio.loop = true; audio.volume = 0; void audio.play().catch(() => undefined); preparedRef.current = true; }
  }, []);
  const play = useCallback((id: string) => {
    unlockAudio(id);
    const audio = audioRef.current;
    if (!audio) return;
    const restore = () => { if (trackIdRef.current === id) audio.currentTime = positionsRef.current[id] ?? 0; };
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) restore(); else audio.addEventListener('loadedmetadata', restore, { once: true });
    audio.volume = volumeRef.current;
    void audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [unlockAudio]);
  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (trackIdRef.current) positionsRef.current[trackIdRef.current] = audio.currentTime;
    saveMusicPositions(positionsRef.current);
    audio.pause(); preparedRef.current = false; setIsPlaying(false);
  }, []);
  const seek = useCallback((next: number) => {
    const audio = audioRef.current;
    if (!audio || !trackIdRef.current || !Number.isFinite(audio.duration)) return;
    audio.currentTime = next; positionsRef.current[trackIdRef.current] = next; saveMusicPositions(positionsRef.current); setPosition(next);
  }, []);
  const beep = useCallback((frequency = 660, duration = 0.13) => {
    const context = audioContextRef.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(); const gain = context.createGain();
    oscillator.frequency.value = frequency; gain.gain.setValueAtTime(0.0001, context.currentTime); gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.01); gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);
    oscillator.connect(gain).connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + duration + 0.02);
  }, []);
  return { audioRef, isPlaying, position, duration, unlockAudio, play, pause, seek, beep };
}

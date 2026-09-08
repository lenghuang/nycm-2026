import { MusicPlayer } from './MusicPlayer';
import { RaceMetrics } from './RaceMetrics';
import type { Phase } from './types';

export function NowView({
  phase,
  phaseLabel,
  intervalMode,
  intervalLeft,
  intervalProgress,
  phaseProgress,
  cycleLabel,
  gelLeft,
  paused,
  showMusic,
  trackLabel,
  musicPlaying,
  musicPosition,
  musicDuration,
  onToggleMusic,
  onSeekMusic,
}: {
  phase: Phase;
  phaseLabel: string;
  intervalMode: string;
  intervalLeft: string;
  intervalProgress: number;
  phaseProgress: number;
  cycleLabel: string;
  gelLeft: string;
  paused: boolean;
  showMusic: boolean;
  trackLabel: string;
  musicPlaying: boolean;
  musicPosition: number;
  musicDuration: number;
  onToggleMusic: () => void;
  onSeekMusic: (position: number) => void;
}) {
  return (
    <section className="simple-race-screen">
      <span className="phase-count">{phaseLabel}</span>
      <h1>{phase.name}</h1>
      <span className="miles">{phase.miles}</span>
      <div className="simple-interval">
        <span>{paused ? 'PAUSED' : intervalMode}</span>
        <strong>{intervalLeft}</strong>
        <small>{paused ? 'Open full controls to resume' : 'Until your next switch'}</small>
      </div>
      <RaceMetrics intervalProgress={intervalProgress} phaseProgress={phaseProgress} cycleLabel={cycleLabel} />
      <div className="simple-gel">
        <i /> GEL IN <b>{gelLeft}</b>
      </div>
      {showMusic && (
        <MusicPlayer
          label={trackLabel}
          isPlaying={musicPlaying}
          position={musicPosition}
          duration={musicDuration}
          onToggle={onToggleMusic}
          onSeek={onSeekMusic}
          compact
        />
      )}
    </section>
  );
}

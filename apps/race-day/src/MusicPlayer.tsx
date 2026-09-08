import { formatTime } from './plan';

export function MusicPlayer({
  label,
  isPlaying,
  position,
  duration,
  onToggle,
  onSeek,
  compact = false,
}: {
  label: string;
  isPlaying: boolean;
  position: number;
  duration: number;
  onToggle: () => void;
  onSeek: (position: number) => void;
  compact?: boolean;
}) {
  const hasDuration = duration > 0;
  return (
    <section
      className={`music-player ${compact ? 'music-player-compact' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button className="music-toggle" onClick={onToggle} aria-label={`${isPlaying ? 'Pause' : 'Play'} ${label}`}>
        <span aria-hidden="true">♫</span>
        <strong>{label}</strong>
        <b>{isPlaying ? '❚❚' : '▶'}</b>
      </button>
      {!compact && (
        <div className="music-seek">
          <input
            type="range"
            min="0"
            max={hasDuration ? duration : 1}
            step="0.1"
            value={hasDuration ? Math.min(position, duration) : 0}
            disabled={!hasDuration}
            aria-label="Music position"
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <span>
            {formatTime(Math.floor(position))} / {hasDuration ? formatTime(Math.floor(duration)) : '--:--'}
          </span>
        </div>
      )}
    </section>
  );
}

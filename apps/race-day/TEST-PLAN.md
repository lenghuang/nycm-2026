# Race Day test plan

## Automated

- Run-first and walk-first boundaries switch to the opposite mode.
- Previous and next interval land on an adjacent mode, not a full cycle away.
- Pause/resume excludes paused wall-clock time.
- Early gel resets only the gel schedule.
- Added cycles live in the session and do not mutate the race plan.
- Phase changes reset phase timing and preserve the selected plan.
- Native cues match the same projected interval and gel events as the UI.
- Replacing a configuration creates a stopped, phase-one session.

Run `bun run verify` from `apps/race-day`.

## On iPhone

1. Start the interval demo; confirm RUN switches to WALK at ten seconds.
2. Lock the phone before a boundary; confirm the native cue arrives.
3. Pause, lock, reopen, and resume; confirm elapsed time did not advance while paused.
4. Tap Next interval from RUN; confirm it moves to WALK, not the next RUN.
5. Change phase using the pinned footer arrows; confirm the phase clock, gel clock, and music policy reset as expected.
6. Start music, scrub it, change phase, return, and confirm its saved position restores.
7. Import an MP3, assign it to a phase, force-close the app, and verify the imported track remains available.
8. Load a different configuration; confirm the race stops at phase one with no stale cues or music.

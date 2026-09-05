# Add local music tracks

On an iPhone, use **Settings → Music library → Add MP3**. The app imports the selected file from Files and keeps it available offline on that phone.

For a development-time shared library, place personal MP3 files in this directory. They are ignored by Git but included in an iOS build and precached for offline playback. Then add each track to `src/audio-library.ts` with a unique `id`, visible `label`, and source path such as `music/my-race-track.mp3`.

The included `Race Day` option uses the existing local `public/race-day.mp3` file.

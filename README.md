# NYCM 2026

Monorepo for NYC Marathon race-day tooling.

## Workspace

- `apps/race-day` — offline-first React PWA for race execution.
- `apps/data-pipeline` — reserved for future imports and analysis.
- `packages/shared` — reserved for types and pure utilities used by both apps.

## Commands

This repository pins Bun through [Mise](https://mise.jdx.dev/). Run `mise install` once after cloning, then:

```bash
mise run ios
```

`mise run ios` installs dependencies when needed, builds the app, syncs it into the native shell, and opens Xcode. Bun remains the package manager and runs the app-local scripts beneath this task.

## iPhone locked-screen proof

The React app also has a Capacitor iOS shell with a native local-notification test. This does not use remote push or require a paid Apple Developer membership.

1. Install the full Xcode app (the Command Line Tools alone are not enough), then open it once and accept its license.
2. Connect your iPhone to the Mac and unlock it.
3. Run `mise run ios`. It builds the web app, syncs it into iOS, then opens Xcode.
4. In Xcode, choose the `App` target, then select your Apple Account's **Personal Team** in **Signing & Capabilities**. If Xcode asks, let it manage signing and use the generated bundle ID.
5. Select your connected iPhone as the run destination and press Run.
6. On the installed app, tap **Test locked-screen cue**, allow notifications, then lock the phone. iOS should show the notification ten seconds later.

Personal Team installs expire after seven days and must be rebuilt/reinstalled. The test intentionally uses on-device local notifications, not APNs remote push.

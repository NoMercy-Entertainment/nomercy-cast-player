# NoMercy Cast Player

Chromecast CAF receiver app for casting playback, both music and video.

> **Being finished.** The receiver is the web twin of the KMP 10-foot TV app, and the work is to complete it on this codebase, not to rewrite it. It runs on the 1.x player libraries (`@nomercy-entertainment/nomercy-music-player@0.2.15`, `@nomercy-entertainment/nomercy-video-player@^1.2.7`), not the 2.x web trio. For parity, the KMP TV screen is the reference for behavior.

## Tech Stack

- TypeScript + Vue 3
- Vite, PostCSS, Tailwind CSS
- Chromecast CAF (Cast Application Framework)

## Conventions

Shared with `nomercy-app-web` (both Vue clients): component PascalCase,
`@/` path alias — see `../VUE-CLIENTS.md`, not repeated here.

- Files: camelCase

## Rules

- This is a Chromecast receiver. All playback commands come from the sender app via the Cast SDK.
- Keep the bundle small. Chromecast devices have limited resources.

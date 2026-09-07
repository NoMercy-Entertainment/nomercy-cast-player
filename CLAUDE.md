# NoMercy Cast Player

Chromecast CAF receiver app for casting playback, both music and video.

> **Parked, not dead** (see `audit/ALIGNMENT.md` D3). This project needs a full rewrite. The current codebase is broken and unreliable, and not functional end to end. Do not build on top of the existing code - plan a clean implementation from scratch. It is pinned to the v1 player libraries (`@nomercy-entertainment/nomercy-music-player@0.2.15`, `@nomercy-entertainment/nomercy-video-player@^1.2.7`), not the shipped 2.1.x web trio, as part of the same parked state. Backlog tracked in `audit/EXECUTION-PLAN.md` "Parked".

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

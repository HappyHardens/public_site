# Trivia hosting

Public page: https://happyhardens.com/trivia/
Multiplayer service: https://happy-hardens-trivia.onrender.com
Render service ID: srv-dbr4j13tqb8s73dfu4bg

The public UI is served by the existing HappyHardens.com static site, with no redirects to the backend. The separate, free, single-instance Render Node service manages room state and WebSocket connections. It uses the private HappyHardens/games repository, codex/trivia-v1 branch, games/trivia root, and deployment specification games/trivia/deploy/render.yaml. Automatic backend deployments are off to avoid interrupting active games on every commit.

The frontend runtime configuration is public routing only. Keep the bank, source evidence, server files, and any credentials out of this repository and static build. The static-site build copies only public HTML, assets, and trivia/.

Rooms are held in memory. A backend restart ends active rooms. Free instances sleep when inactive and may take roughly a minute to wake up; the UI waits and retries before opening a room.

Deployment verification: all 29 backend automated checks passed, including 20 simultaneous player sockets and browser-origin restrictions. Local browser checks cover the library entry, static frontend with separate backend, host/player synchronization, explicit Start, answer submission, and lessons with NLT references. Production verified November 12, 2026: backend commit `747318b` (deploy `dep-dbr4j1btqb8s73dfu5ag`), website commit `44aa7e6` (deploy `dep-dbr4jk8874rs73fgthng`). All seven checked public HTML/CSS/JS/icon files matched the local build. The library link stayed on HappyHardens.com. A host plus two browser players successfully joined, readied, explicitly started, changed/saved answers, received synchronized lessons, opened an NLT reference in a separate tab, and waited for a non-captain player's Continue to advance together. The QR SVG matched the exact HappyHardens.com room URL. Private server and bank paths returned 404 on both hosts.

A separate production test room accepted twenty concurrent players and acknowledged all twenty answer submissions in 486 ms from the test connection. This is a bounded smoke test, not a guarantee for twenty physical devices or all network conditions. Physical phone/TV testing remains for real game nights.

Existing static site: happy-hardens, srv-dbqv5o61egvs73e001r0. DNS and CouchDoodle hosting are unchanged.

## TV connection compatibility update

November 12, 2026: replaced the startup health check's AbortController requirement with XMLHttpRequest and its native timeout. A regression harness reproduced the old Host failure when AbortController was absent; the new startup, retry, cancellation, and stalled-connection checks pass (32 total tests). Connection progress and failures now appear in a prominent banner with Cancel/Dismiss, and the home controls recover after errors. Asset URLs are versioned for this update so reloading the TV page requests the new JavaScript. This reproduces the missing-feature failure, but the user's physical Samsung TV still needs confirmation.

## TrailBlazers

TrailBlazers is available at `/trailblazers/` with controllers at `/trailblazers/join/`. Its separate Render multiplayer service is `happy-hardens-trailblazers` (Node 22, one free instance, manual deployments), built from `HappyHardens/games` branch `codex/trailblazers-v1`, root `games/trailblazers`. Browser assets are exported by that game’s `scripts/export-static.js` with content-hashed CSS/JS; keep `/trailblazers/` in the static build. Backend restarts expire in-memory rooms. The first connection may take a minute while the server wakes.

## You Said What?

The library links to the standalone game at https://happy-hardens-you-said-what.onrender.com/ . The same single-instance Render Node service serves its public UI and WebSocket rooms. Render service: `srv-dbscksuc6qcc738qaqsg`; branch: `codex/you-said-what-v1` in `HappyHardens/games`; root: `games/you-said-what`. The initial deployed commit is `2317114`, deployment `dep-dbsckt6c6qcc738qarm0`.

Hosting uses the free plan, Node 22, production mode, a `/health` check, and manual backend deployments. Local test bots are disabled. Free instances can take a moment to wake after inactivity. The game uses in-memory rooms; restarting the backend ends active games. The revised deck and 10-second winner celebration are included.

The library card uses the existing Trivia wordmark and CSS-rendered game cards. `assets/games.css` is the editable source; the homepage references a content-hashed copy to avoid stale styles. Existing game files and deployment settings are preserved.

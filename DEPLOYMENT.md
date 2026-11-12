# Trivia hosting

Public page: https://happyhardens.com/trivia/
Multiplayer service: https://happy-hardens-trivia.onrender.com
Render service ID: srv-dbr4j13tqb8s73dfu4bg

The public UI is served by the existing HappyHardens.com static site, with no redirects to the backend. The separate, free, single-instance Render Node service manages room state and WebSocket connections. It uses the private HappyHardens/games repository, codex/trivia-v1 branch, games/trivia root, and deployment specification games/trivia/deploy/render.yaml. Automatic backend deployments are off to avoid interrupting active games on every commit.

The frontend runtime configuration is public routing only. Keep the bank, source evidence, server files, and any credentials out of this repository and static build. The static-site build copies only public HTML, assets, and trivia/.

Rooms are held in memory. A backend restart ends active rooms. Free instances sleep when inactive and may take roughly a minute to wake up; the UI waits and retries before opening a room.

Deployment verification: all 29 backend automated checks passed, including 20 simultaneous player sockets and browser-origin restrictions. Local browser checks cover the library entry, static frontend with separate backend, host/player synchronization, explicit Start, answer submission, and lessons with NLT references. Production verification is recorded after publication.

Existing static site: happy-hardens, srv-dbqv5o61egvs73e001r0. DNS and CouchDoodle hosting are unchanged.

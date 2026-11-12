# Trivia publication status

Prepared November 12, 2026. Not yet deployed.

- Trivia backend source: HappyHardens/games, codex/trivia-v1, commit 747318b.
- Render specification: games/trivia/deploy/render.yaml in that repository.
- All 29 automated checks passed, including 20 simultaneous player sockets and cross-origin routing restrictions.
- Locally verified library link at /trivia/, separate static frontend and Node backend, room creation, second client joining, explicit Start, answer acknowledgement, and lesson with NLT reference.
- Library visual checks: desktop 1280px and phone 390px.

Remaining publication steps:
1. Restore responsive Chrome access to the signed-in Render dashboard.
2. Connect the private HappyHardens/games repository to Render; current GitHub source picker only shows brian-j-harden/couch-doodle. Keep existing game services unchanged. Any new repository permission must be reviewed with the user before it is granted.
3. Create the free, single-instance happy-hardens-trivia Node service using the source specification. Confirm the actual assigned public hostname and successful health check.
4. Set trivia/runtime-config.js backendOrigin to that verified HTTPS origin; retain publicUrl https://happyhardens.com/trivia/.
5. Push this library update to public_site/main after checking the remote for concurrent changes.
6. Update existing Render static-site build command to copy both assets and trivia into dist (see render.yaml), then deploy.
7. Verify live library link, actual multiplayer host/player flow, NLT link, QR/share URL, and absence of static server/question-bank files.

Existing static site: happy-hardens, srv-dbqv5o61egvs73e001r0. Do not change DNS or CouchDoodle hosting.

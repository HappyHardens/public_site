# Happy Hardens public website

The public game library at **https://happyhardens.com/**. The library features CouchDoodle (hosted at **https://couchdoodle.com/**) and Happy Hardens Trivia (served directly at **https://happyhardens.com/trivia/**).

## Edit and preview

This is a static site with no build step or package dependencies.

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The homepage is `index.html`, with its own `assets/games.css`. The existing support and privacy pages use `assets/styles.css`.

## Publishing

Render Static Site configuration is tracked in `render.yaml`. Deploy from this repository's `main` branch, using the build command and `dist` publish directory in that file. The build copies only public HTML and assets; no application server or package installation is needed. Automatic deployment from `main` was verified on November 12, 2026 when commit `44aa7e6` published Trivia successfully. Render’s Manual Deploy remains available when needed.

Migration completed November 12, 2026. **https://happyhardens.com/** is hosted on Render, with **https://happy-hardens.onrender.com/** as the Render address. All 14 published HTML and asset files match the verified local build. Both domains pass HTTPS validation, and HTTP and `www` redirect to `https://happyhardens.com/`. GitHub Pages is disabled and its `CNAME` file has been removed. This website does not host or change CouchDoodle itself.

The root A record points to Render's `216.24.57.1` (TTL 600), and `www` is a CNAME to `happy-hardens.onrender.com` (TTL 1 hour). Nameservers remain `ns37.domaincontrol.com` and `ns38.domaincontrol.com`. Mail and other unrelated DNS records were preserved.

For future hosting changes, deploy and verify the replacement first, change only the web DNS records, verify certificates and redirects, then retire the previous host.

## Artwork and fonts

CouchDoodle artwork is reused from Happy Hardens' existing game. The locally hosted Lilita One and Comic Neue fonts include their original SIL Open Font License files in `assets/`. No third-party scripts, analytics, or external font requests are used by the homepage.

## Library additions

Add only playable games. Use a real destination URL, an accessible title and artwork description, and accurate game requirements. The current page has two playable games and no inactive placeholder tiles.

## Trivia deployment

`trivia/` contains only the public UI copied from `HappyHardens/games`, branch `codex/trivia-v1`, directory `games/trivia/public/`. The private question bank and server stay in that repository. The browser remains on HappyHardens.com while its runtime configuration directs API and WebSocket requests to the separate Render multiplayer service. Configure that service with `PUBLIC_URL=https://happyhardens.com/trivia/` so links and QR codes return to this site.

When updating Trivia, copy its public assets again, then preserve the production `trivia/runtime-config.js`. Deploy the compatible backend before publishing the updated static site.

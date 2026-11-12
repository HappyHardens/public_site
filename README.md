# Happy Hardens public website

The public game library at **https://happyhardens.com/**. The library currently features CouchDoodle; its Play links navigate directly to **https://couchdoodle.com/**.

## Edit and preview

This is a static site with no build step or package dependencies.

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The homepage is `index.html`, with its own `assets/games.css`. The existing support and privacy pages use `assets/styles.css`.

## Publishing

Render Static Site configuration is tracked in `render.yaml`. Deploy from this repository's `main` branch, using the build command and `dist` publish directory in that file. The build copies only public HTML and assets; no application server or package installation is needed. Successful pushes to `main` deploy automatically once the Render service is connected.

Migration status (November 12, 2026): Render is deployed at **https://happy-hardens.onrender.com/**. All 14 published HTML and asset files were verified over HTTPS against the local build. Both custom domains are added to Render; the GoDaddy DNS cutover is waiting for the account owner's SMS identity verification. GitHub Pages and `CNAME` remain in place until Render serves the custom domain successfully. This website does not host or change CouchDoodle itself.

The DNS cutover replaces the four GitHub Pages root A records (`185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`, TTL 600) with Render's `216.24.57.1`, and changes `www` from `happyhardens.github.io` to `happy-hardens.onrender.com`. Nameservers remain `ns37.domaincontrol.com` and `ns38.domaincontrol.com`. Preserve all mail and other unrelated DNS records.

Cutover order:

1. Deploy and verify the Render address, including the homepage, support/privacy pages and assets.
2. Add `happyhardens.com` to the Render service; Render also configures `www` to redirect to the root domain.
3. Update only the domain's web DNS records at GoDaddy using Render's displayed targets. Preserve mail, verification and other unrelated records.
4. Verify both domains and HTTPS on Render, then disable GitHub Pages and remove `CNAME`.

## Artwork and fonts

CouchDoodle artwork is reused from Happy Hardens' existing game. The locally hosted Lilita One and Comic Neue fonts include their original SIL Open Font License files in `assets/`. No third-party scripts, analytics, or external font requests are used by the homepage.

## Library additions

Add only playable games. Use a real destination URL, an accessible title and artwork description, and accurate game requirements. The current page intentionally has one game and no inactive placeholder tiles.

# Happy Hardens public website

The public game library at **https://happyhardens.com/**, served by GitHub Pages from this repository. The library currently features CouchDoodle; its Play links navigate directly to **https://couchdoodle.com/**.

## Edit and preview

This is a static site with no build step or package dependencies.

```sh
python3 -m http.server 4173 --bind 127.0.0.1
```

Open http://127.0.0.1:4173. The homepage is `index.html`, with its own `assets/games.css`. The existing support and privacy pages use `assets/styles.css`.

## Publishing

Commit and push to `main`; GitHub Pages publishes the repository root. Preserve `CNAME`, which contains the custom domain `happyhardens.com`. This website does not host or change CouchDoodle itself.

## Artwork and fonts

CouchDoodle artwork is reused from Happy Hardens' existing game. The locally hosted Lilita One and Comic Neue fonts include their original SIL Open Font License files in `assets/`. No third-party scripts, analytics, or external font requests are used by the homepage.

## Library additions

Add only playable games. Use a real destination URL, an accessible title and artwork description, and accurate game requirements. The current page intentionally has one game and no inactive placeholder tiles.

# ainf

All Indian Nevarlands Foundation (AINF) site — Next.js App Router, 19 pages.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## How it works

Each page is a statically-prerendered Next.js **route handler**
(`app/<route>/route.ts`) serving the page HTML verbatim — including the HTML
comment markers Framer's runtime uses to hydrate instantly (which is why the
markup is a string constant rather than JSX: React cannot emit comment nodes,
and dropping them forces a slow client-side re-render). Framer's runtime
stays fully intact, so the site renders **identically to the original** —
full content, animations, interactivity.

On top of that it applies a few fixes: site images are re-encoded to WebP and
self-hosted under `public/assets/img` (fidelity-safe, and the biggest payload
win on image-led sites), fonts are self-hosted under `public/assets/fonts`
(Onest is preloaded and `font-display: optional`, so text never reflows after
first paint), the above-the-fold hero image is marked `fetchpriority="high"`
and preloaded with its own `srcset`, canonical/og:url are repointed to the
deploy domain (root-relative, upgraded to absolute in the browser so they never
reference Framer's domain), and Framer's analytics beacon is removed. Pages are
static and CDN-cacheable, so TTFB stays low.

The page HTML lives in `framer-html/*.html`; `lib/framer-page.ts` transforms it
on the way out (the `.html` file is the only source).

## Keeping first paint stable

The exported HTML no longer matches Framer's page modules, so after load
Framer re-renders most sections. Three pieces keep that invisible:

- **Image guard** (`lib/image-guard.ts`, inlined first in `<head>`): when
  Framer sets an image URL, it gets the photo the served HTML showed in that
  slot instead (portraits by the name on the card, mission/story photos by
  their title), before anything is fetched or painted.
- **Copy and photo bakes**: the served HTML already carries the settled photos
  and copy, so a re-render paints the same thing. After editing page HTML,
  page scripts, or the copy tables, rebuild and re-run them:

  ```bash
  npm run build && npm start          # in one terminal
  node scripts/bake-page-photos.mjs   # --dry to preview
  node scripts/bake-page-text.mjs     # --dry --verbose to preview
  ```

  Both refuse to write a page whose structure would change.
- **Project pages** are filled from Postgres on the server (ISR, revalidated
  when an admin saves a project). Their copy tables live in
  `public/assets/js/ainf-projects-theme.js`; after editing them run
  `node scripts/apply-project-copy-to-modules.mjs`.

`npm run test:e2e` includes a check that no page's photos change after load.

## Caching

Scripts and stylesheets are referenced with a `?v=` derived from their
contents (`lib/asset-version.ts`) and cached for a year; never hand-edit a
version. Images get a week plus stale-while-revalidate, Framer bundles a day
(their copy is edited in place). API responses are `no-store` unless a route
opts in. Policy: `vercel.json` (wins on Vercel) mirrored in `next.config.js`.
Functions run in `sin1`, next to the Neon database.

Deploy to Vercel/Netlify like any Next.js app.

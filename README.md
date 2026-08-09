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
with `font-display: swap` forced, the above-the-fold hero image is marked
`fetchpriority="high"` for a faster LCP, canonical/og:url are repointed to the
deploy domain (root-relative, upgraded to absolute in the browser so they never
reference Framer's domain), and Framer's analytics beacon is removed. Pages are
static and CDN-cacheable, so TTFB stays low.

Deploy to Vercel/Netlify like any Next.js app.

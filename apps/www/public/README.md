# public/ assets

Static assets served at the site root.

## Current files

- `robots.txt` — search-engine allow-list, points to `/sitemap.xml`

## TODO before launch (design assets)

- `favicon.ico` — 32×32 or multi-resolution. Referenced from `app/layout.tsx` (`icons.icon`).
- `logo.svg` — referenced from the root `README.md` (`https://openvpm.com/logo.svg`).
- `og-image.png` — 1200×630, used for LinkedIn/X preview cards. Referenced from `app/layout.tsx` (`openGraph.images` and `twitter.images`).

Until these exist, Next.js will 404 the references — harmless at runtime but social previews will fall back to text-only and the favicon will be blank.

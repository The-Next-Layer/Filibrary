# Filibrary

Phase 1 starter for the Filibrary web app.

What is included:
- Next.js app-router scaffold
- Tailwind styling
- 58 seeded filament entries based on the current curated list
- affiliate-brand mapping based on the links you supplied
- YouTube video cards with thumbnails
- filament detail pages
- Supabase schema draft for the real database

## Run locally

```bash
npm install
npm run dev
```

## Suggested deployment

- Frontend: Vercel
- Database + storage + auth: Supabase
- Domain: `filibrary.thenextlayer.com`

## Phase 2 priorities

1. Replace local seed reads with Supabase queries
2. Build a real admin editor
3. Add moderated community submissions
4. Add approved hero images + credit metadata
5. Add URL-driven filters and search
6. Add the “Whatcha Printing?” recommendation flow

## Seed source

The current seed data was built from the filament list you provided and normalized into one-material-per-entry.

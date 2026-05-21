# Filibrary

**A curated 3D printer filament reference library.** Every material explained, compared, and linked to where you can buy it.

Live at **[filibrary.thenextlayer.com](https://filibrary.thenextlayer.com)**.

---

## What this is

A free, community-maintained encyclopedia of 3D-printing filaments. Each entry covers what a material is good for, its strengths and weaknesses on a radar chart, related materials, and reputable vendors. Built by [The Next Layer](https://thenextlayer.com).

The static site is generated from a single TypeScript data file (`filibrary-next/lib/seed.ts`). The community-submission, suggest-an-edit, and report-an-issue flows write to Supabase; an admin dashboard reviews them and commits new entries back to the data file, which triggers a redeploy.

## Quick start

```bash
git clone https://github.com/The-Next-Layer/filibrary.git
cd filibrary
cp .env.example .env   # fill in your Supabase values (optional for read-only browsing)
npm install
npm run dev            # → http://localhost:4321
```

Production build:

```bash
npm run build          # outputs to ./dist
npm run preview        # serve the built site locally
```

## Tech stack

- [Astro](https://astro.build/) — static site generator (no client-side framework, just islands of plain JS)
- [Supabase](https://supabase.com/) — Postgres + Edge Functions for submissions, reports, and the admin API
- GitHub Actions → FTP — builds on push to `main` and deploys to Hostinger

## Repo layout

| Path | What it is |
|---|---|
| `src/pages/` | Astro pages — landing grid, per-filament page, submit form, admin |
| `src/layouts/Layout.astro` | Shared layout, header, footer, theme, global CSS |
| `filibrary-next/lib/seed.ts` | **All filament data lives here.** Edit this to add or correct an entry. |
| `filibrary-next/supabase/` | Schema, migrations, and the `admin-api` Edge Function |
| `public/` | Static assets + the panel / report / suggest client scripts |
| `.github/workflows/` | Build & deploy on push to `main`, plus a Supabase keepalive cron |

## Contributing

PRs welcome — fixes to data, new filaments, UI polish, bug reports. See [CONTRIBUTING.md](CONTRIBUTING.md) for the quick version.

The easiest way to add a missing filament or correct an existing one without touching code is the **Suggest an edit** button on the live site. PRs against `seed.ts` are also welcome.

## Operator docs

If you're forking this to run your own version:

- [SETUP.md](SETUP.md) — initial launch (Supabase, secrets, Hostinger, first deploy)
- [ADMIN_SETUP.md](ADMIN_SETUP.md) — wiring up the `/admin` review dashboard

## License

[MIT](LICENSE) — do what you want, just keep the copyright notice.

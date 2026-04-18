# Filibrary — Roadmap

Single source of truth for what's been built, what's next, and what we've deliberately deferred. Update at the end of every session.

---

## Project shape (cold-read context)

- **Site:** https://filament.thenextlayer.com — static Astro build, hosted on Hostinger via FTP deploy.
- **Data:** filaments live in `filibrary-next/lib/seed.ts` (TypeScript array, committed to git, build pulls from it).
- **Backend:** Supabase (project `opflbrgqgdquxbpygfqy`) for community forms.
  - `community_submissions` — new filament submissions
  - `filament_reports` — report-an-issue
  - `filament_contributions` — suggest-an-edit (vendor / video / stats / tags / note)
  - Edge function `admin-api` handles admin actions, commits to `seed.ts` via GitHub API, which re-triggers the deploy.
- **Admin:** `/admin` — password-gated dashboard (Submissions / Contributions / Reports tabs).
- **Analytics:** Cloudflare Web Analytics, gated on `PUBLIC_CF_ANALYTICS_TOKEN` secret.

**Deploy flow:**
1. Site changes → push to `main` → GitHub Action builds + FTPs to Hostinger (~90s).
2. Edge function changes → manual `supabase functions deploy admin-api` from Mac (not automated yet).
3. Migrations → run manually in Supabase SQL Editor.

**Keys & secrets (where they live, not the values):**
- GitHub Actions secrets: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (legacy JWT format, `eyJ...`), `PUBLIC_CF_ANALYTICS_TOKEN`, `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.
- Supabase edge function secrets: `ADMIN_PASSWORD`, `GITHUB_TOKEN` (fine-grained PAT, contents:write), `GITHUB_REPO`, `GITHUB_BRANCH`, `SEED_PATH`.

---

## ✅ Shipped

### Infrastructure
- Astro site scaffolded, 58+ filaments seeded, dark-mode UI with radar stats and slide-out detail panel.
- FTP deploy wired up (after painful detour through path + credential issues — see "gotchas" below).
- Supabase schema with migrations 001–005.
- Admin dashboard, edge function, GitHub PAT-based auto-commit on approve.
- Cloudflare Web Analytics.

### Community flows
- **Submit a filament** (`/submit`) — brand-new filament proposal with tags, ratings sliders, vendor, video.
- **Report an issue** — modal on each filament, reason + comment.
- **Suggest an edit** — modal with five tabs (Vendor / Video / Ratings / Tags / Note). Multi-tab: each filled tab posts as its own contribution row. Admin approves → edge function patches `seed.ts` → redeploy.

### Audience-feedback Tier 1 (shipped)
- Search relevance rewrite: short queries (<5 chars) match name/aliases/tags with word boundary only. "PLA" no longer matches every summary that contains the letters "pla". `+` normalizes to `plus` so "PLA+" / "PLA Plus" / "PLA Pro" all resolve.
- Multi-select tag filter: tap multiple tags to AND-combine.
- Radar "Printability" label no longer clipped.
- PLA+ / PRO entry added (Sunlu PLA+ and Polymaker PolyLite PLA Pro).
- Three new tags: ESD Safe, Fire Retardant, MMU/AMS Safe.

---

## 🛠 Next up — Tier 2 (one session, 2–3 hrs)

### 2a. Engineering specs expansion
Add real engineering data to each filament, surfaced as a "Specs" section in the detail panel. Admin fills in via `/admin`; community can suggest via an expanded Ratings/Specs tab.

**Fields to add to filament schema:**
- Print temp range (°C, min–max)
- Bed temp range (°C, min–max)
- Enclosure required (bool + optional chamber °C)
- Heat Deflection Temperature @ 0.45 MPa (°C)
- Tensile strength (MPa, XY direction — the one engineers care about)

**Deliberately skipped:** Shore hardness. Varies too widely within a single material family (TPU is 65–98A) to be one field, and irrelevant for non-flexibles.

**Work involved:**
- Extend TypeScript type in seed format
- Migration to add columns to `community_submissions` + `filament_contributions` payload conventions
- UI: new "Specs" section in slide-out panel and slug page
- Submit form + suggest modal: add specs fields
- Admin approve UI: inputs for new specs
- Edge function: `apply_contribution` branch for type `specs`

### 2b. Gallery upload
Per-filament image gallery (2–3 photos max per entry). Shown as thumbnails in the detail panel, lightbox on click.

**Approach:** manual upload in `/admin`, stored in Supabase Storage (free 1GB is plenty). Schema already has `gallery_images` table — just needs wiring.

**Deliberately skipped:**
- ❌ Auto-scraping mfg websites for spool photos (TOS + brittle).
- ❌ AI-generated images (audience already flagging "AI-made" vibes; would accelerate the critique).
- ❌ Auto-extracting video frames from YouTube (works technically via yt-dlp + ffmpeg, but picking the right timestamp is manual anyway — same effort as just screenshotting).

Optionally: on vendor link save, fetch OG meta image for a small thumbnail (legal, automatic, degrades gracefully). Nice-to-have, low priority.

---

## 🔭 Later — Tier 3

### Compare feature
Side-by-side comparison of two (or more) filaments. Radar overlay with two data polygons in different colors + a specs table below.

**Why later:** with only 6 radar axes, compare is shallow. After Tier 2's engineering specs, compare becomes a genuinely useful engineering tool ("which extrudes cooler AND has higher HDT?"). Build after 2a.

**UX sketch:** checkbox on each card ("Compare"), floating "Compare (2)" bar at bottom, click → full-screen overlay comparing the selected filaments.

### Filament editor in `/admin`
Edit any field on any existing filament (name, summary, tags, stats, vendors, videos, specs) without touching `seed.ts` manually. Same GitHub-commit pattern as approvals.

**Why not now:** deferred until we know which fields actually hurt to edit manually. "Just edit seed.ts on GitHub web UI" covers 90% until friction is obvious.

### Multi-parameter query builder
"Find carbon-fiber filaments that extrude <280°C without enclosure, strength >70 MPa." Powerful but niche. Revisit only if Tier 2 specs expansion reveals demand.

---

## 💭 Considering / ideas backlog

- **Hex color swatch per vendor link** (TinkerDad3D) — color is per-SKU not per-filament, messy data model. Skip unless revived.
- **Brand field per filament** — partially covered by purchase link labels. Could normalize if vendor data gets richer.
- **Open-source the repo** (Zach-vc4qp) — low effort when we're ready, worth doing once code stabilizes post-Tier 2.
- **"Quick settings poster"** (L0g1calMadn3ss) — print parameter cheat sheet. Becomes trivial to render from Tier 2 data.
- **ESD Safe / Fire Retardant / MMU filament seeding** — tags exist but no filament carries them yet. Backfill as we encounter applicable materials.

---

## 🪲 Known maintenance / backfill items

- Existing filaments haven't been backfilled with `Engineering`, `Exotic`, `Challenging`, `ESD Safe`, `Fire Retardant`, `MMU/AMS Safe` tags. Apply as needed during data cleanup.
- PLA+ / PRO stat values (strength 80, heat 32, flex 42, etc.) were educated guesses from Sunlu/Polymaker marketing — worth validating against actual TDS once someone has the data.
- Only PLA+ / PRO has an `aliases` field. Others could get them (e.g. "CF" → alias of "Carbon Fiber"), but multi-tag filter partially covers that need.

---

## ⚠️ Gotchas / operational lessons

- **Hostinger FTP user lands in `/public_html/`** — so `server-dir` in the workflow should be `/filament/`, NOT `/public_html/filament/` (that creates a nested `/public_html/public_html/filament/`).
- **Hostinger FTP has IP allowlist** — must be set to Any IP for GitHub Actions to reach it.
- **Supabase rolled out new publishable keys** (`sb_publishable_...`). They don't work with the edge function gateway which still expects JWT format. Use the **legacy JWT anon key** (`eyJ...`) for `PUBLIC_SUPABASE_ANON_KEY`.
- **Astro only exposes env vars prefixed `PUBLIC_`** to the browser. Any secret that gets injected into client JS needs that prefix.
- **`.astro` scoped styles don't apply to JS-injected HTML.** Use `<style is:global>` for any CSS that targets dynamically-added DOM (admin.astro learned this the hard way).
- **Edge function deploys are manual.** GitHub Action only deploys the static site. Any `admin-api/index.ts` change requires `supabase functions deploy admin-api` from the Mac. Automating this is a small follow-up if we change edge function code frequently.
- **Migrations are manual.** Run in Supabase SQL Editor after merging. Check migration number before deploying features that depend on schema changes.

---

## 📝 Session conventions

- At start of session: I read this file.
- At end of session: I update this file — move items between sections, note anything new.
- User doesn't need to be precise — brain-dump wording is fine, structure is my job.

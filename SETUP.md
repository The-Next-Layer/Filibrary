# Filibrary — Launch Setup Guide

Follow these steps once to get the site live on Hostinger.

---

## Step 1 — Push to GitHub

1. Create a new GitHub repo (github.com → New repository). Name it `filibrary`.
2. In your terminal, from this folder:
   ```
   git init
   git add .
   git commit -m "Initial build"
   git remote add origin https://github.com/YOUR_USERNAME/filibrary.git
   git push -u origin main
   ```

---

## Step 2 — Set up Supabase (free tier)

1. Go to https://supabase.com and create a free account.
2. Create a new project (any name, pick the region closest to you).
3. Once the project is ready, go to **SQL Editor** and paste the contents of `filibrary-next/supabase/schema.sql`, then click **Run**.
4. Go to **Project Settings → API** and copy:
   - **Project URL** → this is your `PUBLIC_SUPABASE_URL`
   - **anon / public key** → this is your `PUBLIC_SUPABASE_ANON_KEY`

---

## Step 3 — Add GitHub Secrets

In your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**, add these:

| Secret name | Value |
|---|---|
| `PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `FTP_SERVER` | Your Hostinger FTP server (e.g. `ftp.thenextlayer.com`) |
| `FTP_USERNAME` | Your Hostinger FTP username |
| `FTP_PASSWORD` | Your Hostinger FTP password |

You can find FTP credentials in Hostinger → **Hosting → Manage → FTP Accounts**.

---

## Step 4 — Create the subdomain on Hostinger

1. In Hostinger, go to **Hosting → Manage → Subdomains**.
2. Create subdomain `filibrary` on `thenextlayer.com`.
3. Note the folder it creates (usually `/public_html/filibrary.thenextlayer.com/`).
4. Make sure that path matches `server-dir` in `.github/workflows/deploy.yml`.

---

## Step 5 — Add your Ko-fi username

In two files, replace `YOUR_KOFI_USERNAME` with your actual Ko-fi username:
- `src/layouts/Layout.astro` (appears twice — header button and footer button)
- `src/pages/filaments/[slug].astro` (in the aside support card)

Your Ko-fi page is at `https://ko-fi.com/YOUR_USERNAME`.

---

## Step 6 — Trigger the first deploy

Go to your GitHub repo → **Actions → Build & Deploy to Hostinger → Run workflow**.

Wait ~2 minutes. The site should then be live at `https://filibrary.thenextlayer.com`.

---

## How approvals work (ongoing)

When someone submits a filament:
1. It lands in your Supabase `community_submissions` table with `status = 'pending'`.
2. Log into https://supabase.com → your project → **Table Editor → community_submissions**.
3. Review the row. If it's good, change `status` to `'approved'`.

To auto-trigger a site rebuild on approval, set up a Supabase Database Webhook:
1. In Supabase → **Database → Webhooks → Create a new hook**.
2. Table: `community_submissions`, Event: `UPDATE`.
3. Type: **HTTP Request**.
4. URL: `https://api.github.com/repos/YOUR_USERNAME/filibrary/actions/workflows/deploy.yml/dispatches`
5. Headers: `Authorization: Bearer YOUR_GITHUB_PAT`, `Content-Type: application/json`
6. Body: `{"ref":"main"}`
7. Create a GitHub Personal Access Token at github.com/settings/tokens with `workflow` scope.

After that, approving a submission automatically triggers a rebuild and deploys the new filament to the live site — no manual step needed.

---

## Adding new filaments manually

Open `filibrary-next/lib/seed.ts` and add a new entry to the array, then push to `main`. GitHub Actions will rebuild and deploy automatically.

---

## Local development

```bash
cp .env.example .env
# fill in your Supabase values in .env
npm install
npm run dev
# → http://localhost:4321
```

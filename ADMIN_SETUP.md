# Filibrary — Admin Setup (one-time)

This wires up the `/admin` page so you can review submissions and reports with a single click — no terminal, no git. Do these steps **once**. After that, every community submission → email-optional → you approve in the browser → the site rebuilds and deploys automatically.

---

## 1. Run the SQL migrations

In Supabase → **SQL Editor**, run these in order (only needed once per project):

1. `filibrary-next/supabase/migrations/002_submission_stats.sql` — adds stat columns to community submissions
2. `filibrary-next/supabase/migrations/003_reports.sql` — creates the reports table
3. `filibrary-next/supabase/migrations/004_contributions.sql` — creates the contributions table (partial-info suggestions)

(If this is a brand-new Supabase project, you can skip the migrations and just run `filibrary-next/supabase/schema.sql` instead — it's kept in sync.)

---

## 2. Create a GitHub Personal Access Token (PAT)

The admin "Approve" action commits a new filament entry to `filibrary-next/lib/seed.ts` on your behalf. It needs a GitHub token with **write access to your repo's contents**.

1. Go to https://github.com/settings/personal-access-tokens/new (fine-grained tokens).
2. **Token name:** `filibrary-admin-api`
3. **Resource owner:** the org that owns the repo (e.g. `The-Next-Layer`)
4. **Repository access:** Only select repositories → choose `The-Next-Layer/filibrary`.
5. **Repository permissions:**
   - **Contents:** Read and write ← the only one required
6. **Expiration:** 1 year (you'll rotate it then).
7. Click **Generate token**, copy the `github_pat_...` string.

---

## 3. Deploy the Edge Function

The admin API lives at `filibrary-next/supabase/functions/admin-api/index.ts`. Deploy it using the Supabase CLI:

```bash
# Install CLI once: https://supabase.com/docs/guides/cli
supabase login
supabase link --project-ref YOUR_PROJECT_REF  # find this in Supabase → Settings → General
supabase functions deploy admin-api --project-ref YOUR_PROJECT_REF
```

No Docker or local server needed — the CLI just uploads the file.

---

## 4. Set the Edge Function secrets

Supabase → **Project Settings → Edge Functions → Secrets** (or run `supabase secrets set`):

| Key | Value |
|---|---|
| `ADMIN_PASSWORD`  | Any password you choose — this is what you'll type at `/admin` |
| `GITHUB_TOKEN`    | The `github_pat_...` from step 2 |
| `GITHUB_REPO`     | `The-Next-Layer/filibrary` |
| `GITHUB_BRANCH`   | `main` |
| `SEED_PATH`       | `filibrary-next/lib/seed.ts` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected — you don't set those.

CLI equivalent:
```bash
supabase secrets set ADMIN_PASSWORD=choose-something-strong \
  GITHUB_TOKEN=github_pat_xxx \
  GITHUB_REPO=The-Next-Layer/filibrary \
  GITHUB_BRANCH=main \
  SEED_PATH=filibrary-next/lib/seed.ts
```

---

## 5. You're done

- Go to **https://filament.thenextlayer.com/admin** (or wherever your site lives).
- Enter the password from step 4.
- You'll see three tabs: **Submissions**, **Contributions**, and **Reports**.

### Submission workflow
1. A community member submits a filament — it lands in the Submissions tab.
2. You edit any fields you want (summary, tags, ratings, etc.) and click **Approve & publish**.
3. The edge function commits the new filament to `seed.ts` → GitHub Actions rebuilds → Hostinger FTP deploy. Total time ~90 seconds.
4. Need to reject it? Click **Reject** with an optional note.

### Contribution workflow
1. Someone clicks "Suggest an edit" on a filament (or hits an empty-state CTA like "Suggest a vendor") — they pick a tab (vendor / video / ratings / note) and send a small payload.
2. It lands in the Contributions tab with the editable fields pre-filled from what they submitted.
3. You adjust if needed and click **Apply to filament** for vendor/video/ratings. The edge function finds the filament in `seed.ts`, patches the relevant inner array (or replaces stats), commits → the site rebuilds automatically. ~90s to live.
4. For type = *note*, there's nothing to auto-apply — read it, act on it yourself if warranted (edit `seed.ts` directly), then **Dismiss**.

### Report workflow
1. Someone clicks "Report an issue" on a filament — it lands in the Reports tab.
2. You click **Open filament ↗** to see what they're flagging, fix it if needed (edit `seed.ts` yourself), then **Mark resolved** or **Dismiss**.

---

## Rotating the GitHub token later

When the PAT expires (1 year), just generate a new one and update the `GITHUB_TOKEN` secret — nothing else changes.

## What the service_role key does

The edge function uses Supabase's `service_role` key internally (auto-injected by Supabase) to read pending submissions and reports. This key **never leaves the server** — the browser only ever sees the public `anon` key. The admin password is the only thing guarding access to the admin API.

// Filibrary admin API — Supabase Edge Function (Deno)
//
// Single endpoint that powers the /admin page. All actions require a shared
// password (ADMIN_PASSWORD secret). Actions:
//   - list_pending        → submissions awaiting review
//   - list_reports        → open filament reports
//   - approve_submission  → commit a new filament to seed.ts + mark approved
//   - reject_submission   → mark a submission rejected
//   - resolve_report      → mark a report resolved
//   - dismiss_report      → mark a report dismissed
//
// Required secrets (Project Settings → Edge Functions → Secrets):
//   ADMIN_PASSWORD            any string you choose
//   GITHUB_TOKEN              fine-grained PAT with contents:write on the repo
//   GITHUB_REPO               e.g. "jonathanalevi/Filibrary"
//   GITHUB_BRANCH             usually "main"
//   SEED_PATH                 usually "filibrary-next/lib/seed.ts"
// The Supabase runtime auto-injects SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...CORS },
  });

const need = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
};

// ── Supabase REST helper (service role bypasses RLS) ─────────────────────
async function sb(path: string, init: RequestInit = {}) {
  const url = need('SUPABASE_URL') + '/rest/v1' + path;
  const key = need('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(url, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// ── GitHub Contents API helpers ──────────────────────────────────────────
async function gh(path: string, init: RequestInit = {}) {
  const url = 'https://api.github.com' + path;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${need('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'filibrary-admin-api',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitHub ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function b64encode(s: string): string {
  return btoa(
    Array.from(new TextEncoder().encode(s))
      .map((b) => String.fromCharCode(b))
      .join('')
  );
}
function b64decode(s: string): string {
  const bin = atob(s.replace(/\n/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ── seed.ts mutation ─────────────────────────────────────────────────────
type StatPoint = { label: string; value: number };
type FilamentEntry = {
  slug: string;
  shortName: string;
  fullName: string;
  summary: string;
  sourceVideos: string[];
  videoReferences: { title: string; url: string; thumbnailUrl: string }[];
  tags: string[];
  purchaseLinks: { label: string; url: string }[];
  heroImageUrl: string;
  heroImageCreditLabel: string;
  heroImageCreditUrl: string;
  stats: StatPoint[];
  statsSource: string;
};

function entryJson(e: FilamentEntry): string {
  // Two-space indent matching the surrounding array.
  return JSON.stringify(e, null, 2)
    .split('\n')
    .map((line, i) => (i === 0 ? '  ' + line : '  ' + line))
    .join('\n');
}

function insertIntoSeed(src: string, e: FilamentEntry): string {
  if (src.indexOf(`"slug": "${e.slug}"`) !== -1) {
    throw new Error(`Slug already exists in seed.ts: ${e.slug}`);
  }
  const block = entryJson(e);
  // Match "...},\n];" or "...}\n];" at end.
  const re = /(\}\s*)\n?\]\s*;\s*$/;
  if (!re.test(src.trimEnd())) {
    throw new Error('seed.ts format unexpected — could not find closing "];"');
  }
  return src.trimEnd().replace(re, `$1,\n${block}\n];\n`);
}

async function commitFilament(entry: FilamentEntry, message: string) {
  const repo   = need('GITHUB_REPO');
  const branch = need('GITHUB_BRANCH');
  const path   = need('SEED_PATH');
  const cur = await gh(
    `/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`
  );
  const text = b64decode(cur.content);
  const next = insertIntoSeed(text, entry);
  await gh(`/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message,
      content: b64encode(next),
      sha: cur.sha,
      branch,
    }),
  });
}

// ── Input validation ─────────────────────────────────────────────────────
function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
function sanitizeStats(stats: unknown): StatPoint[] {
  if (!Array.isArray(stats)) return [];
  const LABELS = ['Strength', 'Heat', 'Printability', 'Weather', 'Flex', 'Finish'];
  return LABELS.map((label) => {
    const found = (stats as Record<string, unknown>[]).find(
      (s) => typeof s?.label === 'string' && s.label === label
    );
    const v = Number(found?.value);
    const value = Number.isFinite(v) ? Math.max(0, Math.min(100, Math.round(v))) : 50;
    return { label, value };
  });
}
function buildEntry(input: Record<string, any>): FilamentEntry {
  const slug = slugify(String(input.slug || input.shortName || ''));
  if (!slug) throw new Error('slug is required');
  const shortName = String(input.shortName || '').trim();
  const fullName  = String(input.fullName  || '').trim();
  const summary   = String(input.summary   || '').trim();
  if (!shortName) throw new Error('shortName is required');
  if (!fullName)  throw new Error('fullName is required');
  if (!summary)   throw new Error('summary is required');

  const tags = Array.isArray(input.tags) ? input.tags.map((t: unknown) => String(t)) : [];
  const purchaseLinks = Array.isArray(input.purchaseLinks)
    ? input.purchaseLinks
        .filter((p: any) => p && p.label && p.url)
        .map((p: any) => ({ label: String(p.label), url: String(p.url) }))
    : [];
  const videoReferences = Array.isArray(input.videoReferences)
    ? input.videoReferences
        .filter((v: any) => v && v.url)
        .map((v: any) => ({
          title: String(v.title || v.url),
          url: String(v.url),
          thumbnailUrl: String(v.thumbnailUrl || ''),
        }))
    : [];

  return {
    slug,
    shortName,
    fullName,
    summary,
    sourceVideos: videoReferences.map((v) => v.title),
    videoReferences,
    tags,
    purchaseLinks,
    heroImageUrl: '',
    heroImageCreditLabel: '',
    heroImageCreditUrl: '',
    stats: sanitizeStats(input.stats),
    statsSource: String(input.statsSource || '').trim(),
  };
}

// ── Actions ──────────────────────────────────────────────────────────────
async function listPending() {
  return sb('/community_submissions?status=eq.pending&order=created_at.desc');
}
async function listReports() {
  return sb('/filament_reports?status=eq.open&order=created_at.desc');
}
async function approveSubmission(body: Record<string, any>) {
  const id = String(body.submission_id || '');
  if (!id) throw new Error('submission_id required');
  const entry = buildEntry(body);
  await commitFilament(entry, `Add ${entry.shortName} from community submission`);
  await sb(`/community_submissions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'approved',
      reviewed_notes: body.reviewed_notes || null,
    }),
  });
  return { ok: true, slug: entry.slug };
}
async function rejectSubmission(body: Record<string, any>) {
  const id = String(body.submission_id || '');
  if (!id) throw new Error('submission_id required');
  await sb(`/community_submissions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'rejected',
      reviewed_notes: body.reviewed_notes || null,
    }),
  });
  return { ok: true };
}
async function updateReport(body: Record<string, any>, status: 'resolved' | 'dismissed') {
  const id = String(body.report_id || '');
  if (!id) throw new Error('report_id required');
  await sb(`/filament_reports?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status,
      resolved_notes: body.resolved_notes || null,
      resolved_at: new Date().toISOString(),
    }),
  });
  return { ok: true };
}

// ── Entrypoint ───────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'POST only' }, 405);

  let body: Record<string, any>;
  try { body = await req.json(); }
  catch { return json({ error: 'invalid json' }, 400); }

  const password = String(body.password || '');
  if (!password || password !== Deno.env.get('ADMIN_PASSWORD')) {
    return json({ error: 'unauthorized' }, 401);
  }

  try {
    const action = String(body.action || '');
    switch (action) {
      case 'list_pending':       return json({ ok: true, rows: await listPending() });
      case 'list_reports':       return json({ ok: true, rows: await listReports() });
      case 'approve_submission': return json(await approveSubmission(body));
      case 'reject_submission':  return json(await rejectSubmission(body));
      case 'resolve_report':     return json(await updateReport(body, 'resolved'));
      case 'dismiss_report':     return json(await updateReport(body, 'dismissed'));
      default:                   return json({ error: 'unknown action: ' + action }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

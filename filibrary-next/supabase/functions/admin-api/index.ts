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
  // Match "...}\n] (as const)? ;" at end — preserve whatever trails the `]`.
  const re = /(\}\s*)\n?(\]\s*(?:as\s+const\s*)?;)\s*$/;
  if (!re.test(src.trimEnd())) {
    throw new Error('seed.ts format unexpected — could not find closing "];"');
  }
  return src.trimEnd().replace(re, `$1,\n${block}\n$2\n`);
}

// ── Editing existing filaments ───────────────────────────────────────────
// Finds the object in seed.ts with matching slug, returns [start, end] inclusive.
function filamentObjectBounds(src: string, slug: string): [number, number] {
  const marker = `"slug": "${slug}"`;
  const slugIdx = src.indexOf(marker);
  if (slugIdx === -1) throw new Error(`Filament not found in seed.ts: ${slug}`);
  let start = slugIdx;
  let depth = 0;
  for (let i = slugIdx; i >= 0; i--) {
    const c = src[i];
    if (c === '}') depth++;
    else if (c === '{') {
      if (depth === 0) { start = i; break; }
      depth--;
    }
  }
  let end = src.length;
  depth = 1;
  for (let i = start + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }
  return [start, end];
}

// Finds `"<key>": [` inside an object's bounds and returns [openBracket, closeBracket].
function innerArrayBounds(src: string, objStart: number, objEnd: number, key: string): [number, number] {
  const slice = src.slice(objStart, objEnd + 1);
  const re = new RegExp(`"${key}"\\s*:\\s*\\[`);
  const m = re.exec(slice);
  if (!m) throw new Error(`Key "${key}" not found`);
  const arrOpen = objStart + m.index + m[0].length - 1;
  let depth = 1;
  let arrClose = src.length;
  for (let i = arrOpen + 1; i < src.length; i++) {
    const c = src[i];
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) { arrClose = i; break; }
    }
  }
  return [arrOpen, arrClose];
}

function appendToArray(src: string, slug: string, key: string, entry: unknown): string {
  const [objStart, objEnd] = filamentObjectBounds(src, slug);
  const [arrOpen, arrClose] = innerArrayBounds(src, objStart, objEnd, key);
  const entryJsonStr = JSON.stringify(entry, null, 2);
  // Inner array entries sit at 6-space indent in this file's layout.
  const indented = entryJsonStr.split('\n').map((l) => '      ' + l).join('\n');
  const inner = src.slice(arrOpen + 1, arrClose);
  const hasEntries = inner.trim().length > 0;
  const replacement = hasEntries
    ? `${src.slice(arrOpen, arrClose).replace(/\s*$/, '')},\n${indented}\n    `
    : `[\n${indented}\n    `;
  return src.slice(0, arrOpen) + replacement + src.slice(arrClose);
}

// Reads and JSON-parses the contents of an inner array like "tags": [...].
function readInnerArray<T = unknown>(src: string, slug: string, key: string): T[] {
  const [objStart, objEnd] = filamentObjectBounds(src, slug);
  const [arrOpen, arrClose] = innerArrayBounds(src, objStart, objEnd, key);
  const inner = src.slice(arrOpen, arrClose + 1);
  try { return JSON.parse(inner) as T[]; } catch { return []; }
}

// Replaces the contents of an inner array entirely (used for stats).
function replaceArray(src: string, slug: string, key: string, items: unknown[]): string {
  const [objStart, objEnd] = filamentObjectBounds(src, slug);
  const [arrOpen, arrClose] = innerArrayBounds(src, objStart, objEnd, key);
  if (items.length === 0) {
    return src.slice(0, arrOpen) + '[]' + src.slice(arrClose + 1);
  }
  const body = items
    .map((it) => JSON.stringify(it, null, 2).split('\n').map((l) => '      ' + l).join('\n'))
    .join(',\n');
  return src.slice(0, arrOpen) + `[\n${body}\n    ]` + src.slice(arrClose + 1);
}

// Replaces a string-valued field like "statsSource": "...".
function replaceStringField(src: string, slug: string, key: string, value: string): string {
  const [objStart, objEnd] = filamentObjectBounds(src, slug);
  const slice = src.slice(objStart, objEnd + 1);
  const re = new RegExp(`("${key}"\\s*:\\s*)(null|"(?:[^"\\\\]|\\\\.)*")`);
  const m = re.exec(slice);
  if (!m) {
    // Key doesn't exist — insert before closing brace, preserving trailing comma semantics.
    const insertAt = objEnd; // position of closing `}`
    const insertion = `,\n    "${key}": ${JSON.stringify(value)}\n  `;
    // Find last non-whitespace before `}`; if it's a comma, skip leading comma.
    let j = insertAt - 1;
    while (j > objStart && /\s/.test(src[j])) j--;
    const needsLeadingComma = src[j] !== ',' && src[j] !== '{';
    const ins = needsLeadingComma ? insertion : insertion.replace(/^,\n/, '\n');
    return src.slice(0, insertAt) + ins + src.slice(insertAt);
  }
  const abs = objStart + m.index;
  return src.slice(0, abs) + m[1] + JSON.stringify(value) + src.slice(abs + m[0].length);
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
async function listContributions() {
  return sb('/filament_contributions?status=eq.pending&order=created_at.desc');
}

async function applyContribution(body: Record<string, any>) {
  const id = String(body.contribution_id || '');
  if (!id) throw new Error('contribution_id required');
  const type = String(body.type || '');
  const slug = String(body.filament_slug || '');
  if (!slug) throw new Error('filament_slug required');
  const payload = body.payload || {};

  const repo   = need('GITHUB_REPO');
  const branch = need('GITHUB_BRANCH');
  const path   = need('SEED_PATH');
  const cur = await gh(
    `/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`
  );
  const src = b64decode(cur.content);
  let next = src;
  let commitMsg = '';

  if (type === 'vendor') {
    const label = String(payload.label || '').trim();
    const url   = String(payload.url   || '').trim();
    if (!url) throw new Error('vendor url required');
    next = appendToArray(src, slug, 'purchaseLinks', { label: label || url, url });
    commitMsg = `Add vendor "${label || url}" to ${slug}`;
  } else if (type === 'video') {
    const title = String(payload.title || '').trim();
    const url   = String(payload.url   || '').trim();
    const thumb = String(payload.thumbnailUrl || '').trim();
    if (!url) throw new Error('video url required');
    next = appendToArray(src, slug, 'videoReferences', {
      title: title || url,
      url,
      thumbnailUrl: thumb,
    });
    commitMsg = `Add video reference to ${slug}`;
  } else if (type === 'stats') {
    const stats = Array.isArray(payload.stats) ? sanitizeStats(payload.stats) : [];
    if (stats.length !== 6) throw new Error('stats must have all 6 values');
    next = replaceArray(src, slug, 'stats', stats);
    const source = String(payload.statsSource || '').trim();
    if (source) next = replaceStringField(next, slug, 'statsSource', source);
    commitMsg = `Update performance ratings for ${slug}`;
  } else if (type === 'tags') {
    const incoming = Array.isArray(payload.tags)
      ? payload.tags.map((t: unknown) => String(t).trim()).filter((t: string) => t.length > 0)
      : [];
    if (incoming.length === 0) throw new Error('tags required');
    const existing = readInnerArray<string>(src, slug, 'tags');
    const merged = existing.slice();
    incoming.forEach((t: string) => { if (!merged.includes(t)) merged.push(t); });
    if (merged.length === existing.length) {
      throw new Error('all suggested tags already on filament');
    }
    next = replaceArray(src, slug, 'tags', merged);
    const added = incoming.filter((t: string) => !existing.includes(t));
    commitMsg = `Add tags to ${slug}: ${added.join(', ')}`;
  } else if (type === 'note') {
    throw new Error('notes must be resolved manually — use dismiss_contribution or edit seed.ts directly');
  } else {
    throw new Error('unknown contribution type: ' + type);
  }

  if (next === src) throw new Error('no changes generated');
  await gh(`/repos/${repo}/contents/${encodeURIComponent(path)}`, {
    method: 'PUT',
    body: JSON.stringify({
      message: commitMsg,
      content: b64encode(next),
      sha: cur.sha,
      branch,
    }),
  });
  await sb(`/filament_contributions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'applied',
      applied_notes: body.applied_notes || null,
      applied_at: new Date().toISOString(),
    }),
  });
  return { ok: true };
}

async function dismissContribution(body: Record<string, any>) {
  const id = String(body.contribution_id || '');
  if (!id) throw new Error('contribution_id required');
  await sb(`/filament_contributions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'dismissed',
      applied_notes: body.applied_notes || null,
      applied_at: new Date().toISOString(),
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
      case 'list_pending':          return json({ ok: true, rows: await listPending() });
      case 'list_reports':          return json({ ok: true, rows: await listReports() });
      case 'list_contributions':    return json({ ok: true, rows: await listContributions() });
      case 'approve_submission':    return json(await approveSubmission(body));
      case 'reject_submission':     return json(await rejectSubmission(body));
      case 'resolve_report':        return json(await updateReport(body, 'resolved'));
      case 'dismiss_report':        return json(await updateReport(body, 'dismissed'));
      case 'apply_contribution':    return json(await applyContribution(body));
      case 'dismiss_contribution':  return json(await dismissContribution(body));
      default:                      return json({ error: 'unknown action: ' + action }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
});

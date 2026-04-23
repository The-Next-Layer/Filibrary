#!/usr/bin/env node
// Pick up images from ./raw-images/, resize them, and wire them into
// filibrary-next/lib/seed.ts.
//
// Usage:
//   npm run hero:fetch              # process everything in raw-images/
//   npm run hero:fetch -- --dry-run # report what would happen, change nothing
//   npm run hero:fetch -- --only pla,petg
//
// Filename convention: the part before the extension must match a slug
// exactly (lowercase, hyphens preserved). e.g. `pla.jpg`, `abs-cf.png`,
// `petg-ultra-glow.webp`. Supported extensions: jpg, jpeg, png, webp, avif.
//
// Optional credit info lives in scripts/hero-images.json — you only need
// to fill in slugs you want a visible photo credit on.

import { readFile, readdir, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';

const execFileP = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');

const CONFIG_PATH = join(__dirname, 'hero-images.json');
const SEED_PATH   = join(ROOT, 'filibrary-next', 'lib', 'seed.ts');
const RAW_DIR     = join(ROOT, 'raw-images');
const IMG_DIR     = join(ROOT, 'public', 'filaments');
const PUBLIC_PATH = (slug) => `/filaments/${slug}.jpg`;

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 82;
const VALID_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

// Friendly brand names for known hostnames. Anything not in this map
// falls back to a title-cased version of the second-to-last DNS label.
const HOSTNAME_ALIASES = {
  'polymaker.com':       'Polymaker',
  'shop.polymaker.com':  'Polymaker',
  'us.polymaker.com':    'Polymaker',
  'prusa3d.com':         'Prusament',
  'www.prusa3d.com':     'Prusament',
  'prusa3d.de':          'Prusament',
  'sunlu.com':           'SUNLU',
  'www.sunlu.com':       'SUNLU',
  '3dxtech.com':         '3DXTech',
  'www.3dxtech.com':     '3DXTech',
  'matterhackers.com':   'MatterHackers',
  'www.matterhackers.com': 'MatterHackers',
  'printables.com':      'Printables',
  'www.printables.com':  'Printables',
  'makerworld.com':      'MakerWorld',
  'www.makerworld.com':  'MakerWorld',
  'amazon.com':          'Amazon',
  'www.amazon.com':      'Amazon',
  'bambulab.com':        'Bambu Lab',
  'us.store.bambulab.com': 'Bambu Lab',
  'reddit.com':          'Reddit',
  'i.redd.it':           'Reddit',
  'fiberlogy.com':       'Fiberlogy',
  'overture3d.com':      'Overture',
  'hatchbox3d.com':      'HATCHBOX',
};

function hostnameToBrand(host) {
  if (!host) return '';
  if (HOSTNAME_ALIASES[host]) return HOSTNAME_ALIASES[host];
  const bare = host.replace(/^www\./, '');
  if (HOSTNAME_ALIASES[bare]) return HOSTNAME_ALIASES[bare];
  const labels = bare.split('.');
  const label  = labels.length >= 2 ? labels[labels.length - 2] : labels[0];
  return label.charAt(0).toUpperCase() + label.slice(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const onlyIdx = args.indexOf('--only');
const ONLY    = onlyIdx >= 0 ? args[onlyIdx + 1]?.split(',').map((s) => s.trim()).filter(Boolean) : null;

function extractSlugs(seed) {
  const re = /"slug":\s*"([^"]+)"/g;
  const out = new Set();
  let m;
  while ((m = re.exec(seed))) out.add(m[1]);
  return out;
}

function patchSeed(seed, slug, { heroImageUrl, heroImageCreditLabel, heroImageCreditUrl }) {
  const slugRe = new RegExp(`("slug":\\s*"${slug}"[\\s\\S]*?)` +
    `"heroImageUrl":\\s*"[^"]*",\\s*` +
    `"heroImageCreditLabel":\\s*"[^"]*",\\s*` +
    `"heroImageCreditUrl":\\s*"[^"]*"`);
  const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const replacement = `$1"heroImageUrl": "${esc(heroImageUrl)}",\n    ` +
    `"heroImageCreditLabel": "${esc(heroImageCreditLabel)}",\n    ` +
    `"heroImageCreditUrl": "${esc(heroImageCreditUrl)}"`;
  if (!slugRe.test(seed)) {
    throw new Error(`could not locate hero fields for slug "${slug}" in seed.ts`);
  }
  return seed.replace(slugRe, replacement);
}

async function dirExists(path) {
  try { const s = await stat(path); return s.isDirectory(); } catch { return false; }
}

// On macOS, files saved from Safari/Chrome carry a
// kMDItemWhereFroms xattr containing the source URL(s).
// Returns { pageUrl, imageUrl } if detectable, else {}.
async function readWhereFrom(filePath) {
  if (process.platform !== 'darwin') return {};
  try {
    const { stdout } = await execFileP('mdls', ['-raw', '-name', 'kMDItemWhereFroms', filePath], {
      timeout: 5000,
    });
    if (!stdout || stdout.trim() === '(null)') return {};
    const urls = [...stdout.matchAll(/"([^"]+)"/g)].map((m) => m[1]).filter(Boolean);
    if (urls.length === 0) return {};
    // Browsers typically write two entries: [imageUrl, pageUrl] or [pageUrl, imageUrl].
    // Prefer a non-image URL as the credit link (i.e. the page the user was on).
    const isImage = (u) => /\.(jpe?g|png|gif|webp|avif|svg|heic)(\?|$)/i.test(u);
    const pageUrl  = urls.find((u) => !isImage(u)) || urls[0];
    const imageUrl = urls.find((u) =>  isImage(u)) || null;
    return { pageUrl, imageUrl };
  } catch {
    return {};
  }
}

async function main() {
  if (!await dirExists(RAW_DIR)) {
    console.error(`\n  raw-images/ folder not found.\n`);
    console.error(`  Create it and drop your images there (named <slug>.jpg etc.), then re-run.`);
    console.error(`  Expected path: ${RAW_DIR}\n`);
    process.exit(1);
  }

  const configRaw = await readFile(CONFIG_PATH, 'utf8').catch(() => '{}');
  const config    = JSON.parse(configRaw);
  let   seed      = await readFile(SEED_PATH, 'utf8');
  const validSlugs = extractSlugs(seed);

  if (!DRY_RUN) await mkdir(IMG_DIR, { recursive: true });

  const files = (await readdir(RAW_DIR))
    .filter((f) => VALID_EXT.has(extname(f).toLowerCase()))
    .filter((f) => !f.startsWith('.'));

  if (files.length === 0) {
    console.log(`\nNo images found in raw-images/. Drop some files there first.\n`);
    console.log(`Filename = slug. e.g. pla.jpg, abs-cf.png, petg-ultra-glow.webp\n`);
    return;
  }

  const results = { ok: [], unknown: [], failed: [] };

  for (const file of files) {
    const slug = basename(file, extname(file)).toLowerCase();
    if (ONLY && !ONLY.includes(slug)) continue;

    if (!validSlugs.has(slug)) {
      console.warn(`[${file}] SKIP unknown slug "${slug}"`);
      results.unknown.push(file);
      continue;
    }

    const src  = join(RAW_DIR, file);
    const dest = join(IMG_DIR, `${slug}.jpg`);

    process.stdout.write(`[${slug}] ${file} → public/filaments/${slug}.jpg\n`);

    if (!DRY_RUN) {
      try {
        await sharp(src)
          .rotate()
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
          .toFile(dest);
      } catch (err) {
        console.error(`  FAIL ${err.message}`);
        results.failed.push({ slug, error: err.message });
        continue;
      }
    }

    const cfg     = config[slug] || {};
    const source  = await readWhereFrom(src);
    const autoUrl = source.pageUrl || '';
    let   autoLabel = '';
    if (autoUrl) {
      try { autoLabel = hostnameToBrand(new URL(autoUrl).hostname); } catch {}
    }

    const creditLabel = cfg.credit    ?? autoLabel;
    const creditUrl   = cfg.creditUrl ?? autoUrl;

    if (autoUrl && !cfg.credit && !cfg.creditUrl) {
      console.log(`  auto-credit: ${creditLabel} (${autoUrl})`);
    }

    try {
      seed = patchSeed(seed, slug, {
        heroImageUrl:         PUBLIC_PATH(slug),
        heroImageCreditLabel: creditLabel,
        heroImageCreditUrl:   creditUrl,
      });
      results.ok.push(slug);
    } catch (err) {
      console.error(`  SEED PATCH FAIL ${err.message}`);
      results.failed.push({ slug, error: err.message });
    }
  }

  if (!DRY_RUN) await writeFile(SEED_PATH, seed, 'utf8');

  console.log('');
  console.log(`ok:      ${results.ok.length}`);
  console.log(`unknown: ${results.unknown.length}${results.unknown.length ? '  (filename didn\'t match any slug — typo?)' : ''}`);
  console.log(`failed:  ${results.failed.length}`);
  if (results.unknown.length) {
    console.log('');
    for (const f of results.unknown) console.log(`  - ${f}`);
  }
  if (results.failed.length) {
    console.log('');
    for (const f of results.failed) console.log(`  - ${f.slug}: ${f.error}`);
  }
  if (DRY_RUN) console.log('\n(dry run — no files written, no seed patched)');
}

main().catch((err) => { console.error(err); process.exit(1); });

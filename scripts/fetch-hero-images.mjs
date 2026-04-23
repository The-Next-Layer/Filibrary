#!/usr/bin/env node
// Download, resize, and self-host hero images for filaments, then patch
// filibrary-next/lib/seed.ts with the resulting URLs and credits.
//
// Usage:
//   npm run hero:fetch              # download new images + patch seed.ts
//   npm run hero:fetch -- --dry-run # report what would happen, change nothing
//   npm run hero:fetch -- --force   # redownload even if local file exists
//   npm run hero:fetch -- --only pla,petg  # only process these slugs
//
// Config lives at scripts/hero-images.json. Fill in `url` for each slug you
// want an image for. `credit` and `creditUrl` are optional — if omitted, the
// script guesses the credit from the hostname of `url`.

import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = join(__dirname, '..');

const CONFIG_PATH = join(__dirname, 'hero-images.json');
const SEED_PATH   = join(ROOT, 'filibrary-next', 'lib', 'seed.ts');
const IMG_DIR     = join(ROOT, 'public', 'filaments');
const PUBLIC_PATH = (slug) => `/filaments/${slug}.jpg`;

const MAX_WIDTH = 1200;
const JPEG_QUALITY = 82;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const FORCE   = args.includes('--force');
const onlyIdx = args.indexOf('--only');
const ONLY    = onlyIdx >= 0 ? args[onlyIdx + 1]?.split(',').map((s) => s.trim()).filter(Boolean) : null;

function guessCredit(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const base = host.split('.').slice(-2, -1)[0] || host;
    return base.charAt(0).toUpperCase() + base.slice(1);
  } catch { return ''; }
}

async function fileExists(path) {
  try { await stat(path); return true; } catch { return false; }
}

async function downloadAndResize(sourceUrl, destPath) {
  const res = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .rotate()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(destPath);
}

function patchSeed(seed, slug, { heroImageUrl, heroImageCreditLabel, heroImageCreditUrl }) {
  // Find the block starting at this slug and replace its three hero fields.
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

async function main() {
  const configRaw = await readFile(CONFIG_PATH, 'utf8');
  const config    = JSON.parse(configRaw);
  let   seed      = await readFile(SEED_PATH, 'utf8');

  if (!DRY_RUN) await mkdir(IMG_DIR, { recursive: true });

  const results = { ok: [], skipped: [], failed: [] };

  const entries = Object.entries(config)
    .filter(([slug, cfg]) => cfg && cfg.url)
    .filter(([slug])     => !ONLY || ONLY.includes(slug));

  for (const [slug, cfg] of entries) {
    const destPath   = join(IMG_DIR, `${slug}.jpg`);
    const alreadyHas = await fileExists(destPath);
    const action     = alreadyHas && !FORCE ? 'skip-download' : 'download';

    process.stdout.write(`[${slug}] ${action} ${cfg.url}\n`);

    if (action === 'download') {
      if (DRY_RUN) {
        results.ok.push(slug);
      } else {
        try {
          await downloadAndResize(cfg.url, destPath);
          results.ok.push(slug);
        } catch (err) {
          console.error(`  FAIL ${err.message}`);
          results.failed.push({ slug, error: err.message });
          continue;
        }
      }
    } else {
      results.skipped.push(slug);
    }

    const creditLabel = cfg.credit    ?? guessCredit(cfg.url);
    const creditUrl   = cfg.creditUrl ?? cfg.url;

    try {
      seed = patchSeed(seed, slug, {
        heroImageUrl:         PUBLIC_PATH(slug),
        heroImageCreditLabel: creditLabel,
        heroImageCreditUrl:   creditUrl,
      });
    } catch (err) {
      console.error(`  SEED PATCH FAIL ${err.message}`);
      results.failed.push({ slug, error: err.message });
    }
  }

  if (!DRY_RUN) await writeFile(SEED_PATH, seed, 'utf8');

  console.log('');
  console.log(`ok:      ${results.ok.length}`);
  console.log(`skipped: ${results.skipped.length}`);
  console.log(`failed:  ${results.failed.length}`);
  if (results.failed.length) {
    console.log('');
    for (const f of results.failed) console.log(`  - ${f.slug}: ${f.error}`);
  }
  if (DRY_RUN) console.log('\n(dry run — no files written, no seed patched)');
}

main().catch((err) => { console.error(err); process.exit(1); });

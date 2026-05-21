# Contributing to Filibrary

Thanks for wanting to help. Filibrary is a community resource and there's a lot it doesn't know yet.

## The two ways to contribute

### 1. From the live site (no GitHub needed)

- **Suggest an edit** on any filament page — add a vendor, link a YouTube review, rate the material's properties, fix tags, or leave a free-text note.
- **Report an issue** if something is plain wrong (broken link, outdated info, wrong classification).
- **Submit a new filament** at [filibrary.thenextlayer.com/submit](https://filibrary.thenextlayer.com/submit).

Everything funnels into a moderation queue and gets reviewed manually.

### 2. From GitHub (PRs)

For anything bigger than a one-off correction — a new filament, a chunk of vendor cleanup, a UI tweak — open a pull request.

```bash
git clone https://github.com/The-Next-Layer/filibrary.git
cd filibrary
npm install
npm run dev
```

Then:

1. Branch off `main`.
2. Make your change.
3. `npm run build` to confirm it still compiles.
4. Open a PR against `main` with a one-sentence description of the why.

## Where the data lives

All filament data is in **`filibrary-next/lib/seed.ts`** — one large TypeScript array. Each entry has the same shape; copy an existing one as your template.

The optional `related` field is a list of slugs that should always appear in the "Related materials" list for that filament (e.g. PETG → PCTG). The relationship is symmetric — you only need to add it on one side.

## What we care about in PRs

- **Accuracy over completeness.** A short, correct summary beats a long, speculative one.
- **Cite where you got non-obvious facts.** TDS PDFs, manufacturer specs, or well-known YouTube tests are all fine.
- **No affiliate spam.** Vendor links are welcome; pure referral-only sites or low-quality dropshippers will be removed.

## What's out of scope

- Branded reviews. Filibrary describes *materials* (PETG, PA-CF, etc.), not individual brand spools — unless the spool is a distinct material in its own right (e.g. Polymaker Fishy PA6).
- Print profile dumps. Settings are too printer-specific; a one-line "needs an enclosure" is the right level.

## Questions

Open an issue — happy to chat through anything before you start a big change.

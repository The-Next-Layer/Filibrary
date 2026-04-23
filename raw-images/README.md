# Drop filament hero images here

Save images (from manufacturer sites, Google Images, wherever) into this
folder, using the **filament slug** as the filename.

## Naming

Filename = slug. Extension can be `.jpg`, `.jpeg`, `.png`, `.webp`, or `.avif`.

| Filament          | Slug               | Filename example         |
| ----------------- | ------------------ | ------------------------ |
| PLA               | `pla`              | `pla.jpg`                |
| PLA-CF            | `pla-cf`           | `pla-cf.jpg`             |
| PETG Ultra Glow   | `petg-ultra-glow`  | `petg-ultra-glow.png`    |
| ABS-Kevlar        | `abs-kevlar`       | `abs-kevlar.webp`        |

If you're not sure of a slug, look in `scripts/hero-images.json` — all 61 are listed.

## How to save an image from Safari

1. Open a manufacturer product page (Polymaker, Prusament, etc.) or do a Google image search.
2. Find a photo of a printed part.
3. Right-click → **"Save Image As..."**
4. Change the filename to the slug (e.g. `pla.jpg`) and save it into this folder.

## Then run

From the project root:

```bash
npm run hero:fetch
```

The script will:
- Resize each image to max 1200px wide
- Save as JPEG at `public/filaments/<slug>.jpg`
- Wire the path into `filibrary-next/lib/seed.ts`

You can process a single slug at a time: `npm run hero:fetch -- --only pla`

## Optional: photo credit

If you want "Photo: Polymaker" to appear under an image, open
`scripts/hero-images.json` and fill in the `credit` and `creditUrl`
fields for that slug. Skip this if you don't care — the image still
displays fine without credit.

## Notes

- The original files in this folder are kept (not deleted) in case you want to re-run.
- This folder is `.gitignore`d — originals aren't committed, only the resized JPEG output in `public/filaments/`.

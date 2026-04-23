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

## Photo credit (automatic on macOS)

When you save an image from Safari or Chrome via **Save Image As...**,
macOS automatically tags the file with the URL it came from. The script
reads that tag and auto-populates the credit, so you'll see something
like this under each image on the detail page:

> Image courtesy of [Polymaker](https://polymaker.com/product/polylite-pla/)

You'll see the detected credit in the script output:

```
[pla] pla.jpg → public/filaments/pla.jpg
  auto-credit: Polymaker (https://polymaker.com/product/polylite-pla/)
```

### Overriding the auto-credit

If the script guesses the wrong brand name (or you want a custom
label), open `scripts/hero-images.json` and fill in the `credit` and/or
`creditUrl` fields for that slug. Anything set there wins over the
auto-detected value.

### When it won't work

Auto-credit relies on the `kMDItemWhereFroms` macOS extended attribute.
It will be empty if:

- You copied the file from somewhere else (no web origin)
- You used a non-macOS machine to save it
- You used "Save As" from an app that doesn't set that tag

In those cases the credit line simply won't appear. Fill in
`hero-images.json` manually if you want one.

## Notes

- The original files in this folder are kept (not deleted) in case you want to re-run.
- This folder is `.gitignore`d — originals aren't committed, only the resized JPEG output in `public/filaments/`.

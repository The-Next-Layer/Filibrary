# Hero image script

Wires images from `raw-images/` into filament detail pages.

## One-time setup

```bash
npm install   # installs sharp
```

## Workflow

1. Save an image from any source (Polymaker product page, Google Images, your own photo) into the `raw-images/` folder at the project root.
2. Name the file with the filament slug as the basename: `pla.jpg`, `abs-cf.png`, `petg-ultra-glow.webp`.
3. Run the script from the project root:

   ```bash
   npm run hero:fetch                      # process all files in raw-images/
   npm run hero:fetch -- --dry-run         # preview only, no writes
   npm run hero:fetch -- --only pla,petg   # only these slugs
   ```

4. The script resizes each image to max 1200px wide JPEG (quality 82) at `public/filaments/<slug>.jpg`, then patches the three hero fields in `filibrary-next/lib/seed.ts`.
5. Run `npm run dev` and spot-check a few pages. Commit when happy.

## Optional photo credit

Edit `scripts/hero-images.json` to add `credit` and `creditUrl` for any slug. If left blank, the image still displays but with no attribution line under it.

```json
"pla": { "credit": "Polymaker", "creditUrl": "https://polymaker.com/product/polylite-pla/" }
```

## Troubleshooting

- **"unknown slug"** in the output → filename doesn't match any slug. Check spelling against `scripts/hero-images.json`.
- **Image looks stretched or oddly cropped** on the detail page → the template uses `aspect-ratio: 16/9; object-fit: cover`. For best results, pick source images that are roughly landscape. Portrait-oriented sources will get center-cropped.
- **Script crashed on a file** → sharp couldn't decode it. Re-save as JPEG or PNG.

## What gets committed

- `public/filaments/<slug>.jpg` (the resized output) — yes, committed
- `raw-images/*` — **no**, gitignored. Originals stay on your machine.
- `filibrary-next/lib/seed.ts` changes — yes, committed

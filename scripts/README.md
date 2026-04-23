# Hero image fetcher

Self-hosts and wires up filament hero images.

## Workflow

1. Browse to a manufacturer product page (Polymaker, Prusament, etc.).
2. Right-click a sample print photo → **Copy Image Address**.
3. Open `scripts/hero-images.json` and paste the URL into the matching slug:

   ```json
   "pla": {
     "url":       "https://cdn.shopify.com/.../polylite-pla-print.jpg",
     "credit":    "Polymaker",
     "creditUrl": "https://polymaker.com/product/polylite-pla/"
   }
   ```

   `credit` and `creditUrl` are optional — if blank, the script guesses
   the credit from the hostname of `url` and uses `url` itself as the
   credit link.

4. Run the script (one time setup: `npm install`, which pulls in `sharp`):

   ```bash
   npm run hero:fetch                    # full run
   npm run hero:fetch -- --dry-run       # preview, no writes
   npm run hero:fetch -- --only pla,abs  # scope to specific slugs
   npm run hero:fetch -- --force         # redownload even if cached
   ```

5. The script:
   - Downloads each image
   - Resizes to max 1200px wide, JPEG quality 82
   - Writes it to `public/filaments/<slug>.jpg`
   - Patches `filibrary-next/lib/seed.ts` to set `heroImageUrl`,
     `heroImageCreditLabel`, and `heroImageCreditUrl` for that slug

6. Review the diff, run `npm run dev`, spot-check a few pages, then commit.

## Tips

- You can fill in a few slugs at a time and rerun — already-downloaded
  images are skipped unless you pass `--force`.
- If a manufacturer blocks hotlinking on their CDN, the script will
  report an HTTP error for that slug and move on. Try a different source
  (retailer listing, Matterhackers, etc.) or a direct-upload URL.
- To remove an image, delete `public/filaments/<slug>.jpg` and manually
  blank out the three hero fields in `seed.ts`.

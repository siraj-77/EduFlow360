# Self-hosted font subsets — `FIX-12`

**Status:** not started. Created 2026-10-11 by `ADR-022` (the approved font
stack) so the follow-up has a home and a spec.

## What belongs here

`@font-face` declarations plus the range-subset `.woff2` files for the four
families `ADR-022` approves:

| Family | Script | Typical subset |
|---|---|---|
| Noto Sans | Latin | `U+0000-00FF, U+0131, U+0152-0153, U+2000-206F` |
| Noto Sans Tamil | `ta` | the Tamil block plus the Latin supplement Tamil-text needs |
| Noto Sans Sinhala | `si` | the Sinhala block |
| Noto Naskh Arabic | `ar` | the Arabic block (no presentation forms — text uses the joining forms) |

## What must be true before this is "done"

1. **The screen stack still renders.** The delivery decision in `ADR-022` is
   system-first; this directory is the FALLBACK for a machine whose OS has no
   coverage. Adding it must not change which family wins on a machine that
   already has one — hence `local()` sources first, where each family
   supports them.
2. **The PDF stack is proven separately.** Headless Chromium and
   PDFKit/Handlebars embed by different mechanisms, and a render host without
   the font installed is invisible to both. That proof belongs to the
   Document/Print engine (milestone 2), not to this directory.
3. **The acceptance criterion `DSN-04` originally wrote is met**: proof of
   coverage for all four scripts, on screen and in the PDF pipeline.

## How to subset

```bash
# pyftsubset (fonttools) keeps only the blocks the UI actually renders.
pyftsubset NotoSans.ttf --output-file=noto-sans-latin.woff2 \
  --flavor=woff2 --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+2000-206F"
```

## Why this is not in the repository yet

`ADR-022` chose system-first delivery as the DEFAULT and recorded the
accepted cost (a machine with no coverage for a script shows tofu). Shipping
this directory without the per-script proof would have been the
"declaration only" failure the decision was written to avoid — so the
directory, this README, and `FIX-12` exist as the visible remainder.

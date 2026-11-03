# IDWQ — improvements-v2 development branch

This branch is for testing changes separately from the production `master` branch.

## Implemented changes

- `js/downloads.js`: district-aware measurement downloads, with a fallback to the original `data/WQ_SiteData.json` if partitions are not yet generated. Full downloads still use the original source.
- `py/split_site_data.py`: creates `data/siteData/<district>.json` and a `manifest.json`. No ArcPy required.
- `.github/workflows/build-district-data.yml`: validates and commits generated partitions **to improvements-v2 only**; can also be started manually through GitHub Actions.
- CSV export uses consistent escaping for commas, quotes, and newlines (including WQ index and metadata rows).
- HTTP error checks and user-visible download status.
- Keyboard-focusable site list buttons and collapsible header, with escaped text.
- Data-tab status shows the partition generation date once a manifest exists. This is **not** a source observation or measurement date.

## Current generated-data status

The updated build completed successfully on November 3, 2026 (UTC). The manifest reports **5,395 measurement records**, divided into **12 district files**, with **0 unknown records** and **0 multi-district records**. The splitting script now uses each laboratory record's `IrrDist` value first, consulting `data/WQ_Sites.geojson` (matched on `Site`/`SiteName`) only when that field is missing. `WQ_Sites_Merged.json` is no longer a dependency of the partition generator. The obsolete `UNKNOWN.json` was removed. The full dataset remains unchanged; filtered-site exports still follow the map's selected site list.

## Generate partitions

Run from the repository root:

```bash
python py/split_site_data.py
python -m http.server 8000
```

Or in GitHub, select **Actions → Build IDWQ district measurement files → Run workflow** using the `improvements-v2` branch. This generates and commits the district files only if Actions is permitted to write to this branch. The workflow may need to be enabled by the repository owner.

Check the printed source and partition counts, and investigate any unknown or ambiguous district values. The generator never alters the canonical full dataset and removes obsolete generated partitions from `data/siteData/`.

## Test checklist

- Open `http://localhost:8000/app.html` and verify the map, site popups, district and year filters.
- Under **Data**, choose one district, export measurements, and compare its row count and contents to a filtered export from the canonical full dataset.
- From a map popup, export one site; try both a known site and a site with punctuation in its name.
- Choose **All Sites (including Sites Not on Map)**; verify that its CSV contains unmatched source records.
- Export Water Quality Index CSV and verify that field values with commas/quotes open in spreadsheet applications without shifting columns.
- Use Tab / Shift+Tab / Enter to navigate site buttons and the collapse control; check focus and zoom behaviour.
- Temporarily rename `data/siteData/manifest.json` locally and verify district export still works through the full-file fallback.
- Verify no JavaScript errors in the browser console. Recheck download behaviour on a narrow/mobile screen.

## Deployment and limitations

The current GitHub Pages URL publishes from **master** and has **not** been changed. Branch code is not a live v2 test site until a separate preview is configured.

The main bottleneck remains until the generated `data/siteData/` files are committed and served. Full and all-district downloads will still fetch the original ~34.8 MB JSON. This is intentional to preserve the complete record set, including sites absent from the map.

The preparation timestamp is not a claim about the freshness of water-quality measurements; source-date metadata would need to be added separately and verified.

Do not merge this branch into `master` until the generated partition files and exports have been verified.

## Browser smoke tests (GitHub Actions)

A real headless Chromium test is available at `tests/browser-smoke.cjs`, executed by `.github/workflows/browser-smoke.yml`. It starts a local HTTP server on the checked-out development branch. The first run exposed an issue where the map was hidden below a 640px viewport; `css/style.css` now stacks the side panel and map on narrow screens.

**Verified in GitHub Actions run 41583727049:**
- Application startup and Leaflet map markers
- Keyboard activation of Data tab and site zoom controls
- BRID download fetches `data/siteData/BRID.json` rather than the full file
- Full-data CSV download still uses `data/WQ_SiteData.json`
- WQ Index CSV export
- Map visibility at 390px mobile viewport
- No uncaught browser JavaScript errors

[Latest passing browser workflow](https://github.com/jinkaizhang-gov/IDWQ-web/actions/runs/41583727049)

**Limitations:** These automated checks use a local server on a GitHub runner, not a public V2 GitHub Pages deployment. They verify primary behaviours, but do not replace manual visual review of every layout, browser, popup, and exported record. The source records are still 5,395 across the 12 generated district partitions.

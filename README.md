# Irrigation District Water Quality (IDWQ) — V2 Preview

A static web application for exploring Alberta irrigation-district water-quality monitoring sites, viewing Water Quality (WQ) Index results, and downloading laboratory measurement data.

This repository is the **independent V2 preview** copied from the tested `improvements-v2` branch of [IDWQ-web](https://github.com/jinkaizhang-gov/IDWQ-web). It lets the updated application be tested without changing the original production site.

## Websites

| Environment | URL | Repository / branch |
| --- | --- | --- |
| V1 production | https://jinkaizhang-gov.github.io/IDWQ-web/ | `IDWQ-web` / `master` |
| V2 preview | https://jinkaizhang-gov.github.io/IDWQ-web-v2/ | `IDWQ-web-v2` / `main` |

**Note:** The V2 URL works only after GitHub Pages has been enabled and its deployment succeeds. Copying the files into the repository does not automatically confirm Pages is active.

## What's improved in V2

- **Smaller district downloads:** Laboratory data are partitioned by irrigation district, so selecting a district downloads its smaller JSON file rather than fetching the entire source dataset.
- **Complete exports remain available:** The full measurement-data download continues to read `data/WQ_SiteData.json`; this includes records from sites not represented on the map.
- **Robust CSV exports:** Handles commas, quotation marks, and newlines in measurement and WQ Index values.
- **Error handling and status:** Reports data-loading and download issues, and shows the preparation date of partition files (not the underlying water-quality observation date).
- **Accessibility:** Keyboard-operable tabs, site buttons, and side-panel controls.
- **Responsive layout:** On narrow screens the data panel and Leaflet map stack vertically, keeping the map visible.

## Dataset and sources

The packaged dataset contains **5,395 measurement records** distributed across **12 district JSON files** with **0 unknown records**, verified against `data/siteData/manifest.json` when this preview was copied.

| File | Purpose |
| --- | --- |
| `data/WQ_SiteData.json` | Canonical, complete raw laboratory measurement dataset |
| `data/siteData/manifest.json` | District-to-file lookup, counts, and file-generation timestamp |
| `data/siteData/*.json` | Compact per-district measurement files |
| `data/WQ_Sites.geojson` | Monitoring-site information; fallback district lookup in the partition generator |
| `data/WQ_Sites_Merged.json` | Map site geometries, attributes and WQ Index records used by the web application |
| `data/ReportingAreas.json` | Reporting-area geographic features |
| `data/fieldJson.json` | Measurement-field labels, units, and guidelines |

**District assignment:** `py/split_site_data.py` uses the measurement record's `IrrDist` value first. When that value is missing, it matches `Site` to `SiteName` in `WQ_Sites.geojson`. Each measurement record is assigned to exactly one district. `WQ_Sites_Merged.json` is **not** used by the splitting script, but is still needed for the website map and WQ Index.

The partition generation timestamp is **not** the last sampling date or an assurance that laboratory results are up-to-date.

## Project structure

```text
IDWQ-web-v2/
├── index.html                  # Portal landing page
├── app.html                    # Leaflet map and data application
├── css/style.css               # Desktop and mobile styling
├── js/                         # JavaScript ES modules
│   ├── app.js                  # Application startup
│   ├── constants.js            # Source file paths, fields and map configuration
│   ├── downloads.js            # CSV exports and district-partition retrieval
│   ├── filters.js              # District/year selection
│   ├── dataTab.js              # Site list and keyboard-accessible zoom
│   └── tabs.js                 # Tab navigation and content loading
├── data/
│   ├── WQ_SiteData.json        # Full measurement dataset
│   ├── WQ_Sites.geojson        # Site lookup source for data generation
│   ├── WQ_Sites_Merged.json    # Site/map/WQ Index data
│   └── siteData/
│       ├── manifest.json      # District file manifest
│       └── *.json             # 12 generated district files
├── tabs/                       # Intro, Data, WQ Index and Publications tabs
├── images/                     # Logos and interface assets
├── sitePhotos/                 # Monitoring-site photographs
├── py/split_site_data.py       # Regenerate partitions (Python standard library)
├── tests/browser-smoke.cjs     # Playwright / Chromium smoke tests
└── README-V2.md                # Development notes and validation history
```

## Deploy the V2 preview using GitHub Pages

In this **IDWQ-web-v2** repository, open **Settings → Pages** and configure:

- **Source:** Deploy from a branch
- **Branch:** `main`
- **Folder:** `/ (root)`

Save, then check the **Actions** tab for the GitHub Pages build and deployment result. After a successful deployment, use the V2 preview URL above.

The repository is public; GitHub Pages content and the committed data are publicly accessible. Only publish information approved for public release.

## Run locally

The application uses `fetch()` for JSON and HTML. Serve the repository over HTTP instead of opening `index.html` as a `file://` URL:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/` for the landing page or `http://localhost:8000/app.html` for the tool.

Basemap tiles and some mapping libraries are requested from external services, so an internet connection is needed for the normal map experience.

## Regenerate measurement partitions

Run from the repository root:

```bash
python py/split_site_data.py
```

This updates `data/siteData/manifest.json` and the district JSON files, retains the original full dataset, and removes obsolete generated partitions. Verify that the manifest's district counts sum to `sourceRecords` and inspect any `unknownRecords` or ambiguous site matches before publishing an update.

Unlike the source development branch, **this preview repository does not include the copied browser-test or partition-generation GitHub Actions workflow definitions**. They were omitted during import due to GitHub workflow permission restrictions. The Python generator and the browser-test script themselves are included.

## Browser tests

The source V2 branch passed a real Chromium smoke test covering application and map startup, keyboard navigation, BRID district downloads, full-data CSV download, WQ Index CSV export, a 390px mobile viewport, and uncaught JavaScript errors.

[Successful source-branch browser test](https://github.com/jinkaizhang-gov/IDWQ-web/actions/runs/41583727049)

To run the same browser test manually from this repository:

```bash
npm install --no-save playwright@1.58.2
npx playwright install chromium
python -m http.server 8000
```

In a separate terminal:

```bash
node tests/browser-smoke.cjs
```

These automated checks supplement, but do not replace, reviewing the deployed preview in a browser and verifying downloaded records.

## Maintaining V1 and V2

- Make preview changes in `IDWQ-web-v2/main` or continue development in `IDWQ-web/improvements-v2` and explicitly sync approved changes here.
- Publishing or editing this repository does **not** automatically update the V1 production repository.
- Use relative file paths so the site works beneath the GitHub Pages project URL `/IDWQ-web-v2/`.
- Compare district exports with the canonical measurement file before releasing refreshed datasets.
- Do not copy private, licensed, or internal-only files into this public repository.

## Related repositories

- [IDWQ-web — original production and improvements-v2 branch](https://github.com/jinkaizhang-gov/IDWQ-web)
- [IDWQ-web-v2 — this independent preview repository](https://github.com/jinkaizhang-gov/IDWQ-web-v2)

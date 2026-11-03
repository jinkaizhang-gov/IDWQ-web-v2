"""Generate smaller IDWQ measurement files by irrigation district.

Run from the repository root:
    python py/split_site_data.py

Requires data/WQ_Sites.geojson and data/WQ_SiteData.json.
Does not remove the original full file. No ArcPy is required.
"""
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
OUT = DATA / "siteData"


def norm(value):
    return str(value or "").strip().upper()


def read_json(path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def main():
    sites = read_json(DATA / "WQ_Sites.geojson").get("features", [])
    measurements = read_json(DATA / "WQ_SiteData.json")
    features = measurements.get("features", [])
    by_site = defaultdict(set)
    for feature in sites:
        p = feature.get("properties") or {}
        name = norm(p.get("SiteName"))
        if name:
            by_site[name].add(norm(p.get("IrrDist")) or "UNKNOWN")

    # The laboratory records already provide IrrDist. Use it as authoritative,
    # with the site lookup only as a fallback for missing district values.
    shards = defaultdict(list)
    missing = 0
    fallback_count = 0
    ambiguous_count = 0
    for feature in features:
        p = feature.get("properties") or {}
        district = norm(p.get("IrrDist"))
        if not district:
            matches = {code for code in by_site.get(norm(p.get("Site")), set())
                       if code != "UNKNOWN"}
            if len(matches) == 1:
                district = next(iter(matches))
                fallback_count += 1
            elif len(matches) > 1:
                ambiguous_count += 1
        if not district:
            district = "UNKNOWN"
            missing += 1
        # Every source record goes to exactly one partition; never duplicate it.
        shards[district].append(feature)

    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceRecords": len(features),
        "unknownRecords": missing,
        "multiDistrictRecords": 0,
        "siteLookupFallbackRecords": fallback_count,
        "ambiguousSiteMatches": ambiguous_count,
        "districts": {},
    }
    used_files = set()
    for district in sorted(shards):
        stem = re.sub(r"[^A-Z0-9_-]+", "_", district).strip("_") or "UNKNOWN"
        filename = stem + ".json"
        if filename in used_files:
            raise ValueError("District filename collision: " + filename)
        used_files.add(filename)
        data = {"type": measurements.get("type", "FeatureCollection"),
                "features": shards[district]}
        with (OUT / filename).open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False, separators=(",", ":"))
        manifest["districts"][district] = {
            "file": filename,
            "records": len(shards[district]),
        }
        size = (OUT / filename).stat().st_size
        print("{}: {} records, {:.2f} MiB".format(
            district, len(shards[district]), size / (1024 * 1024)
        ))
    # Remove files from older runs that no longer represent an active district.
    # Only generated .json partition files in this dedicated folder are affected.
    for old_file in OUT.glob("*.json"):
        if old_file.name != "manifest.json" and old_file.name not in used_files:
            old_file.unlink()
            print("Removed stale partition:", old_file.name)

    assert sum(len(group) for group in shards.values()) == len(features), (
        "Partition records do not match the source count"
    )
    with (OUT / "manifest.json").open("w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2)

    print("Source records:", len(features))
    print("Unmatched records (UNKNOWN):", missing)
    print("District values recovered via site lookup:", fallback_count)
    print("Ambiguous site-name lookups:", ambiguous_count)
    if missing or ambiguous_count:
        print("Review unmatched/multi-district records before relying on partitions.")
    print("Manifest:", OUT / "manifest.json")


if __name__ == "__main__":
    main()

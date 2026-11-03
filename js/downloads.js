/**
 * downloads.js
 * ------------
 * CSV export functions:
 *  - WQ Index data (district-filtered, expanded rows)
 *  - Site measurement data (single site / district filtered / full)
 *  - Field metadata loading and CSV header helpers
 */

import { state } from "./state.js";
import {
    F_NAME, F_DIST, F_TYPE, F_STAT, F_YEAR, F_VALUE,
    F_SITEDATA_SITE_NAME, SERVICE_URL_SITEDATA,
} from "./constants.js";

function escapeCsvValue(value) { const v=value==null?"":String(value); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; }

function csvRow(cells) {return cells.map(escapeCsvValue).join(",");}

function safeFilePart(v) {return String(v??"ALL").replace(/[^a-z0-9_-]+/gi,"_").slice(0,90);}

function normalizeName(v) {return String(v??"").trim().toUpperCase();}

async function fetchJsonStrict(url) {const res=await fetch(url); if(!res.ok) throw new Error("HTTP "+res.status+" loading "+url); return res.json();}

async function loadMeasurementFeatures(district,isFullDownload) {
    if(isFullDownload || district==="ALL") return (await fetchJsonStrict(SERVICE_URL_SITEDATA)).features || [];
    try {
        const manifest=await fetchJsonStrict("data/siteData/manifest.json");
        const shard=manifest.districts?.[district]?.file;
        if(typeof shard==="string" && /^[A-Za-z0-9_-]+\.json$/.test(shard)) {
            return (await fetchJsonStrict("data/siteData/"+shard)).features || [];
        }
    } catch(err) {
        console.warn("District partition unavailable; using full dataset.",err);
    }
    return (await fetchJsonStrict(SERVICE_URL_SITEDATA)).features || [];
}

// ── Field metadata ────────────────────────────────────────────────────────────

export async function loadFieldMetadata() {
    try {
        state.fieldMeta = await fetchJsonStrict("data/fieldJson.json");
        console.log(`Loaded metadata for ${Object.keys(state.fieldMeta).length} fields`);
    } catch (e) {
        console.warn("Field metadata JSON not loaded. CSV will use raw field names.", e);
        state.fieldMeta = {};
    }
}

export function getHeaderName(field) {
    return state.fieldMeta[field]?.fieldName?.trim() || field;
}

export function getHeaderUnit(field) {
    return state.fieldMeta[field]?.units || "";
}

export function getHeaderGuideline(field) {
    return state.fieldMeta[field]?.guideline || "";
}

// ── WQ Index CSV export ───────────────────────────────────────────────────────

export function downloadWQIndexData() {
    const data=state.filtered || [];
    if(data.length===0) {alert("No data found for the current filter to export.");return;}
    const headings=["SiteName","IrrDist","SiteType","SiteStatus","IndexYear","IndexValue","Longitude","Latitude"];
    const rows=[];
    for(const f of data) {
        const p=f.properties || {};
        const coords=f.geometry?.coordinates || [null,null];
        const prefix=[p[F_NAME],p[F_DIST],p[F_TYPE],p[F_STAT]];
        const years=p.WQIndexRecords || [];
        if(!years.length) rows.push([...prefix,"","",coords[0],coords[1]]);
        else for(const r of years) rows.push([...prefix,r[F_YEAR],r[F_VALUE],coords[0],coords[1]]);
    }
    rows.sort((a,b)=>String(a[0]??"").localeCompare(String(b[0]??"")) || (Number(a[4])||0)-(Number(b[4])||0));
    const fname="IDWQ_Index_"+safeFilePart(state.currentDistrictValue || "ALL")+".csv";
    triggerCsvDownload([headings,...rows].map(csvRow).join("\r\n"),fname);
}

// ── Site measurement data export ──────────────────────────────────────────────

window.downloadSiteData = async function(singleSiteName=null,isFullDownload=false) {
    const statusEl=document.getElementById("dataDownloadStatus");
    if(statusEl) statusEl.textContent="Loading measurement data…";
    try {
        const district=normalizeName(state.currentDistrictValue || "ALL");
        const availableSites=(state.raw || []);
        const allowed=new Set(availableSites.filter(f=>district==="ALL" || normalizeName(f.properties?.[F_DIST])===district)
          .map(f=>normalizeName(f.properties?.[F_NAME])).filter(Boolean));
        const requested=singleSiteName==null ? null : normalizeName(singleSiteName);
        let targetDistrict=district;
        if(requested) {
            const districts=[...new Set(availableSites.filter(f=>normalizeName(f.properties?.[F_NAME])===requested)
                .map(f=>normalizeName(f.properties?.[F_DIST])).filter(Boolean))];
            targetDistrict=districts.length===1 ? districts[0] : "ALL";
        }
        const records=await loadMeasurementFeatures(targetDistrict,isFullDownload);
        const rows=isFullDownload ? records : records.filter(r=>{
            const n=normalizeName(r.properties?.[F_SITEDATA_SITE_NAME]);
            return requested ? n===requested : allowed.has(n);
        });
        if(!rows.length) {
            if(statusEl) statusEl.textContent="No measurement records found for this selection.";
            return;
        }
        const fields=Object.keys(rows[0].properties || {});
        if(!fields.length) throw new Error("Measurement records have no fields");
        const csv=[fields.map(getHeaderName),fields.map(getHeaderUnit),fields.map(getHeaderGuideline),
            ...rows.map(r=>fields.map(f=>r.properties?.[f]))].map(csvRow).join("\r\n");
        const label=isFullDownload ? "FULL" : (singleSiteName || district);
        triggerCsvDownload(csv,"IDWQ_SiteData_"+safeFilePart(label)+".csv");
        if(statusEl) statusEl.textContent="Download ready ("+rows.length+" records).";
    } catch(error) {
        console.error("Measurement download failed:",error);
        if(statusEl) statusEl.textContent="Unable to download measurement data. Please retry.";
    }
};

function triggerCsvDownload(csvString,filename) {
    const blob=new Blob([csvString],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url; a.download=filename; document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
}

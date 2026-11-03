/**
 * dataTab.js
 * ----------
 * Data tab: site list table, hover highlight, and click-to-zoom.
 */

import { state } from "./state.js";
import { F_DIST, F_NAME, F_DESC } from "./constants.js";

const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

// ── Hover highlight ───────────────────────────────────────────────────────────

window.highlightPoint = function (lat, lon) {
    clearHoverHighlight();
    state.hoverHighlightLayer = L.marker([lat, lon], {
        icon: L.divIcon({
            className: "hover-circle-highlight",
            iconSize: [28, 28],
            iconAnchor: [14, 14],
        }),
        interactive: false,
    }).addTo(state.map);
};

window.clearHoverHighlight = function () {
    if (state.hoverHighlightLayer) {
        state.map.removeLayer(state.hoverHighlightLayer);
        state.hoverHighlightLayer = null;
    }
};

// ── Zoom to site ──────────────────────────────────────────────────────────────

window.zoomToSiteFromDataTab = function (lat, lon) {
    if (Number.isFinite(lat) && Number.isFinite(lon)) state.map.setView([lat, lon], 14);
};

// ── Site list collapse ────────────────────────────────────────────────────────

window.toggleSiteListCollapse = function () {
    const header  = document.getElementById("siteListHeader");
    const content = document.getElementById("siteListContent");
    if (!header || !content) return;

    const isCollapsed = header.classList.toggle("collapsed");
    content.classList.toggle("hidden-content");

    const toggle = header.querySelector("button");
    if (toggle) toggle.setAttribute("aria-expanded", String(!isCollapsed));
    const icon = header.querySelector(".expand-icon");
    if (icon) icon.textContent = isCollapsed ? "expand_more" : "expand_less";
};

// ── Render site list ──────────────────────────────────────────────────────────

export function renderDataSiteList() {
    const container = document.getElementById("dataSiteListContainer");
    if (!container) return;

    if (state.currentDownloadMode !== "filtered") {
        container.innerHTML = `
            <p style="font-style: italic; color:#666;">
                Site list is disabled when downloading the full dataset.
            </p>`;
        return;
    }

    container.innerHTML = "";

    const selectedDistrict = state.currentDistrictValue;

    // Filter by district, deduplicate by site name
    let sitesForDistrict = state.raw.filter((f) => {
        const d = (f.properties[F_DIST] || "").trim().toUpperCase();
        return selectedDistrict === "ALL" || d === selectedDistrict.trim().toUpperCase();
    });

    const siteMap = new Map();
    sitesForDistrict.forEach((f) => {
        const name = f.properties[F_NAME];
        if (name && !siteMap.has(name)) siteMap.set(name, f);
    });
    sitesForDistrict = Array.from(siteMap.values());

    if (sitesForDistrict.length === 0) {
        container.innerHTML = `<p style="color: #c00;">No sites found for the selected criteria.</p>`;
        return;
    }

    const districtName = selectedDistrict === "ALL" ? "All Districts" : selectedDistrict;
    const siteCount    = sitesForDistrict.length;

    let tableBodyHtml = "";
    sitesForDistrict.forEach((f) => {
        const p       = f.properties;
        const name    = p[F_NAME] || "N/A";
        const desc    = p[F_DESC] || "No Description Available";
        const [lon, lat] = f.geometry.coordinates;

        tableBodyHtml += `
            <tr>
                <td><button type="button" class="site-zoom-btn"
                        data-lat="${lat}" data-lon="${lon}"
                        aria-label="Zoom map to ${escapeHtml(name)}">${escapeHtml(name)}</button></td>
                <td>${escapeHtml(desc)}</td>
            </tr>`;
    });

    container.innerHTML = `
        <h3 class="site-list-header" id="siteListHeader">
            <button type="button" class="site-list-toggle" aria-expanded="true" aria-controls="siteListContent">
                Sites in ${escapeHtml(districtName)} (${siteCount} total)
                <span class="material-symbols-outlined expand-icon" aria-hidden="true">expand_less</span>
            </button>
        </h3>
        <div id="siteListContent" class="site-list-content">
            <table class="guideline-table">
                <thead>
                    <tr>
                        <th style="width: 30%;">Site Name</th>
                        <th>Site Description</th>
                    </tr>
                </thead>
                <tbody>${tableBodyHtml}</tbody>
            </table>
        </div>`;
    container.querySelector(".site-list-toggle")?.addEventListener("click",window.toggleSiteListCollapse);
    container.querySelectorAll(".site-zoom-btn").forEach((button) => {
        const lat=Number(button.dataset.lat), lon=Number(button.dataset.lon);
        button.addEventListener("click",()=>window.zoomToSiteFromDataTab(lat,lon));
        button.addEventListener("mouseenter",()=>window.highlightPoint(lat,lon));
        button.addEventListener("mouseleave",window.clearHoverHighlight);
        button.addEventListener("focus",()=>window.highlightPoint(lat,lon));
        button.addEventListener("blur",window.clearHoverHighlight);
    });
}

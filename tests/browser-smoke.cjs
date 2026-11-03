/* Browser smoke test for the actual development-branch static website.
 * Run with: node tests/browser-smoke.cjs
 * Requires: npm install --no-save playwright; npx playwright install chromium
 * Serve repo root on http://127.0.0.1:8000 before running.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8000';
const errors = [];
let activeBrowser;
let activePage;
(async () => {
  const browser = await chromium.launch({headless: true, args:['--no-sandbox']});
  activeBrowser = browser;
  const page = await browser.newPage({acceptDownloads: true, viewport:{width:1440,height:900}});
  activePage = page;
  page.on('console', msg => { if(msg.type()==='error') console.error('Browser console:',msg.text()); });
  page.on('pageerror', error => errors.push(String(error)));
  const response = await page.goto(base + '/app.html',{waitUntil:'domcontentloaded',timeout:60000});
  assert.equal(response.status(),200);
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-marker-icon, .leaflet-interactive').length > 0, null, {timeout:40000});
  console.log('PASS: application and map markers loaded');
  const dataTab = page.locator('.tab[data-target="data"]');
  await dataTab.focus();
  await page.keyboard.press('Enter');
  await page.locator('#dataDistrictSelect:not([disabled])').waitFor({timeout:30000});
  console.log('PASS: keyboard tab navigation');
  await page.selectOption('#dataDistrictSelect','BRID');
  await page.locator('.site-zoom-btn').first().waitFor();
  const site=page.locator('.site-zoom-btn').first();
  await site.focus();
  await page.keyboard.press('Enter');
  console.log('PASS: district filtering and keyboard site navigation');
  const requested=[];
  page.on('request',r => {if(r.url().includes('/data/')) requested.push(r.url());});
  const [districtDownload] = await Promise.all([
    page.waitForEvent('download',{timeout:90000}),
    page.locator('#downloadSiteDataBtn').click()
  ]);
  const districtText=fs.readFileSync(await districtDownload.path(),'utf8');
  assert.match(districtDownload.suggestedFilename(),/BRID/i);
  assert.match(districtText,/IrrDist|Irrigation District/i);
  assert(requested.some(x=>x.endsWith('/data/siteData/BRID.json')), 'District shard was not loaded');
  assert(!requested.some(x=>x.endsWith('/data/WQ_SiteData.json')), 'District download unexpectedly loaded full data');
  console.log('PASS: district-only download requests smaller BRID file, CSV generated');
  await page.locator('#modeFull').check();
  const [fullDownload] = await Promise.all([
    page.waitForEvent('download',{timeout:120000}),
    page.locator('#downloadSiteDataBtn').click()
  ]);
  const fullText=fs.readFileSync(await fullDownload.path(),'utf8');
  assert(requested.some(x=>x.endsWith('/data/WQ_SiteData.json')),'Full dataset request missing');
  assert(fullText.length > districtText.length,'Full export should exceed district export');
  console.log('PASS: full download uses canonical dataset');
  await page.locator('.tab[data-target="wq"]').click();
  await page.locator('#downloadCsvBtn:not([disabled])').waitFor({timeout:30000});
  const [wqDownload]=await Promise.all([
    page.waitForEvent('download',{timeout:30000}),
    page.locator('#downloadCsvBtn').click()
  ]);
  const wqText=fs.readFileSync(await wqDownload.path(),'utf8');
  assert(wqText.startsWith('SiteName,IrrDist,SiteType,SiteStatus,IndexYear'));
  console.log('PASS: WQ Index CSV export');
  await page.setViewportSize({width:390,height:844});
  assert(await page.locator('#mapView').isVisible());
  console.log('PASS: mobile viewport renders map');
  assert.equal(errors.length,0,'Uncaught JS errors: '+errors.join('; '));
  console.log('PASS: zero uncaught JavaScript errors');
  await browser.close();
})().catch(async e=>{
  console.error('FAIL:',e);
  console.error('Uncaught browser errors:',errors);
  try { if(activePage) await activePage.screenshot({path:'browser-failure.png',fullPage:true,timeout:5000}); } catch(_) {}
  try { if(activeBrowser) await activeBrowser.close(); } catch(_) {}
  process.exitCode=1;
});

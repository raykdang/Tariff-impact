// Refreshes the fallback copy embedded in bay-area-spending.html.
// The page itself always asks the live sources first. This copy is only what it shows when it cannot reach them.
// Usage: node tools/refresh-bay-ledger.mjs [input.html] [output.html]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync, gunzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const input = resolve(process.argv[2] || 'bay-area-spending.html');
const output = resolve(process.argv[3] || input);
const KEEP_DAYS = 45; // leave out saved answers that no view has asked for lately
let html = readFileSync(input, 'utf8');
const block = /(<script type="text\/plain" id="snap">)([\s\S]*?)(<\/script>)/;
const before = html.match(block)?.[2].trim();
if (before === undefined) throw new Error('No snapshot block found in ' + input);
const old = before ? JSON.parse(gunzipSync(Buffer.from(before, 'base64'))) : {};

// Public payroll and consumer prices come from BLS, which does not let web pages query it, so they are bundled here.
const blsBlock = /(<script type="application\/json" id="bls">)([\s\S]*?)(<\/script>)/;
async function refreshBls() {
  const C = [['Alameda', '06001'], ['Contra Costa', '06013'], ['Marin', '06041'], ['Napa', '06055'], ['San Francisco', '06075'], ['San Mateo', '06081'], ['Santa Clara', '06085'], ['Solano', '06095'], ['Sonoma', '06097']];
  const d = JSON.parse(html.match(blsBlock)[2]);
  const ua = { headers: { 'User-Agent': 'Mozilla/5.0' } };
  const now = new Date(), want = [];
  for (let k = 0; k < 8; k++) { const i = now.getFullYear() * 4 + Math.floor(now.getMonth() / 3) - k; want.push([Math.floor(i / 4), (i % 4) + 1]); }
  let got = 0;
  for (const [y, q] of want) for (const [idx, [, fips]] of C.entries()) {
    const r = await fetch(`https://data.bls.gov/cew/data/api/${y}/${q}/area/${fips}.csv`, ua);
    if (r.status === 404) break; // not published yet
    if (!r.ok) throw new Error(`BLS payroll HTTP ${r.status}`);
    const lines = (await r.text()).trim().split('\n').map(l => l.split(',').map(x => x.replace(/^"|"\r?$|\r$/g, '')));
    const h = Object.fromEntries(lines[0].map((n, i) => [n, i]));
    for (const l of lines.slice(1)) {
      if (l[h.industry_code] !== '10' || !'0123'.includes(l[h.own_code])) continue;
      const row = [idx, y, q, +l[h.own_code], +l[h.month1_emplvl], +l[h.month2_emplvl], +l[h.month3_emplvl], +l[h.total_qtrly_wages]];
      if (row.some(x => !Number.isFinite(x))) throw new Error('Unexpected BLS payroll format');
      const at = d.q.findIndex(o => o[0] === row[0] && o[1] === y && o[2] === q && o[3] === row[3]);
      if (at >= 0) d.q[at] = row; else d.q.push(row);
      got++;
    }
  }
  const page = await (await fetch(`https://data.bls.gov/timeseries/CUURS49BSA0?output_view=data&from_year=2002&to_year=${now.getFullYear()}`, ua)).text();
  const m = new Map();
  for (const [, y, row] of page.matchAll(/<TR[^>]*>\s*<TH scope="row">(\d{4})<\/TH>([\s\S]*?)<\/TR>/g))
    [...row.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>/g)].slice(0, 12).forEach(([, t], i) => { const v = parseFloat(t.replace(/<[^>]+>|&nbsp;|\(.*?\)|[^\d.]/g, '')); if (v) m.set(y + '-' + (i + 1), v); });
  if (m.size > 100) {
    for (let y = 2003; y <= now.getFullYear() + 1; y++) {
      const v = [[y - 1, 8], [y - 1, 10], [y - 1, 12], [y, 2], [y, 4], [y, 6]].map(k => m.get(k.join('-'))).filter(Boolean);
      if (v.length >= 4) d.cpi[y] = +(v.reduce((a, b) => a + b) / v.length).toFixed(3);
    }
    const [k, v] = [...m].pop(); d.cpiLast = { y: +k.split('-')[0], m: +k.split('-')[1], v };
  } else console.warn('Consumer prices were not refreshed.');
  d.asof = now.toISOString().slice(0, 10);
  if (got < 100) throw new Error(`Only ${got} BLS payroll rows arrived`);
  html = html.replace(blsBlock, (_, a, __, c) => a + JSON.stringify(d) + c);
  console.log(`BLS refreshed: ${got} payroll rows, prices through ${d.cpiLast.m}/${d.cpiLast.y}.`);
}
await refreshBls().catch(e => console.warn('BLS not refreshed, earlier figures kept: ' + e.message));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
page.on('pageerror', e => console.error('page error:', e.message));
const idle = async () => {
  for (let i = 0; i < 170; i++) {
    await page.waitForTimeout(700);
    if (await page.evaluate(() => LOG.every(l => l.state !== 'loading') && !UP.busy && !UP.pending)) break;
  }
  await page.waitForTimeout(1200);
};
await page.goto(pathToFileURL(input).href);
await idle();
await page.waitForFunction(() => typeof SIG !== 'undefined' && Object.keys(SIGPARTS).every(k => ['done', 'fail'].includes(SIG.parts[k])), null, { timeout: 240000 }).catch(() => console.warn('Some signals did not finish.'));
for (const v of ['insights', 'anomalies', 'explore', 'audit', 'sources', 'ahead']) {
  await page.evaluate(v => { location.hash = v; }, v);
  await idle();
}
await page.click('[data-b=so]');
await idle();
await page.evaluate(() => { location.hash = 'audit'; });
await idle();
await page.locator('#vq .chip').first().click({ timeout: 20000 }).catch(() => {});
await idle();
await page.evaluate(async () => {
  if (!AGG) return;
  const y = AGG.years.at(-1), quiet = p => p.catch(() => null);
  for (const c of COUNTIES) for (const k of ['c', 'g']) await quiet(fedQ(c, k));
  for (const q of AGG.years.slice(-3)) await quiet(cityAll(q));
  for (const c of COUNTIES) if (c !== 'San Francisco') await quiet(lineQ('k', c, y));
  for (const c of ['San Francisco', 'San Jose', 'Oakland', 'Berkeley', 'Fremont', 'Palo Alto']) await quiet(lineQ('c', c, y));
});
const { fresh, missed } = await page.evaluate(async () => {
  const fresh = {}, missed = [];
  for (const l of LOG) {
    if (l.state === 'live') fresh[l.key] = { t: l.at, d: pack(await MEM.get(l.key)) };
    else missed.push(`${l.state}: ${l.label}${l.error ? ' (' + l.error + ')' : ''}`);
  }
  return { fresh, missed };
});
await browser.close();

if (missed.length) console.warn('Not refreshed, earlier copy kept:\n  ' + missed.join('\n  '));
const keys = Object.keys(fresh);
const ca = keys.filter(k => k.startsWith('ca|')).length, sf = keys.filter(k => k.startsWith('sf|')).length;
if (ca < 5 || sf < 10) throw new Error(`Only ${ca} State Controller and ${sf} San Francisco answers arrived. Leaving the file as it was.`);
const cutoff = Date.now() - KEEP_DAYS * 864e5;
const kept = Object.fromEntries(Object.entries(old).filter(([k, v]) => !(k in fresh) && v.t > cutoff));
const json = JSON.stringify({ ...kept, ...fresh });
writeFileSync(output, html.replace(block, (_, a, __, c) => a + gzipSync(json, { level: 9 }).toString('base64') + c));
console.log(`Refreshed ${keys.length} answers, kept ${Object.keys(kept).length} earlier ones, ${(json.length / 1e6).toFixed(1)} MB before compression.`);

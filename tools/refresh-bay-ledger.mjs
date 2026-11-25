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
const html = readFileSync(input, 'utf8');
const block = /(<script type="text\/plain" id="snap">)([\s\S]*?)(<\/script>)/;
const before = html.match(block)?.[2].trim();
if (before === undefined) throw new Error('No snapshot block found in ' + input);
const old = before ? JSON.parse(gunzipSync(Buffer.from(before, 'base64'))) : {};

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
for (const v of ['explore', 'audit', 'sources', 'ahead']) {
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

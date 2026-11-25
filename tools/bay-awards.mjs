// Reads contract items from Bay Area board and council agendas (Legistar) and turns each title into
// vendor, purpose, amount, requesting department, deciding body, mover and seconder.
// Legistar does not let web pages query it, so the dashboard bundles the result.
// Usage: node tools/bay-awards.mjs out.json [previous.json]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const GOV = {
  sanmateocounty: ['San Mateo County', 'San Mateo'], 'contra-costa': ['Contra Costa County', 'Contra Costa'], 'sonoma-county': ['Sonoma County', 'Sonoma'], napa: ['Napa County', 'Napa'], solano: ['Solano County', 'Solano'],
  sanjose: ['City of San José', 'Santa Clara'], oakland: ['City of Oakland', 'Alameda'], hayward: ['City of Hayward', 'Alameda'], sunnyvaleca: ['City of Sunnyvale', 'Santa Clara'], mountainview: ['City of Mountain View', 'Santa Clara'], santaclara: ['City of Santa Clara', 'Santa Clara'], sanleandro: ['City of San Leandro', 'Alameda'], cupertino: ['City of Cupertino', 'Santa Clara'], alameda: ['City of Alameda', 'Alameda'], dublin: ['City of Dublin', 'Alameda'], 'santa-rosa': ['City of Santa Rosa', 'Sonoma'], emeryville: ['City of Emeryville', 'Alameda'],
  bart: ['BART', 'Alameda'], mtc: ['Metropolitan Transportation Commission', 'San Francisco'], actransit: ['AC Transit', 'Alameda'],
};
export const GK = Object.keys(GOV);
const SINCE = '2024-07-01';

/* ---------- reading a title ---------- */
const sq = s => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const SUF = "(?:Inc|Incorporated|LLC|L\\.L\\.C|LLP|L\\.L\\.P|LP|L\\.P|Ltd|Limited|Corp|Corporation|Co|Company|PC|P\\.C|PLLC|PBC|N\\.A|JV|Joint Venture)";
const STOP = new RegExp(`\\s*(?:,?\\s+(?:to (?:provide|perform|furnish|supply|support|extend|increase|amend|add|deliver|continue|implement|conduct|operate|manage|design|construct|develop|fund|purchase|allow|include|exercise|serve|administer|assist|complete|install|replace|upgrade|maintain|modify|accept|receive|be|pay|reimburse|update|revise|expand|facilitate|facilitat\\w+|establish|reflect|prepare|procure|cover|the|an?|new)\\b|for (?!Humanity|Change|Kids|Child|Youth|Justice|Independent|Homeless|Organization|Healthy|Famil|Sustainable|Excellence|Social)|in an? |in the (?:amount|not)|in amounts?|not[- ]to[- ]exceed|extending|increasing|decreasing|amending|adding|with (?:a|an|no|the option|options|term|terms|two|three|one)\\b|effective|from \\w+ \\d|from the|regarding|relating|related to|under|beginning|commencing|through|that|which|who|whose|and (?:authoriz|approv|adopt|direct|delegat|execut|any|a |an |the (?:City|County|Board)|make|find|further|related|all|other|waiv)\\w*|utilizing|using|pursuant|based on|via|at (?:the|\\d)|on (?:a|an|behalf|the|\\w+ \\d)|as (?:the|a|an|needed|well|required)|until|where|when|should|subject|upon|of (?:an? |the amount)|approved|approve|authoriz\\w+|valued|totall?ing|total|including|consistent|a (?:California|Delaware|non-?profit|limited|Nevada|New York|Washington|corporation|Texas|Minnesota|Florida|municipal|public)|an? (?:Illinois|Ohio|Oregon|Arizona|individual))|\\s*[;(:\\n]|,\\s*(?!(?:and |& )?${SUF}\\b|and [A-Z]|& |[A-Z][\\w.'&-]+(?: [A-Z&][\\w.'&-]*){0,3}(?:,| and| &))|\\.(?=\\s+[A-Z][a-z]+ (?!${SUF}))|\\.\\s*$|\\s+-\\s+|$)`, 'i');
const LEAD = [
  /\b(?:agreements?|contracts?|amendments?(?: (?:no|number|#)\.?\s*\w+)?|orders?|leases?|licen[cs]es?|MOUs?|memorand(?:um|a) of understanding|statement of work|subscription|engagement|partnership|procurement|sole[- ]source|retainer|subrecipient|subaward|extension|renewal)\b(?:(?!\b(?:with|between)\b|\$)[^.;]){0,110}?\bwith\s+(?:the (?:vendor|firm|following|consultant)s?:?\s*)?/i,
  /\bbetween (?:the )?(?:[A-Z][\w.&' -]{2,60}?|[^,;.]{2,60}?) and\s+/,
  /\baward(?:s|ed|ing)?\b(?:(?!\$)[^.;]){0,120}?\bto\s+(?:the lowest[^,]{0,50}bidder,?\s*)?/i,
  /\b(?:purchase|purchases|purchasing|procure|acquire|acquisition)\b(?:(?!\$)[^.;]){0,110}?\bfrom\s+/i,
  /\b(?:execute|approve|approving|authorize|authorizing|enter into)\b[^.;$]{0,40}?\b(?:agreement|contract)s? (?:to|and)\s+/i,
  /\bwith\s+(?=[A-Z])/,
];
const BAD = /^(?:the )?(?:a|an|no|its|their|any|all|each|such|other|various|multiple|several|two|three|four|five|six|seven|eight|nine|ten|options?|county|city|state|board|department|district|director|agency|authority|council|terms?|funding|grant|following|certain|one or more|option|individual|providers?|contractors?|consultants?|vendors?|firms?|qualified|selected|respect|regard|conditions?|changes?|substantially|aggregate|annual|minor|up to|and between|general plan|standard|parties|developers?|property|public works|services?|lowest responsible\w*|landlord|lessee|community-based|cooperative|master|professional|real property|related documents|california governor|labor negotiators?|anticipated|property negotiators?|legal counsel|attachment|exhibit|\d+\b|\$)\b/i;
export function vendorOf(title) {
  const t = sq(title).replace(/\bU\.S\.\s/g, 'US ').replace(/\bSt\.\s/g, 'St ').replace(/\bNo\.\s/gi, 'No ').replace(/\bDr\.\s/g, 'Dr ');
  for (const re of LEAD) {
    const m = t.match(re); if (!m) continue;
    let r = t.slice(m.index + m[0].length).replace(/^(?:the |both |vendor |contractor |consultant )+/i, '');
    const e = r.search(STOP); let v = r.slice(0, e < 0 ? 90 : e).trim().replace(/[,.;:\s-]+$/, '').replace(/^["']+|["']+$/g, '');
    v = v.replace(/\s+(?:RECOMMENDATION|Recommendation|SUMMARY|BACKGROUND)\b.*$/, '');
    v = v.replace(/\s+(?:dba|d\/b\/a|doing business as)\s+.*$/i, '').replace(/\s*".*$/, '').trim();
    if (v.length < 3 || v.length > 85 || BAD.test(v) || !/^[A-Z0-9]/.test(v) || /\b(?:shall|would|will|could)\b/i.test(v)) continue;
    if (v.split(' ').length > 12) continue;
    return v;
  }
  return '';
}
const num = (a, b) => { let v = parseFloat(a.replace(/,/g, '')); if (/mill/i.test(b || '') || /^\s*M\b/.test(b || '')) v *= 1e6; if (/bill/i.test(b || '')) v *= 1e9; return v; };
export function amountOf(title) {
  const t = sq(title), all = [...t.matchAll(/\$\s?([\d][\d,]*(?:\.\d+)?)(\s*(?:million|billion|M\b))?/gi)].map(m => ({ i: m.index, v: num(m[1], m[2]) })).filter(x => x.v >= 100);
  if (all.length > 1 && all.some(x => x.v !== 74999)) for (let i = all.length - 1; i >= 0; i--) if (all[i].v === 74999 || all[i].v === 49999) all.splice(i, 1); // delegated amendment limits, not contract values
  if (!all.length) return 0;
  const key = /(?:not[- ]to[- ]exceed|(?:new|revised|total|maximum|aggregate|contract) (?:\w+ ){0,4}(?:amount|total|value|price|compensation|payment limit|cost)|payment limit|up to|in (?:an|the) (?:total |aggregate )?amount)/gi;
  let best = 0; for (const m of t.matchAll(key)) { if (/amendments?\b[^$]{0,60}$/i.test(t.slice(Math.max(0, m.index - 90), m.index)) && /execute|authority|delegate/i.test(t.slice(Math.max(0, m.index - 160), m.index)) && all.length > 1) continue; const n = all.find(x => x.i >= m.index && x.i - m.index < 110); if (n) best = Math.max(best, n.v); }
  return best || all[0].v;
}
export const isChange = t => /\b(?:amend|extension|extend|increas\w+ (?:the|by)|change order|renew)/i.test(t);
export const isRevenue = t => /\b(?:revenue agreement|to pay (?:the )?(?:county|city)|pay(?:ing|able)? to the (?:county|city)|accept(?:ing)? (?:a |an |the )?(?:grant|funding|award)|to receive|receive (?:reimbursement|funding|funds)|reimburse the (?:county|city)|from the (?:California|U\.?S\.?|United States|State) [^.]{0,80}(?:grant|funding))/i.test(t) && !/\bto provide funding to\b/i.test(t);
export const keyOf = s => sq(s).toUpperCase().replace(/&/g, ' AND ').replace(/[.,'"()/-]/g, ' ').replace(/\b(?:DBA|D B A)\b.*$/, '').replace(/\b(?:INCORPORATED|INC|LLC|L L C|LLP|L L P|LP|L P|LTD|LIMITED|CORPORATION|CORP|COMPANY|CO|PC|P C|PLLC|PBC|N A|THE|A CALIFORNIA.*|USA|US)\b/g, ' ').replace(/\s+/g, ' ').trim();
const PUBLIC = /\b(?:county of|city of|city and county|county\b|state of|department of|school district|unified|university|regents|district\b|authority\b|commission\b|college|caltrans|transit\b|federal|united states|agency\b)/i;
export const isPublic = v => PUBLIC.test(v);

/* ---------- fetching ---------- */
const H = { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' } };
async function get(u, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(u, { ...H, signal: AbortSignal.timeout(90000) }); if (r.ok) return await r.json(); if (r.status < 500 && r.status !== 429) throw new Error('HTTP ' + r.status); } catch (e) { if (i === tries - 1) throw e; }
    await new Promise(r => setTimeout(r, 1500 * (i + 1)));
  }
  throw new Error('gave up');
}
async function pool(items, n, fn) { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k).catch(() => {}); } })); }
// some governments park undated items on 31 December
const when = x => { for (const d of [x.MatterPassedDate, x.MatterAgendaDate, x.MatterIntroDate]) if (d && d.slice(5, 10) !== '12-31') return d.slice(0, 10); return (x.MatterIntroDate || '').slice(0, 10); };
export async function build(prev, log = console.log) {
  const rows = [], people = [], pi = new Map(), P = n => { n = sq(n); if (!n) return -1; if (!pi.has(n)) { pi.set(n, people.length); people.push(n); } return pi.get(n); };
  const cover = {}, oldH = new Map();
  if (prev) for (const r of prev.rows) if (r[11] >= 0 || r[13]) oldH.set(r[0] + '|' + r[1], [prev.people[r[11]] || '', prev.people[r[12]] || '', r[13], r[14]]);
  await pool(GK, 5, async g => {
    const gi = GK.indexOf(g); let skip = 0, seen = 0, kept = 0;
    const f = `MatterIntroDate ge datetime'${SINCE}' and MatterIntroDate lt datetime'${new Date().getFullYear() + 1}-01-01' and (substringof('greement',MatterTitle) or substringof('ontract',MatterTitle) or substringof('urchase',MatterTitle) or substringof('ward',MatterTitle) or substringof('mendment',MatterTitle))`;
    try {
      for (;;) {
        const d = await get(`https://webapi.legistar.com/v1/${g}/matters?$top=1000&$skip=${skip}&$orderby=MatterId&$filter=${encodeURIComponent(f)}`);
        for (const x of d) {
          seen++;
          const t = sq(x.MatterTitle); if (t.length < 25) continue;
          const body = t.replace(/^Subject:\s*/i, '').replace(/\bFrom:\s.*?\bRecommendation:\s*/i, '. ');
          const v = vendorOf(body), a = amountOf(body);
          if (!v || (!a && !/\b(?:agreement|contract|procure|purchase|award)/i.test(t))) continue;
          if (/settlement agreement|tentative agreement|collective bargaining|subdivision|memorandum of understanding with .*(?:local \d|union|association of)|labor|williamson act|development agreement with|closed session|compliance data|receive (?:an? )?(?:informational )?report/i.test(t)) continue;
          kept++;
          rows.push([gi, x.MatterId, when(x), sq(x.MatterRequester || x.MatterBodyName).slice(0, 70), sq(x.MatterTypeName), sq(x.MatterStatusName), body.slice(0, 340), v, a, (isChange(body) ? 1 : 0) + (isRevenue(body) ? 2 : 0), sq(x.MatterFile), -1, -1, '', '', sq(x.MatterBodyName).slice(0, 60)]);
        }
        if (d.length < 1000) break; skip += 1000; if (skip > 12000) break;
      }
      cover[g] = { seen, kept };
    } catch (e) { cover[g] = { error: e.message }; if (prev) { for (const r of prev.rows) if (r[0] === gi) { const q = [...r]; q[11] = P(prev.people[r[11]]); q[12] = P(prev.people[r[12]]); rows.push(q); } } }
    log(g, JSON.stringify(cover[g]));
  });
  /* who moved and seconded: fetched once per item, then remembered */
  const need = []; for (const r of rows) { const o = oldH.get(r[0] + '|' + r[1]); if (o) { r[11] = P(o[0]); r[12] = P(o[1]); r[13] = o[2]; r[14] = o[3]; } else if (r[11] < 0 && r[8] >= 250000) need.push(r); }
  let got = 0; await pool(need, 10, async r => {
    const h = await get(`https://webapi.legistar.com/v1/${GK[r[0]]}/matters/${r[1]}/histories`, 2);
    const k = [...h].reverse().find(x => x.MatterHistoryMoverName || x.MatterHistoryPassedFlagName) || h.at(-1);
    if (!k) return; r[11] = P(k.MatterHistoryMoverName); r[12] = P(k.MatterHistorySeconderName); r[13] = sq(k.MatterHistoryPassedFlagName || k.MatterHistoryActionName).slice(0, 30); r[14] = sq(k.MatterHistoryActionBodyName).slice(0, 60); if (k.MatterHistoryActionDate && k.MatterHistoryActionDate.slice(5, 10) !== '12-31') r[2] = k.MatterHistoryActionDate.slice(0, 10); got++;
  });
  log(`decisions read: ${got} of ${need.length} needed`);
  rows.sort((a, b) => b[2].localeCompare(a[2]));
  return { asof: new Date().toISOString().slice(0, 10), since: SINCE, gov: GK.map(g => [g, ...GOV[g]]), people, cover, rows };
}
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const prev = process.argv[3] && existsSync(process.argv[3]) ? JSON.parse(readFileSync(process.argv[3], 'utf8')) : null;
  const d = await build(prev); writeFileSync(process.argv[2], JSON.stringify(d)); console.log(d.rows.length, 'items', d.people.length, 'people', (JSON.stringify(d).length / 1e6).toFixed(2), 'MB');
}

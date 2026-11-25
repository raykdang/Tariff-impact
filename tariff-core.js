// tariff-core.js: the rates, sums and link rules that the home page calculator
// (/) and the embeddable calculator (/widget) both use, so the two never disagree.
// Plain script, no modules: it declares globals. Each page that loads it declares
// its own `state` object, which calc() and findBreakevenPrice() read.
// Do not type a rate here that was not read at an official source.

// ---------------------- TARIFF DATA ----------------------
// Tariff rates for GENERAL MERCHANDISE by country pair.
// CAVEAT: actual rates depend on the specific HTS code. Apparel, steel, aluminum,
// electronics, and a few other categories often diverge significantly from these
// averages. Always verify via USITC HTS for your specific product.
// US rows marked "checked" were read at official sources on that date (see the
// comment above the US rows). All other rows date from May 2026 and were not re-checked.

const tariffData = {
  lastUpdated: "2026-11-25",   // the day the US rows marked "checked" were read
  otherRowsAsOf: "May 2026",   // every row without "checked"
  source: "US rows: Section 301 notice 91 FR 47318 (2026-07-28), Proclamation 11021 (91 FR 18201), USTR continuation notice 91 FR 64212 (2026-10-07) and the Harmonized Tariff Schedule, 2026 Revision 23, read 2026-11-25. Other rows: WTO MFN and national schedules, May 2026, not re-checked.",
  origins: [
    { code: "CN", name: "China" },
    { code: "VN", name: "Vietnam" },
    { code: "MX", name: "Mexico" },
    { code: "CA", name: "Canada" },
    { code: "IN", name: "India" },
    { code: "BD", name: "Bangladesh" },
    { code: "ID", name: "Indonesia" },
    { code: "TH", name: "Thailand" },
    { code: "TW", name: "Taiwan" },
    { code: "KR", name: "South Korea" },
    { code: "JP", name: "Japan" },
    { code: "DE", name: "Germany" },
    { code: "IT", name: "Italy" },
    { code: "FR", name: "France" },
    { code: "IE", name: "Ireland" },
    { code: "GB", name: "United Kingdom" },
    { code: "BR", name: "Brazil" },
    { code: "TR", name: "Turkey" },
    { code: "MY", name: "Malaysia" },
    { code: "PH", name: "Philippines" },
    { code: "PK", name: "Pakistan" },
    { code: "EG", name: "Egypt" },
    { code: "PE", name: "Peru" },
    { code: "US", name: "United States" },
    { code: "EU", name: "European Union" },
  ],
  destinations: [
    { code: "US", name: "United States" },
    { code: "EU", name: "European Union" },
    { code: "GB", name: "United Kingdom" },
    { code: "CA", name: "Canada" },
    { code: "AU", name: "Australia" },
    { code: "JP", name: "Japan" },
  ],
  // rates: general merchandise effective average. Some sectors (steel, apparel, electronics) differ materially.
  rates: {
    // -------- Imports into the US --------
    // Rows with "checked" were read at official sources on that date: the Section 301
    // notice of 2026-07-28 (91 FR 47318, document 2026-15181) and the Harmonized Tariff
    // Schedule, 2026 Revision 23. They show the country-wide duty in force since
    // 2026-07-24, not a total: the ordinary duty by tariff code comes on top, except on
    // "floor" rows, where the duty tops the total up to the stated rate.
    // Rows without "checked" date from May 2026 and were not re-checked. Do not type a
    // rate here that was not read at an official source.
    "CN->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318; HTS 9903.05.31). On top: the ordinary duty by tariff code, and the older China Section 301 duties by list. Read for some goods on 2026-11-25 (HTS ch. 99 note 20): furniture on list 3, +25%; toys, laptops and monitors only on suspended list 4B, and phones on no list, so none. Laptops, phones and monitors are also exempt from the 12.5% (HTS note 52(b)). The 10% China duty of Nov 2025 (HTS 9903.01.24) ended on 20 Feb 2026 (EO 14389, 91 FR 9437) and does not apply. Only four upholstered wooden seat lines (9401.61.4011, .4031, .6011, .6031; HTS 9903.76.02) skip the 12.5% (HTS note 52(f)(4)): they pay the Section 232 wood duty, +25% (30% from 1 Jan 2027), and the list 3 +25% on top, so 50% today and 55% from 1 Jan 2027. Set-size sofas (9401.61.6011) are excluded from list 3 until 9 Jan 2027: 25% today. Other upholstered seats, such as teak-framed (9401.61.20), pay the 12.5%." },
    "VN->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318; HTS 9903.05.84). The ordinary duty by tariff code comes on top. Only four upholstered wooden seat lines (9401.61.4011, .4031, .6011, .6031; HTS 9903.76.02) skip the 12.5% (HTS note 52(f)(4)): they pay the Section 232 wood duty instead, +25% (30% from 1 Jan 2027). Other upholstered seats, such as teak-framed (9401.61.20), pay the 12.5%." },
    "MX->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% from 24 Jul 2026 (Section 301, 91 FR 47318; HTS 9903.05.55, .94). Goods that enter free under USMCA are exempt. The ordinary duty by tariff code comes on top." },
    "CA->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% from 24 Jul 2026 (Section 301, 91 FR 47318; HTS 9903.05.29, .93). Goods that enter free under USMCA are exempt. Lumber and vehicles fall under Section 232 instead. The ordinary duty by tariff code comes on top." },
    "IN->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% from 24 Jul 2026 (Section 301, 91 FR 47318; HTS 9903.05.44). The ordinary duty by tariff code comes on top." },
    "BD->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% from 24 Jul 2026 (Section 301, 91 FR 47318). The ordinary duty by tariff code comes on top, and differs widely by product." },
    "GB->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% from 24 Jul 2026 (Section 301, 91 FR 47318). The ordinary duty by tariff code comes on top." },
    "TW->US": { rate: 10, basis: "floor", checked: "2026-11-25", note: "From 24 Jul 2026, covered goods pay at least 10% in total: the added duty tops the ordinary duty up to 10%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.75, .76)." },
    "KR->US": { rate: 12.5, basis: "floor", checked: "2026-11-25", note: "From 24 Jul 2026, covered goods pay at least 12.5% in total: the added duty tops the ordinary duty up to 12.5%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.70, .71)." },
    "JP->US": { rate: 12.5, basis: "floor", checked: "2026-11-25", note: "From 24 Jul 2026, covered goods pay at least 12.5% in total: the added duty tops the ordinary duty up to 12.5%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.48, .49)." },
    "DE->US": { rate: 10, basis: "floor", checked: "2026-11-25", note: "EU member. From 24 Jul 2026, covered goods pay at least 10% in total: the added duty tops the ordinary duty up to 10%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.38, .39)." },
    "IE->US": { rate: 10, basis: "floor", checked: "2026-11-25", note: "EU member. From 24 Jul 2026, covered goods pay at least 10% in total: the added duty tops the ordinary duty up to 10%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.38, .39)." },
    "IT->US": { rate: 10, basis: "floor", checked: "2026-11-25", note: "EU member. From 24 Jul 2026, covered goods pay at least 10% in total: the added duty tops the ordinary duty up to 10%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.38, .39)." },
    "FR->US": { rate: 10, basis: "floor", checked: "2026-11-25", note: "EU member. From 24 Jul 2026, covered goods pay at least 10% in total: the added duty tops the ordinary duty up to 10%, and where the ordinary duty is higher it applies alone (91 FR 47318; HTS 9903.05.38, .39)." },
    "BR->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.8). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },
    "TR->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.55). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },
    "ID->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.25). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top. Indonesia also has its own list of exempt products (Annex II, Part L, not re-checked), and a textile quota is to come; until USTR sets it up, the 10% applies to those goods too." },
    "TH->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.53). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },
    "MY->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.33). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top. Malaysia also has its own list of exempt products (Annex II, Part E, not re-checked), and a textile quota is to come; until USTR sets it up, the 10% applies to those goods too." },
    "PH->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.43). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },
    "PK->US": { rate: 10, basis: "added", checked: "2026-11-25", note: "+10% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.41). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },
    "EG->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.17). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },
    "PE->US": { rate: 12.5, basis: "added", checked: "2026-11-25", note: "+12.5% country-wide duty from 24 Jul 2026 (Section 301, 91 FR 47318, section II.B.42). Goods under Section 232 (steel, aluminum, copper, vehicles and parts, wood products) pay that duty instead. The ordinary duty by tariff code comes on top." },

    // -------- Imports into the EU --------
    "CN->EU": { rate: 8,  note: "EU MFN average ~5%. Anti-dumping duties on bicycles, solar panels, ceramics push some categories higher." },
    "VN->EU": { rate: 2,  note: "EU-Vietnam FTA (EVFTA): most tariffs eliminated or phasing out." },
    "US->EU": { rate: 5,  note: "EU MFN ~4–5%. Periodic retaliation tariffs on whiskey, motorcycles, agricultural goods." },
    "GB->EU": { rate: 0,  note: "EU-UK Trade & Cooperation Agreement: 0% tariffs if rules of origin met." },
    "MX->EU": { rate: 1,  note: "EU-Mexico Global Agreement: most goods 0%." },
    "JP->EU": { rate: 1,  note: "EU-Japan Economic Partnership Agreement: most tariffs phased out." },
    "KR->EU": { rate: 0,  note: "EU-Korea FTA: nearly all tariffs eliminated." },
    "IN->EU": { rate: 7,  note: "EU MFN ~5–8%. EU-India FTA negotiations ongoing." },
    "TR->EU": { rate: 0,  note: "EU Customs Union covers most industrial goods. Agriculture excluded." },
    "BD->EU": { rate: 0,  note: "Everything But Arms (EBA): duty-free for least-developed countries." },
    "BR->EU": { rate: 6,  note: "EU MFN. EU-Mercosur deal pending ratification." },
    "TH->EU": { rate: 6,  note: "EU MFN ~5–7%." },
    "ID->EU": { rate: 6,  note: "EU MFN. Generalised Scheme of Preferences (GSP) reduces some rates." },

    // -------- Imports into the UK --------
    "CN->GB": { rate: 7,  note: "UK Global Tariff (UKGT). Anti-dumping on specific categories." },
    "VN->GB": { rate: 3,  note: "UK-Vietnam FTA in force." },
    "US->GB": { rate: 4,  note: "UKGT. No FTA in force as of 2026-04." },
    "EU->GB": { rate: 0,  note: "UK-EU TCA: 0% if rules of origin met." },
    "IN->GB": { rate: 5,  note: "UKGT. UK-India FTA in negotiation." },
    "BD->GB": { rate: 0,  note: "UK Generalised Scheme of Preferences (Enhanced)." },
    "JP->GB": { rate: 1,  note: "UK-Japan CEPA in force." },
    "AU->GB": { rate: 0,  note: "UK-Australia FTA: most tariffs eliminated." },

    // -------- Imports into Canada --------
    "CN->CA": { rate: 7,  note: "Canada MFN ~5–7%. Some categories higher." },
    "US->CA": { rate: 1,  note: "USMCA: most goods 0%." },
    "MX->CA": { rate: 1,  note: "USMCA: most goods 0%." },
    "VN->CA": { rate: 3,  note: "CPTPP: tariffs reducing/eliminating over schedule." },
    "JP->CA": { rate: 2,  note: "CPTPP: most tariffs eliminated." },
    "EU->CA": { rate: 1,  note: "CETA: most tariffs eliminated." },
    "GB->CA": { rate: 1,  note: "Canada-UK Trade Continuity Agreement." },

    // -------- Imports into Australia --------
    "CN->AU": { rate: 4,  note: "ChAFTA: most tariffs eliminated." },
    "US->AU": { rate: 4,  note: "AUSFTA: most tariffs eliminated; some agricultural exceptions." },
    "VN->AU": { rate: 2,  note: "AANZFTA + CPTPP." },
    "JP->AU": { rate: 2,  note: "JAEPA + CPTPP." },
    "GB->AU": { rate: 0,  note: "UK-Australia FTA: most tariffs eliminated." },
    "EU->AU": { rate: 4,  note: "Australia MFN. EU-Australia FTA in negotiation." },

    // -------- Imports into Japan --------
    "CN->JP": { rate: 4,  note: "Japan MFN ~3–5%." },
    "US->JP": { rate: 2,  note: "US-Japan partial trade agreement. Auto tariffs notable exception." },
    "VN->JP": { rate: 1,  note: "CPTPP + AJCEP." },
    "EU->JP": { rate: 1,  note: "EU-Japan EPA." },
    "GB->JP": { rate: 1,  note: "UK-Japan CEPA." },
    "AU->JP": { rate: 1,  note: "JAEPA + CPTPP." },
  }
};

// ---------------------- STATE ----------------------
// The calculator opens on a made-up example rate, not a country's rate: a country
// row fills in only when the visitor picks one, or a shared link names one.
const EXAMPLE_TARIFF = 20;
const defaults = {
  cost: 10, tariff: EXAMPLE_TARIFF, ship: 1.5,
  price: 25, pass: 50,
  units: 500, elast: -1.2,
  var: 2, fixed: 3000,
  countryFrom: "CN", countryTo: "US"
};

// ---------------------- HELPERS ----------------------
const fmt$ = v => (v < 0 ? "−" : "") + "$" + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmt$0 = v => (v < 0 ? "−" : "") + "$" + Math.abs(Math.round(v)).toLocaleString();
const fmtInt = v => Math.round(v).toLocaleString();
const fmtPct = v => (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%";

function calc(passPct, priceOverride = null) {
  const c = state.cost, t = state.tariff / 100, ship = state.ship;
  const variableCost = state.var, fixed = state.fixed;
  const basePrice = state.price, baseUnits = state.units, elast = state.elast;
  const tariffPerUnit = c * t;
  const landedCostPre = c + ship + variableCost;
  const landedCostPost = c + tariffPerUnit + ship + variableCost;
  const newPrice = priceOverride !== null ? priceOverride : basePrice + tariffPerUnit * (passPct / 100);
  let newUnits = baseUnits;
  if (basePrice > 0 && newPrice > 0) newUnits = baseUnits * Math.pow(newPrice / basePrice, elast);
  const preMarginUnit = basePrice - landedCostPre;
  const preProfit = preMarginUnit * baseUnits - fixed;
  const preRevenue = basePrice * baseUnits;
  const postMarginUnit = newPrice - landedCostPost;
  const postProfit = postMarginUnit * newUnits - fixed;
  const postRevenue = newPrice * newUnits;
  const postMarginPct = newPrice > 0 ? (postMarginUnit / newPrice) * 100 : 0;
  return {
    tariffPerUnit, landedCostPre, landedCostPost,
    basePrice, newPrice, baseUnits, newUnits,
    preMarginUnit, postMarginUnit, postMarginPct,
    preProfit, postProfit, preRevenue, postRevenue,
    profitDelta: postProfit - preProfit,
    profitPct: preProfit !== 0 ? ((postProfit - preProfit) / Math.abs(preProfit)) * 100 : 0
  };
}

// Returns { price } when such a price exists, or { price: null, bestPrice, bestProfit }
// when even the most profitable price stays below pre-tariff profit.
function findBreakevenPrice() {
  const base = calc(0);
  const target = base.preProfit;
  if (base.tariffPerUnit === 0) return { price: state.price };
  // Profit rises with price up to a ceiling. With elasticity below -1 the ceiling is the
  // profit-maximising price; otherwise there is none, so widen the range until the target is met.
  let hi = state.price * 4;
  if (state.elast < -1) {
    hi = base.landedCostPost * state.elast / (state.elast + 1);
  } else {
    for (let i = 0; i < 40 && calc(0, hi).postProfit < target; i++) hi *= 2;
  }
  const best = calc(0, hi).postProfit;
  if (!(hi > 0) || best < target) return { price: null, bestPrice: hi, bestProfit: best };
  let lo = Math.min(state.price * 0.5, hi * 0.5);
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const r = calc(0, mid);
    if (r.postProfit < target) lo = mid; else hi = mid;
  }
  return { price: (lo + hi) / 2 };
}

// ---------------------- LINK TO A SCENARIO ----------------------
// The address can carry the inputs: /?from=VN&to=US&cost=40&tariff=20&price=90
// Every value from the address is treated as untrusted text. A number is used
// only if it is a plain decimal inside the limits below, and a country only if
// it is one of the codes in tariffData. Anything else is dropped, and that
// input keeps its normal opening value. Nothing from the address is written
// into the page as text or markup.
const linkParams = [
  { name: 'cost',       key: 'cost',   min: 0,    max: 1000000 },
  { name: 'tariff',     key: 'tariff', min: 0,    max: 1000 },
  { name: 'shipping',   key: 'ship',   min: 0,    max: 1000000 },
  { name: 'price',      key: 'price',  min: 0.01, max: 1000000 },
  { name: 'pass',       key: 'pass',   min: 0,    max: 100 },
  { name: 'units',      key: 'units',  min: 0,    max: 10000000 },
  { name: 'elasticity', key: 'elast',  min: -5,   max: 0 },
  { name: 'other',      key: 'var',    min: 0,    max: 1000000 },
  { name: 'fixed',      key: 'fixed',  min: 0,    max: 1000000000 },
];
const linkNumber = /^-?\d{1,10}(\.\d{1,4})?$/;

function linkValueOk(p, num) {
  return typeof num === 'number' && isFinite(num) && num >= p.min && num <= p.max;
}

function readScenarioFromAddress() {
  const found = {};
  let params;
  try { params = new URLSearchParams(window.location.search); } catch (e) { return found; }
  const from = params.get('from'), to = params.get('to');
  if (from !== null && tariffData.origins.some(o => o.code === from)) found.countryFrom = from;
  if (to !== null && tariffData.destinations.some(d => d.code === to)) found.countryTo = to;
  linkParams.forEach(p => {
    const raw = params.get(p.name);
    if (raw === null || !linkNumber.test(raw)) return;
    const num = parseFloat(raw);
    if (linkValueOk(p, num)) found[p.key] = num;
  });
  return found;
}

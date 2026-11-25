# tariff-impact.com

The public files of https://tariff-impact.com/, copied from the live site on 2026-11-24.

**This repository is not yet what Cloudflare publishes.** Changing a file here changes nothing on the live site until the site is set up to publish from this repository, or the files are uploaded by hand.

## What is here

The sizes and checksums below describe the files as they were fetched (commit `0dd9ace`). `index.html`, `contact.html` and `sitemap.xml` have been changed since: see the commit history.

| File | Live address | Size | SHA-256 |
|---|---|---|---|
| index.html | `/` | 129,881 bytes | `ed94145163246ea9afd96df69f6e41b243c1a238b085915882095220854389fc` |
| contact.html | `/contact.html` (redirects to `/contact`) | 15,468 bytes | `55a8a9532a3d34528420ce75e3b4325a993a7ebd0806add5a0b746c1129e8915` |
| robots.txt | `/robots.txt` | 226 bytes | `faa00370ad49598109f9aa307062eac561701e1a5723463da2da4bad13e0328a` |
| sitemap.xml | `/sitemap.xml` | 959 bytes | `8b4a3330efb3d588ecb61a46166b24108fc225ab5e10d29cee9fa777e9d55ea1` |
| favicon.svg | `/favicon.svg` | 445 bytes | `f9061cebd32795f5d10925b3ad7a7a5e89292efbba3086f58d7d9f0aeb55596f` |

That is the whole site. Both pages carry their styles and scripts inside the page itself, and reference no other file on the site: no separate stylesheet, script, data file, image, share image or manifest. The pages are plain hand-readable HTML, not minified and not built from something else, so these files can serve as the source.

`tariff-calculator.html` is an earlier version of the calculator that was already in the repository. The live site does not use it. Should it be served, it carries the same Google tag as the other pages, fits a phone, and has a canonical link that points search engines to the home page's calculator, which it duplicates.

## One difference from the bytes as served

The files are byte for byte what the site sent, with one exception. Cloudflare adds one invisible link straight after `<body>` on both pages each time it serves them:

```
<a href="https://tariff-impact.com/cdn-cgi/content?id=…" aria-hidden="true" rel="nofollow noopener" style="display: none !important; visibility: hidden !important"></a>
```

The `id` differs on every request, so it is not part of the site's own files. It appears to be a trap that Cloudflare sets for automated crawlers (inferred from its form and address). It is left out here, and the link was not followed. Two fetches of the home page, 40 seconds apart, were identical once that link was removed.

## Asked for but not on the site

- `/ads.txt`: answers 404 (not found).
- `/favicon.ico`: answers 404. The pages use `/favicon.svg`.
- `https://www.tariff-impact.com/`: could not be reached from where this copy was made (the connection failed with "502 Bad Gateway" before reaching the site), so whether the www address works for visitors is not known.

## What the pages load from elsewhere

- Google Analytics (`googletagmanager.com/gtag/js`, measurement ID `G-3FXPSLFG9X`), on both pages.
- Chart.js 4.4.1 from `cdnjs.cloudflare.com`, on the home page.

Nothing else: no ad code, no affiliate code, no fonts or images from other sites.

## Ads and paid links

The pages hold empty places for ads and for paid (affiliate) links. No ad network or affiliate code, ID or link is in the site yet.

- **Ad places**: `<aside class="ad-slot" data-ad-place="..." hidden>`. Home page: `home-1` (after the calculator, before the rates table), `home-2` (between the guide and the FAQ), `home-3` (after the FAQ). Guide and product pages: `page-mid` (before "Questions") and `page-end` (before the closing disclaimer). None is above or inside the calculator.
- **Paid link places**: `<p class="paid-link" data-paid-link="..." hidden>`, each already holding the label "Paid link: we earn a commission if you sign up or buy through it." Home page: `home-alibaba`, `home-quickbooks`, `home-easyship`, `home-wise`, `home-shopify`, `home-faq-easyship`, `home-faq-shopify`. Guide and product pages: `page-1`, before "Questions"; the comment beside it names the programme that fits the page.
- **Disclosure line**: `<p class="paid-disclosure" hidden>` near the top of every page that has a paid link place.

While a place carries `hidden` it takes no space and loads nothing. To fill one, follow the comment beside it: paste the code or link, then delete `hidden`. A filled ad place keeps 300px of height before its ad loads, so the page doesn't jump. When a paid link is shown, also delete `hidden` on that page's disclosure line. Mark paid links `rel="sponsored noopener"`. Load an ad network's main script with `async`, after the page's own script, so the calculator never waits on it.

## Shared calculator code and the embeddable calculator

- `tariff-core.js` holds the rates table (`tariffData`), the calculator's opening values, its sums (`calc`, `findBreakevenPrice`) and the rules for reading a scenario from the address. The home page and `/widget` both load it, so the two calculators always agree. Rates are now edited there, not in `index.html`.
- `widget.html` (`/widget`) is a compact calculator for other sites to show in an iframe. It loads no outside script, no analytics and sets no cookies, and is kept out of search (`noindex`). It accepts the same address values as the home page, such as `/widget?from=VN&to=US`, and posts its height to the page around it.
- `embed.html` (`/embed`) offers the widget: a live preview and the snippet to copy, in three sizes. The snippet puts a plain "Tariff calculator by tariff-impact.com" link under the frame, on the host's own page.
- Other sites may frame `/widget` only while the site sends no `X-Frame-Options` header and no `Content-Security-Policy` with `frame-ancestors`. Neither is set today.

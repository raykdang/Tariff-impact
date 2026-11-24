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

`tariff-calculator.html` is an earlier version of the calculator that was already in the repository. The live site does not use it.

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

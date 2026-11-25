#!/usr/bin/env python3
"""Tells the IndexNow search engines (Bing, Yandex, Seznam, Naver and others;
not Google) which pages of https://tariff-impact.com/ are new or changed.
Standard library only.

  python3 .github/scripts/indexnow.py all [FILE]      every <loc> in sitemap.xml
  python3 .github/scripts/indexnow.py changed FILE    only the sitemap pages whose
                                                      .html file is listed in FILE
FILE lists the files this push changed, one repository path a line.

Before it sends anything it waits until this very commit is live, so no
engine is told about a page before its new text is published:

  1. Cloudflare's own "Workers Builds" check on this commit (read from GitHub
     with the job's read-only token). Cloudflare posts that check only when
     its build ends, about five minutes after the commit lands, so "no check
     yet" is normal at first: the script polls for up to WAIT_SECONDS
     (default 900) for the check to appear and complete.
     - Failed or cancelled: this commit never went live, nothing is sent.
     - Passed: it goes on to step 2, and if a page still differs after
       GRACE_SECONDS (default 300), for example because a newer commit has
       since gone live or Cloudflare edits pages in a new way, it sends
       anyway and says why: the build proves this commit was published.
     - Never passed in time (never posted, still running, or GitHub could
       not be read): only then does it fall back to step 2 alone, for up to
       FALLBACK_SECONDS (default 300) more, and sends nothing if the pages
       never match. With no token at all, that fallback starts at once.
  2. The live site serves this commit's key file and sitemap, and every
     changed file that the site serves (top-level .html, .xml, .txt, .js, .svg)
     has the same content live as in the commit. Cloudflare adds a hidden
     /cdn-cgi/ link and its analytics script to live pages; those are removed
     before comparing.

The tests are in test_indexnow.py beside this script:
  python3 -m unittest discover -s .github/scripts

It then sends one POST to api.indexnow.org, which shares the list with every
IndexNow engine, and prints the answer. HTTP 200 or 202 is success; anything
else makes the run fail.
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET

HOST = "tariff-impact.com"
KEY = "52e097de978708b53f3f6311e220f244"
SITE = f"https://{HOST}"
ENDPOINT = "https://api.indexnow.org/indexnow"
WAIT_SECONDS = int(os.environ.get("WAIT_SECONDS", "900"))
GRACE_SECONDS = int(os.environ.get("GRACE_SECONDS", "300"))
FALLBACK_SECONDS = int(os.environ.get("FALLBACK_SECONDS", "300"))
POLL_SECONDS = int(os.environ.get("POLL_SECONDS", "30"))
BUILD_CHECK_PREFIX = os.environ.get("BUILD_CHECK_PREFIX", "Workers Builds")
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
SERVED_SUFFIXES = (".html", ".xml", ".txt", ".js", ".svg")

# What Cloudflare injects into live HTML: a hidden <a href=".../cdn-cgi/...">
# link, and <script> tags for its own features (/cdn-cgi/ scripts, and the Web
# Analytics beacon from static.cloudflareinsights.com with data-cf-beacon).
CLOUDFLARE_ADDED = re.compile(
    rb"<a\b[^>]*\bhref=[\"'][^\"']*/cdn-cgi/[^>]*>.*?</a>"
    rb"|<script\b[^>]*(?:/cdn-cgi/|cloudflareinsights\.com|data-cf-)[^>]*>.*?</script>",
    re.S | re.I,
)


def sitemap_urls(xml_bytes):
    root = ET.fromstring(xml_bytes)
    return [e.text.strip() for e in root.findall("s:url/s:loc", NS) if e.text]


def fetch(url, headers=None):
    h = {"User-Agent": "tariff-impact-indexnow/1.1", "Cache-Control": "no-cache"}
    h.update(headers or {})
    with urllib.request.urlopen(urllib.request.Request(url, headers=h), timeout=30) as r:
        return r.read()


def bust(url):
    return f"{url}{'&' if '?' in url else '?'}v={int(time.time())}"


def page_url(path):
    """Repository path of a top-level page -> its live address, else None."""
    path = path.strip()
    if "/" in path or not path.endswith(".html"):
        return None
    return SITE + "/" if path == "index.html" else f"{SITE}/{path[:-5]}"


def served_url(path):
    """Repository path of a top-level file the site serves -> its live address."""
    path = path.strip()
    if not path or "/" in path or path.startswith(".") or not path.endswith(SERVED_SUFFIXES):
        return None
    return page_url(path) or f"{SITE}/{path}"


def normalize(body):
    """Drops what Cloudflare adds, and treats any run of whitespace as one space
    (Cloudflare also adds a line break with its analytics script)."""
    return re.sub(rb"\s+", b" ", CLOUDFLARE_ADDED.sub(b"", body)).strip()


def files_to_compare(changed):
    """(repository path, live address) pairs whose live copy must match."""
    ignored = set()
    if os.path.exists(".assetsignore"):
        with open(".assetsignore") as f:
            ignored = {line.strip().strip("/") for line in f if line.strip()}
    pairs = {"sitemap.xml": f"{SITE}/sitemap.xml", f"{KEY}.txt": f"{SITE}/{KEY}.txt"}
    for p in changed:
        p = p.strip()
        u = served_url(p)
        if u and p not in ignored and os.path.isfile(p):
            pairs[p] = u
    return sorted(pairs.items())


def build_check(sha, repo, token, api="https://api.github.com", fetcher=None):
    """State of Cloudflare's build check on this commit: 'success', 'failed',
    'running', 'missing' (no such check yet, since Cloudflare posts it only
    when the build ends; or GitHub could not be read this time), or
    'unavailable' (no commit, repository or token to read it with)."""
    if not (sha and repo and token):
        return "unavailable"
    url = f"{api}/repos/{repo}/commits/{sha}/check-runs?per_page=100"
    try:
        data = json.loads((fetcher or fetch)(url, {
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }))
    except Exception as e:
        print(f"Could not read this commit's checks ({e}); will try again.")
        return "missing"
    runs = [r for r in data.get("check_runs", []) if r.get("name", "").startswith(BUILD_CHECK_PREFIX)]
    if not runs:
        return "missing"
    if any(r.get("status") != "completed" for r in runs):
        return "running"
    if all(r.get("conclusion") == "success" for r in runs):
        return "success"
    return "failed"


def live_mismatches(pairs, fetcher=fetch):
    """Repository paths whose live copy differs from this commit's (or can't be read)."""
    bad = []
    for path, url in pairs:
        with open(path, "rb") as f:
            want = normalize(f.read())
        try:
            got = normalize(fetcher(bust(url)))
        except Exception as e:  # a network blip, or a 404 while it deploys
            bad.append(f"{path} ({e})")
            continue
        if got != want:
            bad.append(path)
    return bad


def wait_until_live(changed, check=None, mismatches=None, clock=time.time, sleep=time.sleep):
    """True once this commit is live, False if it never goes live in time.
    See the top comment: the build check first, the page comparison alone
    only after WAIT_SECONDS without a passed check."""
    sha = os.environ.get("GITHUB_SHA")
    repo = os.environ.get("GITHUB_REPOSITORY")
    token = os.environ.get("GITHUB_TOKEN")
    check = check or (lambda: build_check(sha, repo, token))
    pairs = files_to_compare(changed)
    mismatches = mismatches or (lambda: live_mismatches(pairs))
    print("Waiting for these files to be live: " + ", ".join(p for p, _ in pairs))
    check_deadline = clock() + WAIT_SECONDS
    built_at = None
    in_fallback = False
    while True:
        state = check()
        if state == "failed":
            print("Cloudflare's build of this commit failed or was cancelled, so it is not live.")
            return False
        if state == "success":
            if built_at is None:
                built_at = clock()
                print("Cloudflare's build of this commit has passed.")
            bad = mismatches()
            if not bad:
                print("The live site serves this commit's version of every file above.")
                return True
            if clock() - built_at >= GRACE_SECONDS:
                print("The build passed but these still differ live: " + ", ".join(bad)
                      + ". A newer commit may be live, or Cloudflare changed the page; sending anyway.")
                return True
            print("Build passed; not live yet: " + ", ".join(bad) + "; waiting.")
        elif state != "unavailable" and not in_fallback and clock() < check_deadline:
            if state == "running":
                print("Cloudflare is still building this commit; waiting.")
            else:
                print("Cloudflare has not posted its build check on this commit yet; waiting.")
        else:
            if not in_fallback:
                in_fallback = True
                check_deadline = min(check_deadline, clock())
                if state == "unavailable":
                    print("No token to read Cloudflare's build check; relying on the page comparison.")
                else:
                    print(f"No passed build check after {WAIT_SECONDS}s (last state: {state}); "
                          "falling back to the page comparison.")
            bad = mismatches()
            if not bad:
                print("The live site serves this commit's version of every file above.")
                return True
            if clock() >= check_deadline + FALLBACK_SECONDS:
                print("Still not live: " + ", ".join(bad) + ".")
                return False
            print("Not live yet: " + ", ".join(bad) + "; waiting.")
        sleep(POLL_SECONDS)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode not in ("all", "changed") or (mode == "changed" and len(sys.argv) < 3):
        print(f"Unknown mode {mode!r}: use 'all [FILE]' or 'changed FILE'.")
        return 2
    changed = []
    if len(sys.argv) > 2:
        with open(sys.argv[2]) as f:
            changed = [p for p in f.read().splitlines() if p.strip()]
    with open("sitemap.xml", "rb") as f:
        listed = sitemap_urls(f.read())
    if mode == "changed":
        wanted = {page_url(p) for p in changed}
        urls = [u for u in listed if u in wanted]
    else:
        urls = listed
    if not urls:
        print("No page in the sitemap changed: nothing to send.")
        return 0
    if not wait_until_live(changed):
        print("The live site did not show this commit in time: nothing sent.")
        return 1
    body = json.dumps(
        {"host": HOST, "key": KEY, "keyLocation": f"{SITE}/{KEY}.txt", "urlList": urls}
    ).encode()
    req = urllib.request.Request(
        ENDPOINT, data=body, method="POST",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    print(f"Sending {len(urls)} address(es) to {ENDPOINT}:")
    for u in urls:
        print("  " + u)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            status, text = r.status, r.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        status, text = e.code, e.read().decode(errors="replace")
    except urllib.error.URLError as e:
        status, text = 0, f"no answer: {e.reason}"
    print(f"IndexNow answered HTTP {status} {text[:500]}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"IndexNow: sent {len(urls)} address(es); answer HTTP {status}.\n")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main())

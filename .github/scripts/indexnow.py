#!/usr/bin/env python3
"""Tells the IndexNow search engines (Bing, Yandex, Seznam, Naver and others;
not Google) which pages of https://tariff-impact.com/ are new or changed.
Standard library only.

  python3 .github/scripts/indexnow.py all            every <loc> in sitemap.xml
  python3 .github/scripts/indexnow.py changed FILE   only the sitemap pages whose
                                                     .html file is listed in FILE
                                                     (one repository path a line)

Before it sends anything it waits (up to WAIT_SECONDS, default 900) until the
live site serves this commit's sitemap.xml and the key file, so no engine is
told about a page that is not published yet. It then sends one POST to
api.indexnow.org, which shares the list with every IndexNow engine, and prints
the answer. HTTP 200 or 202 is success; anything else makes the run fail.
"""
import json
import os
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
NS = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def sitemap_urls(xml_bytes):
    root = ET.fromstring(xml_bytes)
    return [e.text.strip() for e in root.findall("s:url/s:loc", NS) if e.text]


def fetch(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "tariff-impact-indexnow/1.0", "Cache-Control": "no-cache"}
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def wait_until_live(local_sitemap):
    want = sitemap_urls(local_sitemap)
    deadline = time.time() + WAIT_SECONDS
    while True:
        try:
            live_key = fetch(f"{SITE}/{KEY}.txt").decode().strip()
            live_urls = sitemap_urls(fetch(f"{SITE}/sitemap.xml?v={int(time.time())}"))
            if live_key == KEY and live_urls == want:
                print("The live site serves this commit's sitemap and the key file.")
                return True
            print("The live site has not updated yet; waiting.")
        except Exception as e:  # a network blip, or a 404 while it deploys
            print(f"The live site is not ready: {e}")
        if time.time() >= deadline:
            return False
        time.sleep(30)


def page_url(path):
    """Repository path of a top-level page -> its live address, else None."""
    path = path.strip()
    if "/" in path or not path.endswith(".html"):
        return None
    return SITE + "/" if path == "index.html" else f"{SITE}/{path[:-5]}"


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    with open("sitemap.xml", "rb") as f:
        local = f.read()
    listed = sitemap_urls(local)
    if mode == "changed":
        with open(sys.argv[2]) as f:
            changed = {page_url(p) for p in f.read().splitlines()}
        urls = [u for u in listed if u in changed]
    elif mode == "all":
        urls = listed
    else:
        print(f"Unknown mode {mode!r}: use 'all' or 'changed FILE'.")
        return 2
    if not urls:
        print("No page in the sitemap changed: nothing to send.")
        return 0
    if not wait_until_live(local):
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
    print(f"IndexNow answered HTTP {status} {text[:500]}")
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a") as f:
            f.write(f"IndexNow: sent {len(urls)} address(es); answer HTTP {status}.\n")
    return 0 if status in (200, 202) else 1


if __name__ == "__main__":
    sys.exit(main())

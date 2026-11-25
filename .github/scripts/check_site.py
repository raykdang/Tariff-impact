#!/usr/bin/env python3
"""Checks the site's files before they reach https://tariff-impact.com/.

Run it from the repository root:  python3 .github/scripts/check_site.py
It uses only Python's standard library. It prints every problem it finds and
exits with status 1 if there is any, so a GitHub Actions run goes red.

What counts as a page
  Every .html file in the repository (outside .git, node_modules, .wrangler)
  is a page, served at its name without ".html" (index.html is "/").
  A page is PUBLIC when it is not marked noindex and its canonical link points
  to its own address. Public pages must be in sitemap.xml. Pages marked
  noindex (like /widget, the iframe calculator) and pages whose canonical
  points to another page (like tariff-calculator.html, an old copy whose
  canonical is the home page) must stay out of it. A 404.html page, if one is
  ever added, is never public.

The checks
  1. links:     every internal href/src/srcset in every page resolves to a file
                in the repository. "/guide" and "/guide.html" both count as
                guide.html; "/dir/" counts as dir/index.html. A "#anchor" on a
                page link must match an id (or a[name]) on the target page.
                Links into HTML comments and <script> code are not checked.
  2. sitemap:   sitemap.xml parses as XML, every <loc> is on
                https://tariff-impact.com, is listed once, points to a public
                page, and every public page is listed.
  3. head:      each page has a non-empty <title>, a non-empty meta
                description, and exactly one canonical link on
                https://tariff-impact.com that points to a page in the repo.
  4. html:      each page parses: a doctype, one <html>, <head> and <body>,
                no unclosed or stray block tags, no unterminated comment or tag.
                Only structural faults fail; style nits do not.
"""

import os
import re
import sys
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote

SITE = "tariff-impact.com"
ORIGIN = "https://" + SITE
SKIP_DIRS = {".git", "node_modules", ".wrangler", ".github"}

# Elements that never have an end tag.
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link",
        "meta", "param", "source", "track", "wbr"}
# Elements whose end tag HTML lets you leave out: never an error to leave open.
OPTIONAL_END = {"html", "head", "body", "p", "li", "dt", "dd", "option",
                "optgroup", "tr", "td", "th", "thead", "tbody", "tfoot",
                "colgroup", "caption", "rp", "rt"}

problems = []


def problem(where, msg):
    problems.append(f"{where}: {msg}")


class Page(HTMLParser):
    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name = name
        self.stack = []          # (tag, line)
        self.ids = set()
        self.refs = []           # (attr, value, line)
        self.title = None
        self._in_title = False
        self.descriptions = []
        self.canonicals = []
        self.robots = ""
        self.doctype = False
        self.counts = {"html": 0, "head": 0, "body": 0}

    # --- structure ---
    def handle_decl(self, decl):
        if decl.lower().startswith("doctype"):
            self.doctype = True

    def handle_starttag(self, tag, attrs):
        self._attrs(tag, attrs)
        if tag in self.counts:
            self.counts[tag] += 1
        if tag == "title":
            self._in_title = True
            self.title = ""
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self._attrs(tag, attrs)
        if tag in self.counts:
            self.counts[tag] += 1

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag in VOID:
            return
        line = self.getpos()[0]
        open_tags = [t for t, _ in self.stack]
        if tag not in open_tags:
            if tag not in OPTIONAL_END:
                problem(f"{self.name}:{line}", f"html: </{tag}> closes nothing that is open")
            return
        while self.stack:
            t, l = self.stack.pop()
            if t == tag:
                break
            if t not in OPTIONAL_END:
                problem(f"{self.name}:{l}", f"html: <{t}> is not closed before </{tag}> on line {line}")

    def handle_data(self, data):
        if self._in_title:
            self.title += data

    def finish(self):
        self.close()
        rest = self.rawdata.strip() if self.rawdata else ""
        if rest:
            problem(self.name, f"html: unterminated markup at the end: {rest[:60]!r}")
        for t, l in self.stack:
            if t not in OPTIONAL_END:
                problem(f"{self.name}:{l}", f"html: <{t}> is never closed")
        if not self.doctype:
            problem(self.name, "html: no <!doctype html>")
        for t, n in self.counts.items():
            if n != 1:
                problem(self.name, f"html: {n} <{t}> elements, expected 1")

    # --- what the other checks need ---
    def _attrs(self, tag, attrs):
        a = {k: (v or "") for k, v in attrs}
        line = self.getpos()[0]
        if "id" in a:
            self.ids.add(a["id"])
        if tag == "a" and "name" in a:
            self.ids.add(a["name"])
        if tag == "meta":
            nm = a.get("name", "").lower()
            if nm == "description":
                self.descriptions.append(a.get("content", ""))
            if nm == "robots":
                self.robots = a.get("content", "").lower()
        if tag == "link" and "canonical" in a.get("rel", "").lower().split():
            self.canonicals.append(a.get("href", ""))
        for attr in ("href", "src", "poster", "action"):
            if attr in a:
                self.refs.append((attr, a[attr].strip(), line))
        for attr in ("srcset", "imagesrcset"):
            if attr in a:
                for part in a[attr].split(","):
                    url = part.strip().split(" ")[0]
                    if url:
                        self.refs.append((attr, url, line))


def find_pages():
    pages = []
    for root, dirs, files in os.walk("."):
        dirs[:] = sorted(d for d in dirs if d not in SKIP_DIRS)
        for f in sorted(files):
            if f.endswith(".html"):
                pages.append(os.path.normpath(os.path.join(root, f)))
    return pages


def address(page):
    """The served path of a page file: index.html -> /, guide.html -> /guide."""
    p = "/" + page.replace(os.sep, "/")
    if p.endswith("/index.html"):
        return p[: -len("index.html")]
    return p[: -len(".html")]


def resolve(path):
    """The repository file a served path maps to, or None."""
    rel = unquote(path).lstrip("/")
    if rel == "" or rel.endswith("/"):
        cand = [rel + "index.html"]
    else:
        cand = [rel, rel + ".html", rel + "/index.html"]
    for c in cand:
        c = os.path.normpath(c)
        if c.startswith(".."):
            return None
        if os.path.isfile(c):
            return c
    return None


def internal_path(url, page):
    """Return (path, fragment) for an internal URL, or None for an external one."""
    if url == "" or url.startswith(("mailto:", "tel:", "javascript:", "data:", "sms:")):
        return None
    parts = urlsplit(url)
    if parts.scheme in ("http", "https") or url.startswith("//"):
        host = (parts.hostname or "").lower()
        if host not in (SITE, "www." + SITE):
            return None
        return (parts.path or "/", parts.fragment)
    if parts.scheme:
        return None
    path = parts.path
    if path == "":
        return (address(page), parts.fragment)     # "#x" or "?q" on this page
    if not path.startswith("/"):
        base = address(page)
        base = base[: base.rfind("/") + 1]
        path = base + path
    # normalise ./ and ../
    out = []
    for seg in path.split("/"):
        if seg == "..":
            if out:
                out.pop()
        elif seg != ".":
            out.append(seg)
    return ("/".join(out) or "/", parts.fragment)


def main():
    pages = find_pages()
    if not pages:
        problem(".", "no .html pages found: run from the repository root")
    parsed = {}
    for page in pages:
        with open(page, encoding="utf-8") as fh:
            text = fh.read()
        p = Page(page)
        try:
            p.feed(text)
            p.finish()
        except Exception as e:  # the parser itself gave up
            problem(page, f"html: parser error: {e}")
        parsed[page] = p

    # 3. head: title, description, canonical
    public = set()
    for page, p in parsed.items():
        if not (p.title or "").strip():
            problem(page, "head: missing or empty <title>")
        if len(p.descriptions) != 1 or not p.descriptions[0].strip():
            problem(page, f"head: needs one non-empty meta description, found {len(p.descriptions)}")
        if len(p.canonicals) != 1:
            problem(page, f"head: needs exactly one canonical link, found {len(p.canonicals)}")
            continue
        canon = p.canonicals[0]
        cp = urlsplit(canon)
        if cp.scheme != "https" or cp.hostname != SITE or cp.query or cp.fragment:
            problem(page, f"head: canonical {canon!r} is not a plain address on {ORIGIN}")
            continue
        target = resolve(cp.path or "/")
        if target is None:
            problem(page, f"head: canonical {canon!r} points to no page in the repository")
        if cp.path.endswith(".html"):
            problem(page, f"head: canonical {canon!r} should use the address without .html")
        own = (cp.path or "/") == address(page)
        if own and "noindex" not in p.robots and os.path.basename(page) != "404.html":
            public.add(address(page))

    # 1. links
    for page, p in parsed.items():
        for attr, url, line in p.refs:
            ip = internal_path(url, page)
            if ip is None:
                continue
            path, frag = ip
            target = resolve(path)
            if target is None:
                problem(f"{page}:{line}", f"links: {attr}={url!r} points to no file in the repository")
                continue
            if frag and target.endswith(".html") and target in parsed:
                if unquote(frag) not in parsed[target].ids:
                    problem(f"{page}:{line}", f"links: {attr}={url!r}: no id {frag!r} on {target}")

    # 2. sitemap
    if not os.path.isfile("sitemap.xml"):
        problem("sitemap.xml", "sitemap: file is missing")
    else:
        try:
            root = ET.parse("sitemap.xml").getroot()
        except ET.ParseError as e:
            problem("sitemap.xml", f"sitemap: does not parse: {e}")
            root = None
        if root is not None:
            ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
            if root.tag != ns + "urlset":
                problem("sitemap.xml", f"sitemap: root is {root.tag}, expected {ns}urlset")
            seen = {}
            for u in root.iter(ns + "url"):
                loc_el = u.find(ns + "loc")
                loc = (loc_el.text or "").strip() if loc_el is not None else ""
                if not loc:
                    problem("sitemap.xml", "sitemap: a <url> without a <loc>")
                    continue
                lp = urlsplit(loc)
                if lp.scheme != "https" or lp.hostname != SITE:
                    problem("sitemap.xml", f"sitemap: {loc} is not on {ORIGIN}")
                    continue
                path = lp.path or "/"
                seen[path] = seen.get(path, 0) + 1
                if seen[path] == 2:
                    problem("sitemap.xml", f"sitemap: {loc} is listed more than once")
                if path not in public:
                    if resolve(path) is None:
                        problem("sitemap.xml", f"sitemap: {loc} has no page in the repository")
                    else:
                        problem("sitemap.xml", f"sitemap: {loc} is not a public page (noindex, "
                                "canonical elsewhere, or listed with .html)")
            for path in sorted(public - set(seen)):
                problem("sitemap.xml", f"sitemap: public page {ORIGIN}{path} is not listed")

    print(f"Checked {len(pages)} pages, {len(public)} public.")
    if problems:
        for line in problems:
            print("FAIL " + line)
        print(f"{len(problems)} problem(s).")
        return 1
    print("All site checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

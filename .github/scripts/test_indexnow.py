"""Tests for indexnow.py's wait: no engine is told about a commit before
Cloudflare's build of it has passed, or, only once that check has not shown
up in time, before the live site serves it.

  python3 -m unittest discover -s .github/scripts
"""
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import indexnow  # noqa: E402


class FakeClock:
    """time.time and time.sleep for the wait loop: sleep only moves the clock."""

    def __init__(self):
        self.now = 0.0

    def time(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


def states(clock, timeline, then):
    """A build check that returns timeline's state while clock.now < its time,
    else `then`. timeline: [(until_seconds, state), ...]."""
    def check():
        for until, state in timeline:
            if clock.now < until:
                return state
        return then
    return check


class WaitUntilLive(unittest.TestCase):
    def setUp(self):
        self.saved = (indexnow.WAIT_SECONDS, indexnow.GRACE_SECONDS,
                      indexnow.FALLBACK_SECONDS, indexnow.POLL_SECONDS)
        indexnow.WAIT_SECONDS, indexnow.GRACE_SECONDS = 900, 300
        indexnow.FALLBACK_SECONDS, indexnow.POLL_SECONDS = 300, 30
        self.clock = FakeClock()
        self.compared_at = []

    def tearDown(self):
        (indexnow.WAIT_SECONDS, indexnow.GRACE_SECONDS,
         indexnow.FALLBACK_SECONDS, indexnow.POLL_SECONDS) = self.saved

    def pages(self, live_from=0.0):
        """Page comparison that matches from live_from on (None: never)."""
        def mismatches():
            self.compared_at.append(self.clock.now)
            if live_from is not None and self.clock.now >= live_from:
                return []
            return ["index.html"]
        return mismatches

    def wait(self, check, mismatches):
        return indexnow.wait_until_live(
            [], check=check, mismatches=mismatches,
            clock=self.clock.time, sleep=self.clock.sleep)

    def test_check_appears_late_then_passes(self):
        # The case of e02aecf: no check for five minutes, though the live pages
        # already match. It must wait for the check, not send at once.
        check = states(self.clock, [(300, "missing")], "success")
        self.assertTrue(self.wait(check, self.pages(live_from=0)))
        self.assertGreaterEqual(self.clock.now, 300)
        self.assertTrue(all(t >= 300 for t in self.compared_at),
                        "compared pages before the build check passed")

    def test_check_appears_running_then_passes(self):
        check = states(self.clock, [(120, "missing"), (330, "running")], "success")
        self.assertTrue(self.wait(check, self.pages(live_from=0)))
        self.assertGreaterEqual(self.clock.now, 330)

    def test_check_appears_and_fails(self):
        check = states(self.clock, [(300, "missing")], "failed")
        self.assertFalse(self.wait(check, self.pages(live_from=0)))
        self.assertEqual(self.compared_at, [])

    def test_passed_but_pages_differ_waits_grace_then_sends(self):
        check = states(self.clock, [(300, "missing")], "success")
        self.assertTrue(self.wait(check, self.pages(live_from=None)))
        self.assertGreaterEqual(self.clock.now, 300 + 300)
        self.assertLess(self.clock.now, 300 + 300 + 30 + 1)

    def test_passed_then_pages_catch_up(self):
        check = states(self.clock, [(300, "missing")], "success")
        self.assertTrue(self.wait(check, self.pages(live_from=400)))
        self.assertGreaterEqual(self.clock.now, 400)
        self.assertLess(self.clock.now, 600)

    def test_check_never_appears_falls_back_after_timeout(self):
        check = states(self.clock, [], "missing")
        self.assertTrue(self.wait(check, self.pages(live_from=0)))
        self.assertGreaterEqual(self.clock.now, 900)
        self.assertTrue(all(t >= 900 for t in self.compared_at),
                        "fell back to the page comparison before the timeout")

    def test_check_still_running_at_timeout_falls_back(self):
        check = states(self.clock, [], "running")
        self.assertTrue(self.wait(check, self.pages(live_from=0)))
        self.assertGreaterEqual(self.clock.now, 900)

    def test_fallback_pages_never_match_sends_nothing(self):
        check = states(self.clock, [], "missing")
        self.assertFalse(self.wait(check, self.pages(live_from=None)))
        self.assertGreaterEqual(self.clock.now, 900 + 300)

    def test_check_fails_during_fallback(self):
        check = states(self.clock, [(1000, "missing")], "failed")
        self.assertFalse(self.wait(check, self.pages(live_from=None)))
        self.assertLess(self.clock.now, 1000 + 30 + 1)

    def test_no_token_uses_page_comparison_at_once(self):
        check = states(self.clock, [], "unavailable")
        self.assertTrue(self.wait(check, self.pages(live_from=0)))
        self.assertEqual(self.clock.now, 0)

    def test_no_token_pages_never_match(self):
        check = states(self.clock, [], "unavailable")
        self.assertFalse(self.wait(check, self.pages(live_from=None)))
        self.assertGreaterEqual(self.clock.now, 300)
        self.assertLess(self.clock.now, 900)


class BuildCheck(unittest.TestCase):
    def read(self, runs=None, error=None):
        def fetcher(url, headers):
            self.assertIn("/repos/o/r/commits/abc/check-runs", url)
            self.assertEqual(headers["Authorization"], "Bearer t")
            if error:
                raise error
            return json.dumps({"check_runs": runs or []}).encode()
        return indexnow.build_check("abc", "o/r", "t", fetcher=fetcher)

    def test_states(self):
        other = {"name": "Links, sitemap, head tags, HTML", "status": "completed", "conclusion": "failure"}
        cf = lambda status, conclusion=None: {
            "name": "Workers Builds: tariff-impact", "status": status, "conclusion": conclusion}
        self.assertEqual(self.read([]), "missing")
        self.assertEqual(self.read([other]), "missing")
        self.assertEqual(self.read(error=OSError("HTTP 502")), "missing")
        self.assertEqual(self.read([other, cf("queued")]), "running")
        self.assertEqual(self.read([cf("in_progress")]), "running")
        self.assertEqual(self.read([other, cf("completed", "success")]), "success")
        self.assertEqual(self.read([cf("completed", "failure")]), "failed")
        self.assertEqual(self.read([cf("completed", "cancelled")]), "failed")

    def test_no_token(self):
        self.assertEqual(indexnow.build_check("abc", "o/r", ""), "unavailable")
        self.assertEqual(indexnow.build_check(None, "o/r", "t"), "unavailable")


if __name__ == "__main__":
    unittest.main()

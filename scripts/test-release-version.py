#!/usr/bin/env python3
"""Test upstream pinning and APK naming, including failure without mutation."""
import base64
import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("release_version", Path(__file__).with_name("prepare-release.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ReleaseVersionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.makefile = self.root / "Makefile"
        self.original = "PKG_NAME:=gl-ui-avahi-daemon\nPKG_VERSION:=1.0.0\nPKG_RELEASE:=7\n"
        self.makefile.write_text(self.original)
        self.upstream = "PKG_NAME:=avahi\nPKG_VERSION:=0.9_rc5\nPKG_RELEASE:=1\n"
        self.calls = []
        self.ref = "master"

    def fetch(self, path):
        self.calls.append(path)
        ref = module.urllib.parse.quote(self.ref, safe="")
        if path == "commits/" + ref:
            return {"sha": "f" * 40}
        if path == f'contents/libs/avahi/Makefile?ref={"f" * 40}':
            return {"encoding": "base64", "content": base64.b64encode(self.upstream.encode()).decode() + "\n"}
        self.fail(f"Unexpected request: {path}")

    def prepare(self):
        with patch.object(module, "github_json", side_effect=self.fetch), patch.object(
            module.subprocess, "check_output", return_value="abcdef0" + "1" * 33 + "\n"
        ):
            return module.prepare(self.root, self.ref)

    def test_tracks_package_version_release_and_real_ui_hash(self):
        values = self.prepare()
        self.assertEqual(values["version"], "0.9_rc5~abcdef0")
        self.assertEqual(values["release"], "1")
        self.assertEqual(values["tag"], "v0.9_rc5-r1+abcdef0")
        self.assertEqual(values["filename"], "gl-ui-avahi-daemon-0.9_rc5-abcdef0-r1.apk")
        self.assertEqual(values["upstream_commit"], "f" * 40)
        self.assertEqual(len(values["project_commit"]), 40)
        self.assertIn("PKG_VERSION:=0.9_rc5~abcdef0\nPKG_RELEASE:=1\n", self.makefile.read_text())
        self.assertEqual(self.calls, ["commits/master", f'contents/libs/avahi/Makefile?ref={"f" * 40}'])
        self.assertEqual(self.prepare(), values, "repeat preparation does not append another hash")

    def test_release_revision_and_stable_versions_are_preserved(self):
        self.upstream = "PKG_NAME:=avahi\nPKG_VERSION:=0.10.2\nPKG_RELEASE:=12\n"
        values = self.prepare()
        self.assertEqual(values["version"], "0.10.2~abcdef0")
        self.assertEqual(values["release"], "12")

    def test_named_branch_is_pinned_before_reading(self):
        self.ref = "openwrt-25.12"
        self.assertEqual(self.prepare()["upstream_ref"], self.ref)
        self.ref = "releases/test"
        self.prepare()
        self.assertIn("commits/releases%2Ftest", self.calls)

    def test_invalid_upstream_fails_without_writing(self):
        for version, release in (("$(VERSION)", "1"), ("0.9-rc5", "1"), ("0.9_rc5~fffffff", "1"),
                                 ("0.9", "$(AUTORELEASE)"), ("0.9", "0"), ("0.9", "-1")):
            with self.subTest(version=version, release=release):
                self.upstream = f"PKG_NAME:=avahi\nPKG_VERSION:={version}\nPKG_RELEASE:={release}\n"
                with self.assertRaises(ValueError):
                    self.prepare()
                self.assertEqual(self.makefile.read_text(), self.original)

    def test_missing_duplicate_or_wrong_package_metadata_is_rejected(self):
        for source in ("PKG_NAME:=avahi\nPKG_VERSION:=0.9\n",
                       "PKG_NAME:=avahi\nPKG_VERSION:=0.9\nPKG_RELEASE:=1\nPKG_RELEASE:=2\n",
                       "PKG_NAME:=other\nPKG_VERSION:=0.9\nPKG_RELEASE:=1\n"):
            self.upstream = source
            with self.assertRaises(ValueError):
                self.prepare()
            self.assertEqual(self.makefile.read_text(), self.original)

    def test_network_failure_leaves_makefile_unchanged(self):
        with patch.object(module, "github_json", side_effect=OSError("network failure")):
            with self.assertRaises(OSError):
                module.prepare(self.root)
        self.assertEqual(self.makefile.read_text(), self.original)

    def test_unborn_repository_has_no_fabricated_hash(self):
        with patch.object(module, "github_json", side_effect=self.fetch), patch.object(
            module.subprocess, "check_output", side_effect=subprocess.CalledProcessError(128, "git")
        ):
            with self.assertRaisesRegex(ValueError, "real Git commit"):
                module.prepare(self.root)
        self.assertEqual(self.makefile.read_text(), self.original)

    def test_malformed_upstream_commit_and_base64_are_rejected(self):
        with patch.object(module, "github_json", return_value={"sha": "bad"}):
            with self.assertRaises(ValueError):
                module.prepare(self.root)
        with patch.object(module, "github_json", side_effect=[{"sha": "f" * 40}, {"encoding": "base64", "content": "!"}]):
            with self.assertRaises(ValueError):
                module.prepare(self.root)
        self.assertEqual(self.makefile.read_text(), self.original)


if __name__ == "__main__":
    unittest.main()

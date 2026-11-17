#!/usr/bin/env python3
"""Pin the UI release to OpenWrt's Avahi package version and this UI commit."""
import argparse
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.parse
import urllib.request


UPSTREAM = "openwrt/packages"
UPSTREAM_PATH = "libs/avahi/Makefile"
ROOT = Path(__file__).resolve().parent.parent


def github_json(path):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "avahi-ui-release"}
    if os.environ.get("GH_TOKEN"):
        headers["Authorization"] = "Bearer " + os.environ["GH_TOKEN"]
    request = urllib.request.Request(
        f"https://api.github.com/repos/{UPSTREAM}/{path}", headers=headers
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def metadata(text, key):
    values = re.findall(rf"^{re.escape(key)}\s*:=\s*(\S+)\s*$", text, re.MULTILINE)
    if len(values) != 1:
        raise ValueError(f"Expected one literal {key} assignment")
    return values[0]


def upstream_version(ref="master"):
    if not isinstance(ref, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/-]*", ref):
        raise ValueError("Invalid upstream ref")
    commit = github_json("commits/" + urllib.parse.quote(ref, safe=""))["sha"]
    if not isinstance(commit, str) or not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Invalid upstream commit")
    # Resolve a moving branch once, then read the file at an immutable commit.
    source = github_json(f"contents/{UPSTREAM_PATH}?ref={commit}")
    if source.get("encoding") != "base64":
        raise ValueError("Expected base64 upstream Makefile")
    encoded = "".join(source["content"].split())
    text = base64.b64decode(encoded, validate=True).decode("utf-8")
    if metadata(text, "PKG_NAME") != "avahi":
        raise ValueError("Expected the upstream Avahi package")
    version, release = metadata(text, "PKG_VERSION"), metadata(text, "PKG_RELEASE")
    # Preserve APK-compatible OpenWrt prerelease spellings such as 0.9_rc5.
    if not re.fullmatch(r"[0-9]+(?:\.[0-9]+)*(?:_(?:alpha|beta|pre|rc)[0-9]*)?", version):
        raise ValueError("Unsupported upstream Avahi version")
    if not re.fullmatch(r"[1-9][0-9]*", release):
        raise ValueError("Unsupported upstream Avahi release")
    return {"upstream_version": version, "release": release,
            "upstream_repo": UPSTREAM, "upstream_path": UPSTREAM_PATH,
            "upstream_ref": ref, "upstream_commit": commit}


def prepare(root=ROOT, upstream_ref="master"):
    upstream = upstream_version(upstream_ref)
    try:
        commit = subprocess.check_output(
            ["git", "-C", str(root), "rev-parse", "HEAD"], text=True, stderr=subprocess.PIPE
        ).strip()
    except subprocess.CalledProcessError as error:
        raise ValueError("A real Git commit is required; commit the UI source before preparing a release") from error
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("Invalid project commit")
    version = f'{upstream["upstream_version"]}~{commit[:7]}'
    makefile = root / "Makefile"
    text = makefile.read_text()
    name = metadata(text, "PKG_NAME")
    if name != "gl-ui-avahi-daemon":
        raise ValueError("Unexpected UI package name")
    for key, value in (("PKG_VERSION", version), ("PKG_RELEASE", upstream["release"])):
        metadata(text, key)
        text = re.sub(rf"^{key}\s*:=.*$", f"{key}:={value}", text, flags=re.MULTILINE)
    outputs = {"name": name, "version": version, "release": upstream["release"],
               "tag": f'v{upstream["upstream_version"]}-r{upstream["release"]}+{commit[:7]}',
               "filename": f'{name}-{version.replace("~", "-")}-r{upstream["release"]}.apk',
               "project_commit": commit, **upstream}
    if any("\n" in value or "\r" in value for value in outputs.values()):
        raise ValueError("Invalid release metadata")
    # All input validation completes before the only mutation.
    makefile.write_text(text)
    return outputs


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--upstream-ref", default="master", help="OpenWrt packages branch or commit (default: master)")
    args = parser.parse_args()
    try:
        values = prepare(upstream_ref=args.upstream_ref)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f"Cannot prepare release: {error}\n")
    output = "".join(f"{key}={value}\n" for key, value in values.items())
    print(output, end="")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a") as stream:
            stream.write(output)

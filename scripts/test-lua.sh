#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
test_lua="${LUA:-lua5.1}"
command -v "$test_lua" >/dev/null 2>&1 || test_lua="${LUA:-lua}"
command -v "$test_lua" >/dev/null 2>&1 || { echo 'Install Lua 5.1 or set LUA=/path/to/lua5.1.' >&2; exit 1; }
fixture="$(mktemp)"
trap 'rm -f "$fixture"' EXIT HUP INT TERM
node scripts/schema-fixture.cjs > "$fixture"
"$test_lua" scripts/test-model.lua "$fixture"
"$test_lua" scripts/test-rpc.lua "$fixture"
"$test_lua" -e 'local root=os.getenv("AVAHI_TEST_ROOT") or "files"; assert(loadfile(root.."/usr/lib/oui-httpd/rpc/avahi-daemon")); assert(loadfile(root.."/usr/share/gl-validator.d/avahi-daemon.lua"))'
sh -n scripts/install.sh scripts/uninstall.sh scripts/build-apk.sh scripts/deploy-apk.sh

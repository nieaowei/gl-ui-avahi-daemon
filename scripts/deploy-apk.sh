#!/bin/sh
# Install on a GL.iNet router using SSH credentials/agent supplied by the caller.
set -eu
package_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
target=${1:?Usage: deploy-apk.sh user@router [package.apk]}
version=$(awk -F':=' '$1=="PKG_VERSION" {print $2; exit}' "$package_dir/Makefile" | tr '~' '-')
release=$(awk -F':=' '$1=="PKG_RELEASE" {print $2; exit}' "$package_dir/Makefile")
artifact=${2:-"$package_dir/dist/gl-ui-avahi-daemon-$version-r$release.apk"}
[ -s "$artifact" ] || { echo "APK not found: $artifact" >&2; exit 1; }
filename=$(basename "$artifact")
case "$filename" in gl-ui-avahi-daemon-*.apk) ;; *) echo 'Unexpected APK name.' >&2; exit 1 ;; esac
case "$filename" in *[!a-zA-Z0-9._~-]*) echo 'Unsafe APK filename.' >&2; exit 1 ;; esac
ssh_run() {
    if [ -n "${AVAHI_SSH_CONTROL_PATH:-}" ]; then ssh -o ConnectTimeout=10 -S "$AVAHI_SSH_CONTROL_PATH" "$target" "$@"
    else ssh -o ConnectTimeout=10 "$target" "$@"; fi
}
ssh_run 'set -e; case "$(apk --version)" in "apk-tools 3."*) ;; *) exit 1 ;; esac; test -f /usr/share/gl-ngx/oui-rpc.lua; test -d /www/views; test -f /etc/avahi/avahi-daemon.conf; nginx -t'
remote_dir=$(ssh_run 'mktemp -d /tmp/avahi-ui-deploy.XXXXXX')
case "$remote_dir" in /tmp/avahi-ui-deploy.*) ;; *) echo 'Invalid remote temporary path.' >&2; exit 1 ;; esac
case "$remote_dir" in *[!a-zA-Z0-9/._-]*) exit 1 ;; esac
trap 'ssh_run "rm -f $remote_dir/$filename; rmdir $remote_dir" >/dev/null 2>&1 || true' EXIT HUP INT TERM
if [ -n "${AVAHI_SSH_CONTROL_PATH:-}" ]; then
    scp -O -o "ControlPath=$AVAHI_SSH_CONTROL_PATH" "$artifact" "$target:$remote_dir/$filename"
else scp -O "$artifact" "$target:$remote_dir/$filename"; fi
if command -v sha256sum >/dev/null 2>&1; then checksum=$(sha256sum "$artifact" | awk '{print $1}')
else checksum=$(shasum -a 256 "$artifact" | awk '{print $1}'); fi
ssh_run sh -s -- "$remote_dir" "$filename" "$checksum" <<'REMOTE'
set -eu
cd "$1"
printf '%s  %s\n' "$3" "$2" | sha256sum -c -
apk verify --allow-untrusted "$2"
apk add --simulate --allow-untrusted "$PWD/$2"
backup="/root/avahi-ui-backup/apk-$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup"
chmod 700 /root/avahi-ui-backup "$backup"
cp -p /etc/avahi/avahi-daemon.conf "$backup/avahi-daemon.conf"
for file in /usr/lib/lua/avahi-ui/model.lua /usr/lib/oui-httpd/rpc/avahi-daemon /usr/share/gl-validator.d/avahi-daemon.lua /usr/share/oui/menu.d/avahi-daemon.json /usr/share/avahi-ui/schema.json /www/views/gl-sdk4-ui-avahi-daemon.common.js /www/views/gl-sdk4-ui-avahi-daemon.common.js.gz; do
    if [ -e "$file" ]; then mkdir -p "$backup$(dirname "$file")"; cp -p "$file" "$backup$file"; fi
done
apk add --allow-untrusted "$PWD/$2"
cmp /etc/avahi/avahi-daemon.conf "$backup/avahi-daemon.conf"
# A script-installed gzip file would otherwise shadow the new view.
rm -f /www/views/gl-sdk4-ui-avahi-daemon.common.js.gz
lua -e 'assert(require("avahi-ui.model")); assert(loadfile("/usr/lib/oui-httpd/rpc/avahi-daemon")); local fs=require("nixio.fs"); local json=require("cjson.safe"); local text=assert(fs.readfile("/usr/share/avahi-ui/schema.json")); assert(json.decode(text)); print("Installed Lua and schema verified")'
nginx -t
apk info -v gl-ui-avahi-daemon
echo "Backup: $backup"
REMOTE
ssh_run lua - < "$package_dir/scripts/test-live.lua"

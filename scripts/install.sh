#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ "$(id -u)" = 0 ] || { echo 'Run as root on the router.' >&2; exit 1; }
[ -f /usr/share/gl-ngx/oui-rpc.lua ] && [ -d /www/views ] || { echo 'GL.iNet SDK4 is required.' >&2; exit 1; }
[ -x /etc/init.d/avahi-daemon ] && [ -f /etc/avahi/avahi-daemon.conf ] || { echo 'Install avahi-daemon first.' >&2; exit 1; }
nginx -t
lua -e 'assert(require("nixio.fs")); assert(require("luci.ip")); assert(require("cjson.safe")); assert(loadfile("files/usr/lib/lua/avahi-ui/model.lua")); assert(loadfile("files/usr/lib/oui-httpd/rpc/avahi-daemon")); assert(loadfile("files/usr/share/gl-validator.d/avahi-daemon.lua"))'
lua -e 'local text=assert(require("nixio.fs").readfile("files/usr/share/avahi-ui/schema.json")); assert(require("cjson.safe").decode(text))'
backup="/root/avahi-ui-backup/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup"
chmod 700 /root/avahi-ui-backup "$backup"
cp -p /etc/avahi/avahi-daemon.conf "$backup/avahi-daemon.conf"
for path in usr/lib/lua/avahi-ui/model.lua usr/lib/oui-httpd/rpc/avahi-daemon usr/share/gl-validator.d/avahi-daemon.lua usr/share/oui/menu.d/avahi-daemon.json usr/share/avahi-ui/schema.json www/views/gl-sdk4-ui-avahi-daemon.common.js; do
    if [ -e "/$path" ]; then
        mkdir -p "$backup/$(dirname "$path")"
        cp -p "/$path" "$backup/$path"
    fi
    mkdir -p "/$(dirname "$path")"
    cp "files/$path" "/$path"
    chmod 644 "/$path"
done
# Remove a stale compressed variant of this view, if a previous install had one.
if [ -e /www/views/gl-sdk4-ui-avahi-daemon.common.js.gz ]; then
    cp -p /www/views/gl-sdk4-ui-avahi-daemon.common.js.gz "$backup/"
    rm /www/views/gl-sdk4-ui-avahi-daemon.common.js.gz
fi
nginx -s reload
echo "Installed Avahi native UI. Backup: $backup"
echo 'Refresh the admin panel and open Applications → Avahi (#/avahi-daemon).'

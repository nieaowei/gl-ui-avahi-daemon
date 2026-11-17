#!/bin/sh
set -eu
[ "$(id -u)" = 0 ] || { echo 'Run as root on the router.' >&2; exit 1; }
nginx -t
rm -f /usr/lib/lua/avahi-ui/model.lua /usr/lib/oui-httpd/rpc/avahi-daemon \
    /usr/share/gl-validator.d/avahi-daemon.lua /usr/share/oui/menu.d/avahi-daemon.json \
    /usr/share/avahi-ui/schema.json /www/views/gl-sdk4-ui-avahi-daemon.common.js \
    /www/views/gl-sdk4-ui-avahi-daemon.common.js.gz
nginx -s reload
echo 'Removed Avahi native UI. Avahi service, configuration and backups are retained.'

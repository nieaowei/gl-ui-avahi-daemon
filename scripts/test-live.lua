-- Run on the router as root. Uses local authenticated RPC; no service restarts.
local json=require 'cjson.safe'
local fs=require 'nixio.fs'
local nixio=require 'nixio'
local uuid=assert(fs.readfile('/proc/sys/kernel/random/uuid')):match('^[%x%-]+')
local request='/tmp/avahi-rpc-check-'..uuid
local function call(object,method,args)
 local body=assert(json.encode({jsonrpc='2.0',id=1,method='call',params={'',object,method,args or {}}}))
 local f=assert(nixio.open(request,nixio.open_flags('wronly','creat','excl'),600));assert(f:write(body)==#body);f:close()
 local p=assert(io.popen("curl -sS --max-time 30 -H 'glinet: 1' -H 'Content-Type: application/json' --data-binary @"..request.." http://127.0.0.1/rpc"))
 local raw=p:read('*a');p:close();fs.unlink(request)
 local decoded=assert(json.decode(raw));assert(not decoded.error,raw);assert(decoded.result and not decoded.result.err_code,raw)
 return decoded.result
end
local before=assert(fs.readfile('/etc/avahi/avahi-daemon.conf'))
local config=call('avahi-daemon','get_config')
local count=0
for _,group in ipairs(config.schema) do for _,field in ipairs(group.fields) do assert(type(config.settings[group.key][field.key])=='string');count=count+1 end end
assert(count==35);print('PASS read all 35 settings and revision: '..config.revision)
local status=call('avahi-daemon','get_status');assert(type(status.running)=='boolean');assert(type(status.ui_version)=='string' and status.ui_version~='');print('PASS procd status and installed UI version: '..status.ui_version)
assert(type(status.umdns)=='table' and type(status.umdns.installed)=='boolean' and type(status.umdns.running)=='boolean' and type(status.umdns.enabled)=='boolean');print('PASS umdns status is available')
local logs=call('avahi-daemon','get_logs');assert(type(logs.text)=='string');print('PASS system log command: '..#logs.text..' bytes')
assert(call('avahi-daemon','set_config',{settings=config.settings,revision=config.revision,apply=false}).success)
assert(fs.readfile('/etc/avahi/avahi-daemon.conf')==before);print('PASS no-op save preserves configuration byte for byte')
local menu=call('ui','get_menu_list')
local encoded=assert(json.encode(menu));assert(encoded:find('avahi%-daemon'));print('PASS native menu discovery')
print('LIVE RPC CHECKS PASSED')

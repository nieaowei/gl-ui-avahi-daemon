-- Exercise the real RPC adapter with in-memory OpenWrt/SDK dependencies.
local schema = dofile(arg[1])
local root = os.getenv("AVAHI_TEST_ROOT") or "files"
local model = dofile(root .. "/usr/lib/lua/avahi-ui/model.lua")
local path = "/etc/avahi/avahi-daemon.conf"
local initial = "# keep\n[server]\nuse-ipv4=yes\nuse-ipv6=yes\n[reflector]\nenable-reflector=no\n"
local files, dirs, commands = {[path] = initial}, {}, {}
local fail_write, fail_rename, fail_command, fail_sync, fail_bus = false, false, false, false, false
local running, enabled, symlink = true, true, false
local umdns_installed, umdns_running, umdns_enabled = true, true, true
local fail_umdns_action
local keep_umdns_running = false
local keep_umdns_stopped = false
local umdns_exit_pending = false
local function revision(raw)
    -- A deterministic token for the mock; production uses OpenResty's MD5.
    local h = 0
    for i = 1, #raw do h = (h * 31 + raw:byte(i)) % 2147483647 end
    return string.format("%032x", h)
end
local function iterator(values)
    local index = 0
    return function() index = index + 1; return values[index] end
end
local fs = {
    readfile = function(name)
        if name == "/proc/sys/kernel/random/uuid" then return "01234567-abcd-1234-5678-0123456789ab\n" end
        if name == "/usr/share/avahi-ui/schema.json" then return "schema", 6 end
        if name == "/lib/apk/db/installed" then return "P:avahi-nodbus-daemon\nV:0.8-r9\n\nP:gl-ui-avahi-daemon\nV:1.0.0-r1\n" end
        return files[name]
    end,
    lstat = function(name) return files[name] and {type = symlink and name == path and "lnk" or "reg"} end,
    access = function(name) return name ~= "/etc/init.d/umdns" or umdns_installed end,
    mkdir = function(name) if dirs[name] then return false end; dirs[name] = true; return true end,
    rmdir = function(name) dirs[name] = nil; return true end,
    dir = function(name)
        if name == "/sys/class/net" then return iterator({"lo", "eth1", "br-lan"}) end
        local entries = {}
        if enabled then entries[#entries + 1] = "S61avahi-daemon" end
        if umdns_enabled then entries[#entries + 1] = "S80umdns" end
        return iterator(entries)
    end,
    rename = function(a, b)
        if fail_rename then return false end
        files[b] = files[a]; files[a] = nil; return true
    end,
    unlink = function(name) files[name] = nil; return true end
}
package.loaded["nixio.fs"] = fs
package.loaded.nixio = {
    open_flags = function() return 0 end,
    open = function(name)
        if files[name] then return nil end
        files[name] = ""
        return {
            write = function(_, text)
                if fail_write then return nil end
                local chunk = text:sub(1, 7) -- Force partial writes.
                files[name] = files[name] .. chunk; return #chunk
            end,
            sync = function() return not fail_sync end,
            close = function() return true end
        }
    end
}
package.loaded["cjson.safe"] = {decode = function(...) assert(select("#", ...) == 1, "SDK cjson.decode requires exactly one argument"); return schema end}
package.loaded["oui.rpc"] = {ERROR_CODE_INVALID_PARAMS = -32602}
package.loaded["oui.ubus"] = {call = function()
    if fail_bus then return nil, "unavailable" end
    return {["avahi-daemon"] = {instances = {instance1 = {running = running}}},
        umdns = {instances = {instance1 = {running = umdns_running}}}}
end}
package.loaded["avahi-ui.model"] = model
package.loaded["luci.ip"] = {new = function(value)
    return {is4 = function() return value == "192.168.8.1" end, is6 = function() return value == "::1" end}
end}
ngx = {md5 = revision, sleep = function()
    if umdns_exit_pending then umdns_running = false; umdns_exit_pending = false end
end, pipe = {spawn = function(argv)
    commands[#commands + 1] = argv
    return {stdout_read_all = function()
        if fail_command or (argv[5] == "/etc/init.d/umdns" and argv[6] == fail_umdns_action) then return "failed\nAVAHI_UI_EXIT:1\n" end
        if argv[5] == "/etc/init.d/avahi-daemon" then
            if argv[6] == "enable" then enabled = true elseif argv[6] == "disable" then enabled = false
            elseif argv[6] == "stop" then running = false else running = true end
        end
        if argv[5] == "/etc/init.d/umdns" then
            if argv[6] == "disable" then umdns_enabled = false elseif argv[6] == "stop" and not keep_umdns_running then umdns_running = false end
            if argv[6] == "enable" then umdns_enabled = true elseif argv[6] == "start" and not keep_umdns_stopped then umdns_running = true end
        end
        return (argv[5] == "/sbin/logread" and "avahi-daemon: ready\n" or "") .. "\nAVAHI_UI_EXIT:0\n"
    end}
end}}
local rpc = dofile(root .. "/usr/lib/oui-httpd/rpc/avahi-daemon")
local passed = 0
local function check(name, condition) assert(condition, name); passed = passed + 1 end
local function save(settings, apply, token)
    return rpc.set_config({settings = settings, apply = apply, revision = token or revision(files[path])})
end
check("status is procd state", rpc.get_status().running)
check("boot state is independent", rpc.get_status().enabled)
check("package version", rpc.get_status().version == "0.8-r9")
check("UI version", rpc.get_status().ui_version == "1.0.0-r1")
local config = rpc.get_config()
check("actual interface names", config.interfaces[1] == "br-lan" and config.interfaces[2] == "eth1" and #config.interfaces == 2)
check("returns revision", config.revision == revision(initial))
check("no-op save", save(config.settings, false).success and files[path] == initial)
check("no-op creates no backup", files[path .. ".gl-ui.bak"] == nil)
check("save succeeds with partial writes", save({server = {["host-name"] = "router"}}, false).success)
check("backup is exact previous contents", files[path .. ".gl-ui.bak"] == initial)
check("save without apply never restarts", #commands == 0)
check("external change rejected", save({}, false, revision(initial)).err_code)
check("conflict releases lock", not dirs["/var/lock/avahi-ui.lock"])
local before = files[path]
check("both families disabled rejected", save({server = {["use-ipv4"] = "no", ["use-ipv6"] = "no"}}).err_code)
check("invalid family configuration not written", files[path] == before)
check("unknown key rejected", save({server = {evil = "yes"}}) == -32602)
check("invalid address rejected", save({publish = {["publish-dns-servers"] = "1.2.3.999"}}) == -32602)
check("CIDR address rejected", save({publish = {["publish-dns-servers"] = "192.168.8.1/24"}}) == -32602)
check("apply type rejected", rpc.set_config({settings = {}, revision = revision(before), apply = "yes"}) == -32602)
check("missing settings rejected", rpc.set_config({revision = revision(before)}) == -32602)
check("arbitrary command rejected", rpc.service({action = "restart;reboot"}) == -32602)
check("start command", rpc.service({action = "start"}).success)
check("command uses fixed argv", commands[#commands][5] == "/etc/init.d/avahi-daemon" and commands[#commands][6] == "start")
check("apply requests restart", save({}, true).applied and commands[#commands][6] == "restart")
enabled = false; running = false
local count = #commands
check("disabled stopped service stays stopped", save({}, true).stopped and #commands == count)
running = true
check("manually running disabled service restarts", save({}, true).applied)
check("boot enable command", rpc.service({action = "enable"}).success and enabled)
check("stop leaves boot enabled", rpc.service({action = "stop"}).success and not running and enabled)
fail_command = true
check("failed command reported", rpc.service({action = "start"}).err_code)
local partial = save({server = {["host-name"] = "changed"}}, true)
check("save remains acknowledged on failed restart", partial.success and partial.saved and partial.warning)
check("saved configuration retained", model.read(files[path]).server["host-name"] == "changed")
fail_command = false
before = files[path]; fail_write = true
check("write failure reported", save({server = {["host-name"] = "fail"}}).err_code)
check("write failure preserves configuration", files[path] == before)
fail_write = false; fail_sync = true
check("sync failure reported", save({server = {["host-name"] = "fail"}}).err_code)
fail_sync = false; fail_rename = true
check("rename failure reported", save({server = {["host-name"] = "fail"}}).err_code)
check("rename failure preserves configuration", files[path] == before)
fail_rename = false
dirs["/var/lock/avahi-ui.lock"] = true
check("concurrent writer rejected", save({}).err_code)
dirs["/var/lock/avahi-ui.lock"] = nil
symlink = true
check("symlink config rejected", rpc.get_config().err_code)
symlink = false; fail_bus = true
check("status error is not stopped", rpc.get_status().err_code)
fail_bus = false
check("logs through fixed command", rpc.get_logs().text == "avahi-daemon: ready\n")
check("logs restricted to avahi", commands[#commands][6] == "-e" and commands[#commands][7] == "avahi")
check("no temporary files left", (function() for name in pairs(files) do if name:find(".ui-", 1, true) then return false end end return true end)())
local umdns = rpc.get_status().umdns
check("umdns running and startup status", umdns.installed and umdns.running and umdns.enabled)
local avahi_running, avahi_enabled, original_config = running, enabled, files[path]
local command_count = #commands
check("disable umdns succeeds", rpc.disable_umdns().success)
check("umdns startup disabled before stopping", commands[command_count + 1][5] == "/etc/init.d/umdns" and commands[command_count + 1][6] == "disable" and commands[command_count + 2][5] == "/etc/init.d/umdns" and commands[command_count + 2][6] == "stop")
check("umdns is stopped and disabled", not rpc.get_status().umdns.running and not rpc.get_status().umdns.enabled)
check("umdns action preserves Avahi", running == avahi_running and enabled == avahi_enabled and files[path] == original_config)
check("repeated disable is idempotent", rpc.disable_umdns().success)
umdns_installed = false; command_count = #commands
check("missing umdns requires no commands", rpc.disable_umdns().missing and #commands == command_count and not rpc.get_status().umdns.installed)
umdns_installed = true; umdns_running = true; umdns_enabled = true; fail_umdns_action = "disable"
local partial_umdns = rpc.disable_umdns()
check("disable failure still attempts stop", partial_umdns.err_code and partial_umdns.err_msg:find("at boot", 1, true) and not umdns_running and umdns_enabled)
umdns_running = true; fail_umdns_action = "stop"
partial_umdns = rpc.disable_umdns()
check("stop failure reports partial state", partial_umdns.err_code and partial_umdns.err_msg:find("Cannot stop umdns", 1, true) and umdns_running and not umdns_enabled)
fail_umdns_action = nil
keep_umdns_running = true
check("successful command cannot hide running umdns", rpc.disable_umdns().err_code and umdns_running)
keep_umdns_running = false; fail_bus = true
check("status verification failure is reported", rpc.disable_umdns().err_code)
fail_bus = false
umdns_running = true; keep_umdns_running = true; umdns_exit_pending = true
check("asynchronous stop waits for procd state", rpc.disable_umdns().success and not umdns_running and not umdns_exit_pending)
keep_umdns_running = false
umdns_running = false; umdns_enabled = false; command_count = #commands
check("enable umdns succeeds", rpc.enable_umdns().success)
check("umdns startup enabled before starting", commands[command_count + 1][5] == "/etc/init.d/umdns" and commands[command_count + 1][6] == "enable" and commands[command_count + 2][5] == "/etc/init.d/umdns" and commands[command_count + 2][6] == "start")
check("umdns is running and enabled", rpc.get_status().umdns.running and rpc.get_status().umdns.enabled)
check("enable action preserves Avahi", running == avahi_running and enabled == avahi_enabled and files[path] == original_config)
check("repeated enable is idempotent", rpc.enable_umdns().success)
umdns_installed = false; command_count = #commands
check("missing umdns cannot be started", rpc.enable_umdns().missing and #commands == command_count)
umdns_installed = true; umdns_running = false; umdns_enabled = false; fail_umdns_action = "enable"
partial_umdns = rpc.enable_umdns()
check("enable failure still attempts start", partial_umdns.err_code and partial_umdns.err_msg:find("at boot", 1, true) and umdns_running and not umdns_enabled)
umdns_running = false; fail_umdns_action = "start"
partial_umdns = rpc.enable_umdns()
check("start failure reports partial state", partial_umdns.err_code and partial_umdns.err_msg:find("Cannot start umdns", 1, true) and not umdns_running and umdns_enabled)
fail_umdns_action = nil; keep_umdns_stopped = true
check("successful command cannot hide stopped umdns", rpc.enable_umdns().err_code and not umdns_running)
keep_umdns_stopped = false; fail_bus = true
check("enable status verification failure is reported", rpc.enable_umdns().err_code)
fail_bus = false
print(passed .. " RPC checks passed")

-- Pure INI transformations. No filesystem, process or SDK dependencies.
local M = {}
local function trim(s) return (s:gsub("^%s+", ""):gsub("%s+$", "")) end
local function split(raw)
    local lines = {}
    for line in (raw .. "\n"):gmatch("(.-)\n") do lines[#lines + 1] = line end
    -- The synthetic final line is not part of the original document.
    if raw:sub(-1) == "\n" then table.remove(lines) end
    return lines
end

function M.read(raw)
    local values, section = {}, nil
    for _, line in ipairs(split(raw)) do
        local header = line:match("^%s*%[([%w_-]+)%]")
        if header then section = header:lower(); values[section] = values[section] or {}
        elseif section then
            local key, value = line:match("^%s*([%w_-]+)%s*=(.-)\r?$")
            -- Avahi prepends INI pairs/groups before applying them, so the
            -- first scalar assignment in the file takes precedence.
            if key then
                key = key:lower()
                if values[section][key] == nil then values[section][key] = trim(value) end
            end
        end
    end
    return values
end

function M.settings(raw, schema)
    local values, result = M.read(raw), {}
    for _, group in ipairs(schema) do
        result[group.key] = {}
        for _, field in ipairs(group.fields) do
            result[group.key][field.key] = (values[group.key] or {})[field.key] or ""
        end
    end
    return result
end

local function domain(value)
    if #value > 253 or value == "" then return false end
    if value:sub(-1) == "." then value = value:sub(1, -2) end
    if value:find("..", 1, true) then return false end
    for label in value:gmatch("[^.]+") do
        if #label > 63 or not label:match("^[%w_-]+$") or label:match("^-") or label:match("-$") then return false end
    end
    return true
end

local function valid(field, value, address)
    -- Avahi 0.8 reads INI lines into a 256-byte buffer, including terminator.
    if type(value) ~= "string" or #value > 253 - #field.key or value:find("[%z\1-\31\127]") then return false end
    if value == "" then return true end -- Remove the override and use Avahi's default.
    if field.kind == "bool" then return value == "yes" or value == "no" end
    if field.kind == "uint" then return value:match("^%d+$") and tonumber(value) <= 2147483647 end
    if field.kind == "enum" then
        for _, choice in ipairs(field.values) do if value == choice then return true end end
        return false
    end
    if field.kind == "host" then return #value <= 63 and domain(value) and not value:find(".", 1, true) end
    if field.kind == "domain" then return domain(value) end
    if field.kind == "interfaces" or field.kind == "domains" or field.kind == "addresses" then
        if value:match("^,") or value:match(",$") or value:find(",,", 1, true) then return false end
        local count = 0
        for item in value:gmatch("[^,]+") do
            count = count + 1
            if item ~= trim(item) then return false end
            if field.kind == "interfaces" and (#item > 15 or not item:match("^[%w_.:@-]+$")) then return false end
            if field.kind == "domains" and not domain(item) then return false end
            if field.kind == "addresses" and not address(item) then return false end
        end
        return count <= 64
    end
    return false
end

function M.validate(settings, schema, address)
    if type(settings) ~= "table" then return nil, "Expected settings object" end
    local definitions = {}
    for _, group in ipairs(schema) do
        definitions[group.key] = {}
        for _, field in ipairs(group.fields) do definitions[group.key][field.key] = field end
    end
    for section, values in pairs(settings) do
        if not definitions[section] or type(values) ~= "table" then return nil, "Unknown section" end
        for key, value in pairs(values) do
            local field = definitions[section][key]
            if not field or not valid(field, value, address) then return nil, "Invalid option: " .. section .. "." .. tostring(key) end
        end
    end
    return true
end

function M.update(raw, changes)
    local values, pending = M.read(raw), {}
    for section, options in pairs(changes) do
        for key, value in pairs(options) do
            if ((values[section] or {})[key] or "") ~= value then
                pending[section] = pending[section] or {}; pending[section][key] = value
            end
        end
    end
    if not next(pending) then return raw end
    local newline = raw:find("\r\n", 1, true) and "\r\n" or "\n"
    local output, section, seen, seen_sections = {}, nil, {}, {}
    local function append_missing()
        local keys = {}
        for key, value in pairs(pending[section] or {}) do if value ~= "" and not seen[key] then keys[#keys + 1] = key end end
        table.sort(keys)
        for _, key in ipairs(keys) do output[#output + 1] = key .. "=" .. pending[section][key]; seen[key] = true end
    end
    for _, original in ipairs(split(raw)) do
        local line = original:gsub("\r$", "")
        local header = line:match("^%s*%[([%w_-]+)%]")
        if header then
            append_missing(); section = header:lower()
            seen_sections[section] = seen_sections[section] or {}; seen = seen_sections[section]
        end
        local key = line:match("^%s*([%w_-]+)%s*=")
        if key then key = key:lower() end
        local value = section and pending[section] and pending[section][key]
        if value ~= nil then
            -- Collapse all active duplicates of a changed option.
            if value ~= "" and not seen[key] then output[#output + 1] = key .. "=" .. value end
            seen[key] = true
        else output[#output + 1] = line end
    end
    append_missing()
    local present = M.read(raw)
    local sections = {}
    for name in pairs(pending) do if not present[name] then sections[#sections + 1] = name end end
    table.sort(sections)
    for _, name in ipairs(sections) do
        section = name; seen = {}
        local any = false
        for _, value in pairs(pending[name]) do if value ~= "" then any = true end end
        if any then output[#output + 1] = "[" .. name .. "]"; append_missing() end
    end
    return table.concat(output, newline) .. newline
end

function M.effective(settings, schema)
    local result = {}
    for _, group in ipairs(schema) do
        result[group.key] = {}
        for _, field in ipairs(group.fields) do
            local value = (settings[group.key] or {})[field.key]
            result[group.key][field.key] = value and value ~= "" and value or field.default
        end
    end
    return result
end

return M

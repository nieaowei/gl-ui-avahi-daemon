-- Detailed validation is performed by the model before any write or command.
local function str(v) return type(v) == "string" end
return {
    set_config = {settings = function(v) return type(v) == "table" end, revision = str},
    service = {action = str},
    disable_umdns = {},
    enable_umdns = {}
}

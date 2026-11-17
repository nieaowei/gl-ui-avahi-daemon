// Convert the actual JSON schema to Lua literals without adding a test dependency.
const path = require('node:path');
const root = path.resolve(process.env.AVAHI_TEST_ROOT || path.join(__dirname, '../files'));
const schema = require(path.join(root, 'usr/share/avahi-ui/schema.json'));
function lua(value) {
    if (Array.isArray(value)) return '{' + value.map(lua).join(',') + '}';
    if (value && typeof value === 'object') return '{' + Object.entries(value).map(([key, v]) => '[' + lua(key) + ']=' + lua(v)).join(',') + '}';
    return JSON.stringify(value);
}
process.stdout.write('return ' + lua(schema) + '\n');

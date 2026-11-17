const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const {buildAssets} = require('./build-assets.cjs');

async function contents(root, prefix = '') {
    const files = {};
    for (const entry of await fs.readdir(path.join(root, prefix), {withFileTypes: true})) {
        const relative = path.join(prefix, entry.name);
        if (entry.isDirectory()) Object.assign(files, await contents(root, relative));
        else files[relative] = await fs.readFile(path.join(root, relative));
    }
    return files;
}

async function main() {
    const source = path.join(__dirname, '../files');
    const original = await contents(source);
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'avahi-assets-test-'));
    try {
        const output = path.join(temp, 'root');
        const stats = await buildAssets(output);
        const built = await contents(output);
        assert.deepEqual(Object.keys(built).sort(), Object.keys(original).sort(), 'all install files preserved');
        for (const [name, bytes] of Object.entries(original)) {
            assert.ok(built[name].length <= bytes.length, name + ' does not grow');
            if (name.endsWith('.json')) assert.deepEqual(JSON.parse(built[name]), JSON.parse(bytes), name + ' data preserved');
        }
        assert.ok(stats.optimized < stats.original * 0.8, 'install payload saves at least 20%');
        const env = {...process.env, AVAHI_TEST_ROOT: output};
        // Reuse the behavior suites against the emitted assets, including real
        // Lua 5.1 parsing and both umdns directions, instead of inspecting text.
        execFileSync(process.execPath, ['--test', path.join(__dirname, 'test-ui.cjs')], {env, encoding: 'utf8'});
        const lua = execFileSync('sh', [path.join(__dirname, 'test-lua.sh')], {env, encoding: 'utf8'});
        console.log('Optimized UI behavior checks passed');
        console.log(lua.trim());
        const second = path.join(temp, 'second');
        await buildAssets(second);
        assert.deepEqual(await contents(second), built, 'build output is reproducible');
        await assert.rejects(buildAssets(output), /must be empty/);
        await assert.rejects(buildAssets(source), /outside the source/);
        await assert.rejects(buildAssets(path.join(source, 'generated')), /outside the source/);
        assert.deepEqual(await contents(source), original, 'readable source files remain unchanged');
        console.log(`Build assets verified: ${stats.original} -> ${stats.optimized} bytes; inventory, JSON data, source preservation and reproducibility`);
    } finally { await fs.rm(temp, {recursive: true, force: true}); }
}

main().catch(error => {console.error(error); process.exitCode = 1;});

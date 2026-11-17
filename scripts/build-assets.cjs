// Shared optimized install tree for OpenWrt and the standalone APK packager.
const fs = require('node:fs/promises');
const path = require('node:path');
const {minify} = require('terser');
const luamin = require('luamin');

async function buildAssets(output) {
    const source = await fs.realpath(path.join(__dirname, '../files'));
    output = path.resolve(output);
    function outside(candidate) {
        if (candidate === source || candidate.startsWith(source + path.sep) || source.startsWith(candidate + path.sep)) {
            throw new Error('Output must be outside the source files tree.');
        }
    }
    outside(output);
    await fs.mkdir(output, {recursive: true});
    output = await fs.realpath(output);
    outside(output);
    if ((await fs.readdir(output)).length) throw new Error('Output directory must be empty.');
    await fs.cp(source, output, {recursive: true});
    let original = 0, optimized = 0;
    async function optimize(directory) {
        for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) { await optimize(file); continue; }
            const input = await fs.readFile(file);
            let result = input;
            if (entry.name.endsWith('.js')) {
                const js = await minify(input.toString('utf8'), {
                    ecma: 2017,
                    compress: {passes: 2},
                    // SDK component props, Vue methods and RPC names stay public.
                    mangle: {properties: false},
                    format: {comments: false, ascii_only: false}
                });
                result = Buffer.from(js.code + '\n');
            } else if (entry.name.endsWith('.json')) {
                result = Buffer.from(JSON.stringify(JSON.parse(input.toString('utf8'))) + '\n');
            } else if (entry.name.endsWith('.lua') || file === path.join(output, 'usr/lib/oui-httpd/rpc/avahi-daemon')) {
                // Emit portable Lua source, retaining Lua 5.1 compatibility.
                result = Buffer.from(luamin.minify(input.toString('utf8')) + '\n');
            }
            await fs.writeFile(file, result);
            original += input.length; optimized += result.length;
        }
    }
    await optimize(output);
    return {original, optimized};
}

module.exports = {buildAssets};
if (require.main === module) {
    if (process.argv.length !== 3) {
        console.error('Usage: node scripts/build-assets.cjs EMPTY_OUTPUT_DIRECTORY');
        process.exitCode = 1;
    } else buildAssets(process.argv[2]).then(({original, optimized}) => {
        console.log(`Install payload: ${original} -> ${optimized} bytes (${((1 - optimized / original) * 100).toFixed(1)}% smaller)`);
    }).catch(error => {console.error(error.message); process.exitCode = 1;});
}

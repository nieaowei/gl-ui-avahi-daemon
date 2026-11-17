// Check the actual APKv3 metadata, hooks and payload hashes, not just its filename.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const makefile = fs.readFileSync(path.join(root, 'Makefile'), 'utf8');
const setting = key => makefile.match(new RegExp(`^${key}:=(.+)$`, 'm'))[1].trim();
const defaultFile = `${setting('PKG_NAME')}-${setting('PKG_VERSION').replaceAll('~', '-')}-r${setting('PKG_RELEASE')}.apk`;
const artifact = path.resolve(process.argv[2] || path.join(root, 'dist', defaultFile));
const image = process.env.AVAHI_APK_IMAGE || 'alpine:3.23@sha256:ff7f0c727dd796aa36787bfcd9a64bf35a6ce72a73451b3359fde849b6703d63';
const metadata = JSON.parse(execFileSync('docker', ['run', '--rm', '--network', 'none', '--mount', `type=bind,src=${artifact},target=/package.apk,readonly`, image, 'apk', 'adbdump', '--format', 'json', '/package.apk'], {encoding: 'utf8'}));
const payload = fs.mkdtempSync(path.join(os.tmpdir(), 'avahi-apk-check-'));
try {
    execFileSync(process.execPath, [path.join(__dirname, 'build-assets.cjs'), payload], {encoding: 'utf8'});
    assert.equal(metadata.info.name, setting('PKG_NAME'));
    assert.equal(metadata.info.version, setting('PKG_VERSION') + '-r' + setting('PKG_RELEASE'));
    assert.equal(metadata.info.arch, 'noarch');
    assert.equal(metadata.info.license, setting('PKG_LICENSE'));
    const dependencies = makefile.match(/^\s*DEPENDS:=(.+)$/m)[1].replaceAll('+', '').trim().split(/\s+/).sort();
    assert.deepEqual(metadata.info.depends.sort(), dependencies);
    for (const name of ['post-install', 'post-upgrade', 'post-deinstall']) {
        assert.match(metadata.scripts[name], /nginx -t -q && nginx -s reload/);
        assert.ok(!metadata.scripts[name].includes('$$'));
        execFileSync('sh', ['-n'], {input: metadata.scripts[name]});
    }
    const packaged = new Set();
    for (const directory of metadata.paths) {
        assert.equal(directory.acl.user, 'root');
        assert.equal(directory.acl.mode, 0o755);
        for (const file of directory.files || []) {
            const relative = directory.name + '/' + file.name;
            packaged.add(relative);
            assert.equal(file.acl.user, 'root'); assert.equal(file.acl.mode, 0o644);
            const source = fs.readFileSync(path.join(payload, relative));
            assert.equal(file.hash, crypto.createHash('sha256').update(source).digest('hex'), relative);
            assert.equal(file.size, source.length);
        }
    }
    function list(dir, prefix = '') {
        return fs.readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
            const relative = prefix + entry.name;
            return entry.isDirectory() ? list(path.join(dir, entry.name), relative + '/') : [relative];
        });
    }
    assert.deepEqual([...packaged].sort(), list(payload).sort());
    assert.equal(fs.readFileSync(artifact + '.sha256', 'utf8').split(/\s+/)[0], crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex'));
    console.log(`APK verified: ${metadata.info.name} ${metadata.info.version}, noarch, ${packaged.size} files, dependencies, lifecycle hooks and SHA256.`);
} finally { fs.rmSync(payload, {recursive: true, force: true}); }

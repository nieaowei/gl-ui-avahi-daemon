const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(process.env.AVAHI_TEST_ROOT || path.join(__dirname, '../files'));
const view = require(path.join(root, 'www/views/gl-sdk4-ui-avahi-daemon.common.js'));
const schema = require(path.join(root, 'usr/share/avahi-ui/schema.json'));
const menu = require(path.join(root, 'usr/share/oui/menu.d/avahi-daemon.json'));

function context() {
    const ctx = {...view.data(), $store: {getters: {lang: 'zh-cn'}}, $set: (obj, key, value) => { obj[key] = value; }};
    for (const [key, fn] of Object.entries(view.methods)) ctx[key] = fn.bind(ctx);
    for (const [key, get] of Object.entries(view.computed)) Object.defineProperty(ctx, key, {get: () => get.call(ctx)});
    return ctx;
}
function loaded() {
    const ctx = context();
    ctx.schema = schema;
    ctx.settings = Object.fromEntries(schema.map(g => [g.key, Object.fromEntries(g.fields.map(f => [f.key, '']))]));
    ctx.original = JSON.stringify(ctx.settings); ctx.loaded = true; ctx.revision = 'a'.repeat(32);
    ctx.statusLoaded = true; ctx.status = {running: true, enabled: true, umdns: {installed: true, running: true, enabled: true}};
    return ctx;
}
function render(ctx) {
    return view.render.call(ctx, (tag, data, children) => {
        if (Array.isArray(data)) { children = data; data = {}; }
        return {tag, data: data || {}, children: children || []};
    });
}
function nodes(root, predicate) {
    if (!root || typeof root !== 'object') return [];
    return (predicate(root) ? [root] : []).concat((root.children || []).flatMap(n => nodes(n, predicate)));
}
test('menu and native component agree on the SDK route', () => {
    assert.equal(menu.view, view.name); assert.equal(menu.parent, 'applications');
    assert.equal(nodes(render(loaded()), n => n.tag === 'gl-card').length, 1);
});
test('all managed fields render once with stable keys and localized labels', () => {
    const ctx = loaded();
    for (const tab of ['general', 'publish', 'reflector', 'advanced']) {
        ctx.active = tab;
        const fields = nodes(render(ctx), n => n.data.attrs?.['data-avahi-field']);
        assert.equal(fields.length, schema.filter(g => g.tab === tab).flatMap(g => g.fields).length);
        assert.equal(new Set(fields.map(n => n.data.key)).size, fields.length);
        for (const row of fields) {
            const control = nodes(row, n => n.tag === 'el-input' || n.tag === 'el-select')[0];
            assert.ok(control.data.attrs['aria-label']);
            assert.equal(control.data.attrs.value, '');
        }
    }
});
test('default selection remains absent and changing a field creates a draft', () => {
    const ctx = loaded();
    const row = nodes(render(ctx), n => n.data.attrs?.['data-avahi-field'] === 'server.use-ipv4')[0];
    const select = nodes(row, n => n.tag === 'el-select')[0];
    assert.equal(select.children[0].data.attrs.value, '');
    select.data.on.input('no');
    assert.equal(ctx.settings.server['use-ipv4'], 'no'); assert.equal(ctx.dirty, true);
});
test('status polling preserves unsaved settings', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft';
    ctx.rpc = async () => ({running: false, enabled: false});
    await ctx.refreshStatus(); assert.equal(ctx.settings.server['host-name'], 'draft'); assert.ok(ctx.dirty);
});
test('failed status becomes unknown', async () => {
    const ctx = loaded(); ctx.rpc = async () => { throw Error('offline'); };
    await ctx.refreshStatus(); assert.equal(ctx.statusLoaded, false); assert.equal(ctx.error, 'offline');
});
test('save submits revision and apply flag then acknowledges the draft', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft'; const calls = [];
    ctx.rpc = async (method, params) => { calls.push({method, params}); return method === 'set_config' ? {success: true, revision: 'b'.repeat(32)} : {running: true}; };
    assert.equal(await ctx.save(false), true);
    assert.equal(calls[0].params.revision, 'a'.repeat(32)); assert.equal(calls[0].params.apply, false);
    assert.equal(ctx.revision, 'b'.repeat(32)); assert.equal(ctx.dirty, false); assert.equal(ctx.busy, false);
});
test('save conflict keeps draft and original revision', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft'; ctx.rpc = async () => { throw Error('conflict'); };
    assert.equal(await ctx.save(true), false); assert.ok(ctx.dirty); assert.equal(ctx.revision, 'a'.repeat(32)); assert.equal(ctx.error, 'conflict');
});
test('restart failure after save shows partial success', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft';
    ctx.rpc = async method => method === 'set_config' ? {success: true, revision: 'c'.repeat(32), warning: 'restart failed'} : {running: false};
    await ctx.save(true); assert.equal(ctx.dirty, false); assert.equal(ctx.error, 'restart failed'); assert.equal(ctx.notice, ctx.t('saved'));
});
test('apply does not claim a stopped disabled daemon was restarted', async () => {
    const ctx = loaded(); ctx.rpc = async method => method === 'set_config' ? {success: true, revision: ctx.revision, stopped: true} : {running: false};
    await ctx.save(true); assert.equal(ctx.notice, ctx.t('savedStopped'));
});
test('restart asks about drafts and cancellation does not execute', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft'; let calls = 0;
    ctx.ask = async () => false; ctx.rpc = async () => { calls++; };
    assert.equal(await ctx.action('restart'), false); assert.equal(calls, 0); assert.ok(ctx.dirty);
});
test('refresh protects drafts on cancellation', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft'; ctx.ask = async () => false;
    ctx.rpc = async () => { throw Error('should not execute'); };
    await ctx.refresh(); assert.ok(ctx.dirty); assert.equal(ctx.error, '');
});
test('route navigation waits for draft confirmation', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft'; ctx.ask = async () => false;
    let answer; view.beforeRouteLeave.call(ctx, {}, {}, value => { answer = value; });
    await Promise.resolve(); assert.equal(answer, false);
});
test('RPC uses native session and rejects error envelopes', async () => {
    const ctx = context(); let call;
    global.window = {$rpcRequest: async (...args) => { call = args; return {err_code: -1, err_msg: 'denied'}; }};
    await assert.rejects(() => ctx.rpc('get_config'), /denied/);
    assert.deepEqual(call[1], ['sid', 'avahi-daemon', 'get_config', {}]);
    delete global.window;
});
test('English labels and log output render as text', () => {
    const ctx = loaded(); ctx.$store.getters.lang = 'en'; ctx.active = 'logs'; ctx.logText = '<script>alert(1)</script>';
    const log = nodes(render(ctx), n => n.tag === 'pre')[0];
    assert.deepEqual(log.children, [ctx.logText]); assert.equal(ctx.t('general'), 'General');
});
test('busy disables configuration inputs and save actions', () => {
    const ctx = loaded(); ctx.busy = true;
    for (const node of nodes(render(ctx), n => ['el-input', 'el-select', 'gl-button', 'gl-switch'].includes(n.tag))) assert.equal(node.data.attrs.disabled, true);
});
test('unmount clears polling and resolves pending confirmation', async () => {
    const ctx = loaded(); const confirmation = ctx.ask('discard');
    global.window = {removeEventListener() {}};
    view.beforeDestroy.call(ctx); assert.equal(await confirmation, false); assert.equal(ctx.disposed, true);
    delete global.window;
});
test('disable umdns button uses its fixed RPC and preserves the Avahi draft', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft'; const calls = [];
    ctx.rpc = async method => {
        calls.push(method);
        return method === 'disable_umdns' ? {success: true} : {...ctx.status, umdns: {installed: true, running: false, enabled: false}};
    };
    const button = nodes(render(ctx), n => n.tag === 'gl-button' && n.children[0] === '禁用 umdns')[0];
    assert.equal(button.data.attrs.disabled, false);
    await button.data.on.click();
    assert.deepEqual(calls, ['disable_umdns', 'get_status']);
    assert.equal(ctx.settings.server['host-name'], 'draft'); assert.ok(ctx.dirty);
    assert.equal(ctx.notice, ctx.t('umdnsClosed'));
    assert.equal(nodes(render(ctx), n => n.tag === 'gl-button' && n.children[0] === '启用 umdns')[0].data.attrs.disabled, false);
});
test('umdns toggle only blocks unknown or missing service status', () => {
    const ctx = loaded();
    function button() { return nodes(render(ctx), n => n.tag === 'gl-button' && /用 umdns$/.test(n.children[0]))[0]; }
    for (const umdns of [undefined, {installed: false}]) {
        ctx.status.umdns = umdns;
        assert.equal(button().data.attrs.disabled, true);
    }
    ctx.status.umdns = {installed: true, running: false, enabled: false};
    assert.equal(button().children[0], '启用 umdns'); assert.equal(button().data.attrs.disabled, false);
    ctx.status.umdns = {installed: true, running: false, enabled: true};
    assert.equal(button().children[0], '禁用 umdns'); assert.equal(button().data.attrs.disabled, false);
    ctx.statusLoaded = false;
    assert.equal(button().data.attrs.disabled, true);
});
test('umdns partial failure refreshes actual status and shows the error', async () => {
    const ctx = loaded();
    ctx.rpc = async method => {
        if (method === 'disable_umdns') throw Error('Cannot stop umdns');
        return {...ctx.status, umdns: {installed: true, running: true, enabled: false}};
    };
    assert.equal(await ctx.toggleUmdns(), false);
    assert.equal(ctx.error, 'Cannot stop umdns'); assert.equal(ctx.notice, '');
    assert.equal(ctx.status.umdns.enabled, false); assert.equal(ctx.status.umdns.running, true);
});
test('enable umdns starts it through its dedicated RPC and switches the button back', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft';
    ctx.status.umdns = {installed: true, running: false, enabled: false}; const calls = [];
    ctx.rpc = async method => {
        calls.push(method);
        return method === 'enable_umdns' ? {success: true} : {...ctx.status, umdns: {installed: true, running: true, enabled: true}};
    };
    const button = nodes(render(ctx), n => n.tag === 'gl-button' && n.children[0] === '启用 umdns')[0];
    await button.data.on.click();
    assert.deepEqual(calls, ['enable_umdns', 'get_status']); assert.equal(ctx.notice, ctx.t('umdnsOpened'));
    assert.equal(ctx.settings.server['host-name'], 'draft'); assert.ok(ctx.dirty);
    assert.equal(nodes(render(ctx), n => n.tag === 'gl-button' && n.children[0] === '禁用 umdns')[0].data.attrs.disabled, false);
});
test('umdns toggle does not execute without known status', async () => {
    const ctx = loaded(); ctx.statusLoaded = false;
    ctx.rpc = async () => { throw Error('should not execute'); };
    assert.equal(await ctx.toggleUmdns(), false); assert.equal(ctx.error, '');
});
test('tabs support arrow, Home, and End keyboard navigation', () => {
    const ctx = loaded();
    const tabs = ['general', 'publish', 'reflector', 'advanced', 'logs'].map(() => ({focus() { this.focused = true; }}));
    ctx.tabKey({key: 'ArrowRight', preventDefault() {}, currentTarget: {parentNode: {querySelectorAll() { return tabs; }}}}, 0);
    assert.equal(ctx.active, 'publish'); assert.equal(tabs[1].focused, true);
    ctx.tabKey({key: 'End', preventDefault() {}, currentTarget: {parentNode: {querySelectorAll() { return tabs; }}}}, 1);
    assert.equal(ctx.active, 'logs'); assert.equal(tabs[4].focused, true);
    ctx.tabKey({key: 'Home', preventDefault() {}, currentTarget: {parentNode: {querySelectorAll() { return tabs; }}}}, 4);
    assert.equal(ctx.active, 'general'); assert.equal(tabs[0].focused, true);
});
test('interface chips toggle comma-separated device names and one-click reset restores default', async () => {
    const ctx = loaded(); ctx.interfaces = ['br-lan', 'eth1', 'guest'];
    ctx.toggleInterface('server', 'allow-interfaces', 'br-lan');
    ctx.toggleInterface('server', 'allow-interfaces', 'eth1');
    assert.equal(ctx.settings.server['allow-interfaces'], 'br-lan, eth1');
    ctx.toggleInterface('server', 'allow-interfaces', 'br-lan');
    assert.equal(ctx.settings.server['allow-interfaces'], 'eth1');
    const row = nodes(render(ctx), n => n.data.attrs?.['data-avahi-field'] === 'server.allow-interfaces')[0];
    const resetBtn = nodes(row, n => n.tag === 'button' && n.data.class === 'avahi-reset')[0];
    assert.ok(resetBtn);
    resetBtn.data.on.click();
    assert.equal(ctx.settings.server['allow-interfaces'], '');
    assert.equal(ctx.dirty, false);
});
test('discardChanges restores original settings after confirmation', async () => {
    const ctx = loaded(); ctx.settings.server['host-name'] = 'draft';
    ctx.ask = async () => true;
    assert.equal(await ctx.discardChanges(), true);
    assert.equal(ctx.settings.server['host-name'], '');
    assert.equal(ctx.dirty, false);
});
test('log filtering supports errorsOnly and keyword search without mutating raw logText', () => {
    const ctx = loaded(); ctx.active = 'logs';
    ctx.logText = 'info: started\nwarning: conflict detected\nerror: bind failed\n';
    ctx.errorsOnly = true;
    assert.equal(ctx.visibleLogs, 'warning: conflict detected\nerror: bind failed');
    ctx.logSearch = 'bind';
    assert.equal(ctx.visibleLogs, 'error: bind failed');
    const log = nodes(render(ctx), n => n.tag === 'pre')[0];
    assert.deepEqual(log.children, ['error: bind failed']);
    assert.equal(ctx.logText, 'info: started\nwarning: conflict detected\nerror: bind failed\n');
});
test('reflector warns when enabled without allow-interfaces restriction', () => {
    const ctx = loaded(); ctx.active = 'reflector';
    ctx.settings.reflector['enable-reflector'] = 'yes';
    const warn = nodes(render(ctx), n => {
        const cls = Array.isArray(n.data.class) ? n.data.class : String(n.data.class || '').split(/\s+/);
        return cls.includes('avahi-callout') && cls.includes('is-warn');
    });
    assert.equal(warn.length, 1);
    const goBtn = nodes(warn[0], n => n.tag === 'gl-button')[0];
    goBtn.data.on.click();
    assert.equal(ctx.active, 'general');
});

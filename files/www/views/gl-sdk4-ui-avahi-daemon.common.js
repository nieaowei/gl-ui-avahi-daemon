/* Native GL.iNet SDK4 view; uses the router's Vue runtime and authenticated RPC. */
module.exports = (function () {
    'use strict';
    var words = {
        description: ['管理局域网中的 mDNS / DNS-SD 设备发现与服务发布。为了避免冲突，建议禁用 umdns。', 'Manage mDNS / DNS-SD discovery and service publishing on your network. To avoid conflicts, we recommend disabling umdns.'],
        general: ['基本设置', 'General'], publish: ['服务发布', 'Publishing'], reflector: ['mDNS 反射', 'mDNS reflector'], advanced: ['高级设置', 'Advanced'], logs: ['日志', 'Logs'],
        running: ['运行中', 'Running'], stopped: ['未运行', 'Stopped'], unknown: ['状态未知', 'Status unknown'],
        boot: ['开机启动', 'Start at boot'],
        start: ['启动服务', 'Start'], stop: ['停止服务', 'Stop'], restart: ['重启服务', 'Restart'],
        disableUmdns: ['禁用 umdns', 'Disable umdns'], umdnsClosed: ['已关闭 umdns 并禁用开机启动。', 'umdns stopped and disabled at boot.'],
        enableUmdns: ['启用 umdns', 'Enable umdns'], umdnsOpened: ['已启动 umdns 并启用开机启动。', 'umdns started and enabled at boot.'],
        umdnsMissing: ['未安装 umdns', 'umdns is not installed'],
        refresh: ['刷新', 'Refresh'], save: ['保存', 'Save'], apply: ['保存并应用', 'Save and apply'],
        loading: ['正在加载…', 'Loading…'], error: ['操作失败', 'Operation failed'],
        saved: ['配置已保存，尚未重启服务。', 'Configuration saved. The service has not been restarted.'],
        applied: ['配置已保存并请求重启，请查看运行状态和日志。', 'Configuration saved and restart requested. Check service status and logs.'],
        savedStopped: ['配置已保存。服务已停用，下次启动时生效。', 'Configuration saved. The disabled service will use it on its next start.'],
        requested: ['服务操作已完成，请查看运行状态。', 'Service action completed. Check the service status.'],
        unsaved: ['有未保存的修改', 'Unsaved changes'], synced: ['配置已同步', 'Configuration synchronized'],
        default: ['默认', 'Default'], yes: ['是', 'Yes'], no: ['否', 'No'], system: ['系统默认', 'System default'],
        defaultHint: ['选择“默认”或清空文本会移除该项配置，由 Avahi 使用默认值。', 'Choose Default or clear a text field to remove the override and use Avahi defaults.'],
        interfacesHint: ['填写实际设备接口名，如 br-lan、eth1，以英文逗号分隔。允许列表为空时使用所有适用接口；排除列表优先。', 'Use device names such as br-lan or eth1, separated by commas. An empty allow list uses all eligible interfaces; the deny list takes precedence.'],
        knownInterfaces: ['当前接口：', 'Current interfaces: '],
        reflectHint: ['反射会让参与接口所在网络相互发现服务。请限制允许的接口，避免包含 WAN；防火墙仍需允许相应 mDNS 流量。相同网络间只运行一个反射器。', 'Reflection allows connected networks to discover each other’s services. Limit allowed interfaces and avoid WAN. The firewall must permit the relevant mDNS traffic. Run only one reflector between the same networks.'],
        reflectIpvHint: ['跨 IPv4/IPv6 反射通常保持关闭。此功能需要同时启用 IPv4、IPv6 和 mDNS 反射。', 'Usually leave cross-family reflection disabled. It requires IPv4, IPv6 and the mDNS reflector.'],
        publishHint: ['此页管理发布策略。现有 /etc/avahi/services/*.service 文件继续由 Avahi 加载。', 'This page controls publishing policy. Avahi continues to load existing /etc/avahi/services/*.service files.'],
        advancedHint: ['资源限制为空时沿用系统限制；过低的限制可能导致服务无法启动。', 'Empty resource limits inherit system limits. Low limits may prevent the service from starting.'],
        logHint: ['显示系统日志中最近 200 条包含 avahi 的记录（最多 64 KiB）。', 'Shows the last 200 system log entries matching avahi (up to 64 KiB).'],
        auto: ['自动刷新', 'Auto refresh'], empty: ['暂无日志', 'No log entries'],
        discard: ['有未保存的修改，是否丢弃？', 'Discard unsaved changes?'],
        restartConfirm: ['当前设置尚未保存。仍使用已保存的配置启动或重启服务？', 'Settings have unsaved changes. Start or restart using the saved configuration?'],
        confirm: ['确定', 'Confirm'], cancel: ['取消', 'Cancel'], confirmTitle: ['确认操作', 'Confirm action']
    };
    var css = [
        '.avahi-native{min-width:0}.avahi-native .avahi-muted{color:var(--text-subtitle);line-height:1.7}',
        '.avahi-native .avahi-status,.avahi-native .avahi-actions,.avahi-native .avahi-footer{display:flex;align-items:center;gap:12px;flex-wrap:wrap}',
        '.avahi-native .avahi-status,.avahi-native .avahi-footer{justify-content:space-between}.avahi-native .avahi-status{margin:20px 0}',
        '.avahi-native .avahi-status strong{font-size:16px}.avahi-native .avahi-version{font-size:12px;margin-top:6px;color:var(--text-subtitle)}',
        '.avahi-native .avahi-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:var(--text-disabled)}',
        '.avahi-native .avahi-dot.on{background:var(--success,#20a87b)}',
        '.avahi-native .avahi-tabs{display:flex;gap:24px;overflow-x:auto;border-bottom:1px solid var(--border);margin:20px 0}',
        '.avahi-native .avahi-tab{background:transparent;border:0;border-bottom:2px solid transparent;padding:12px 0;color:var(--text-subtitle);white-space:nowrap;font:inherit;cursor:pointer}',
        '.avahi-native .avahi-tab.active{border-color:var(--primary);color:var(--primary)}',
        '.avahi-native .avahi-row{display:grid;grid-template-columns:minmax(190px,38%) minmax(0,1fr);align-items:center;gap:16px;margin:18px 0}',
        '.avahi-native .avahi-control{width:100%;max-width:460px}.avahi-native .el-select{width:100%}',
        '.avahi-native .avahi-key{display:block;font-size:11px;color:var(--text-subtitle);margin-top:3px;overflow-wrap:anywhere}',
        '.avahi-native .avahi-group{margin-bottom:24px}.avahi-native h3{font-size:15px;font-weight:600}',
        '.avahi-native .avahi-footer{border-top:1px solid var(--border);padding-top:20px;margin-top:24px}',
        '.avahi-native .avahi-error{color:var(--error,#d95050);white-space:pre-wrap;overflow-wrap:anywhere}',
        '.avahi-native .avahi-notice{color:var(--success,#20a87b);white-space:pre-wrap;overflow-wrap:anywhere}',
        '.avahi-native .avahi-log{background:var(--bg-body);border:1px solid var(--border);padding:14px;border-radius:6px;max-height:440px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 monospace}',
        '.avahi-native .gl-btn,.avahi-confirm .gl-btn{height:36px;min-height:36px;margin:0;padding:0 18px;line-height:20px;white-space:nowrap}',
        '.avahi-native .avahi-tab:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}',
        '@media(max-width:600px){.avahi-native .avahi-row{grid-template-columns:1fr;gap:8px}.avahi-native .avahi-control{max-width:none}.avahi-native .avahi-tabs{gap:20px}}'
    ].join('\n');
    return {
        name: 'avahi-daemon',
        data: function () { return {
            schema: [], settings: {}, original: '', revision: '', interfaces: [], loaded: false,
            status: {}, statusLoaded: false, statusPending: false, busy: false, error: '', notice: '',
            active: 'general', logText: '', logAuto: true, logPending: false, timer: null, disposed: false,
            unloadHandler: null, confirmVisible: false, confirmMessage: '', confirmResolve: null
        }; },
        computed: {dirty: function () { return this.loaded && JSON.stringify(this.settings) !== this.original; }},
        created: function () { this.fetchConfig(); this.refreshStatus(); },
        mounted: function () {
            var self = this;
            this.unloadHandler = function (event) { if (self.dirty) { event.preventDefault(); event.returnValue = ''; } };
            window.addEventListener('beforeunload', this.unloadHandler);
            this.timer = setInterval(function () {
                if (document.hidden || self.busy) return;
                self.refreshStatus();
                if (self.active === 'logs' && self.logAuto) self.loadLogs();
            }, 5000);
        },
        beforeDestroy: function () {
            this.disposed = true; clearInterval(this.timer);
            window.removeEventListener('beforeunload', this.unloadHandler);
            this.confirmAnswer(false);
        },
        beforeRouteLeave: function (to, from, next) {
            if (!this.dirty) next(true); else this.ask(this.t('discard')).then(next);
        },
        methods: {
            language: function () { return /^zh/.test((this.$store && this.$store.getters.lang) || (this.$i18n && this.$i18n.locale) || 'en') ? 0 : 1; },
            t: function (key) { return words[key] ? words[key][this.language()] : key; },
            label: function (pair) { return pair[this.language()]; },
            rpc: async function (method, args) {
                var result = await window.$rpcRequest('call', ['sid', 'avahi-daemon', method, args || {}], {timeout: 65000, isCancel: false});
                if (!result || result.err_code) throw new Error(result && result.err_msg || this.t('error'));
                return result;
            },
            run: async function (fn) {
                if (this.busy || this.disposed) return false;
                this.busy = true; this.error = ''; this.notice = '';
                try { await fn(); return true; }
                catch (e) { this.error = e && (e.message || e.err_msg) || this.t('error'); return false; }
                finally { this.busy = false; }
            },
            loadConfig: async function () {
                var data = await this.rpc('get_config');
                if (this.disposed) return;
                this.schema = data.schema; this.settings = data.settings; this.revision = data.revision;
                this.interfaces = Array.isArray(data.interfaces) ? data.interfaces : [];
                this.original = JSON.stringify(this.settings); this.loaded = true;
            },
            fetchConfig: function () { var self = this; return this.run(function () { return self.loadConfig(); }); },
            refreshStatus: async function () {
                if (this.statusPending || this.disposed) return;
                this.statusPending = true;
                try { var data = await this.rpc('get_status'); if (!this.disposed) { this.status = data; this.statusLoaded = true; } }
                catch (e) { this.statusLoaded = false; this.error = e && e.message || this.t('error'); }
                finally { this.statusPending = false; }
            },
            refresh: async function () {
                if (this.dirty && !await this.ask(this.t('discard'))) return;
                await this.fetchConfig(); await this.refreshStatus();
            },
            save: function (apply) {
                var self = this;
                return this.run(async function () {
                    var result = await self.rpc('set_config', {settings: self.settings, revision: self.revision, apply: apply});
                    // Use the acknowledged values immediately; a failed follow-up read
                    // must not make a successful save look like an unsaved draft.
                    self.original = JSON.stringify(self.settings); self.revision = result.revision;
                    self.notice = self.t(apply ? result.stopped ? 'savedStopped' : 'applied' : 'saved');
                    if (result.warning) { self.notice = self.t('saved'); self.error = result.warning; }
                    await self.refreshStatus();
                });
            },
            action: async function (action) {
                if (this.busy) return false;
                if ((action === 'restart' || action === 'start') && this.dirty && !await this.ask(this.t('restartConfirm'))) return false;
                var self = this;
                return this.run(async function () {
                    await self.rpc('service', {action: action}); self.notice = self.t('requested'); await self.refreshStatus();
                });
            },
            toggleUmdns: function () {
                var umdns = this.status.umdns;
                if (!this.statusLoaded || this.statusPending || !umdns || !umdns.installed) return Promise.resolve(false);
                var enable = !umdns.running && !umdns.enabled;
                var self = this;
                return this.run(async function () {
                    try {
                        var result = await self.rpc(enable ? 'enable_umdns' : 'disable_umdns');
                        self.notice = self.t(result.missing ? 'umdnsMissing' : enable ? 'umdnsOpened' : 'umdnsClosed');
                    } finally { await self.refreshStatus(); }
                });
            },
            loadLogs: async function () {
                if (this.logPending || this.disposed) return;
                this.logPending = true;
                try { var data = await this.rpc('get_logs'); if (!this.disposed) this.logText = data.text; }
                catch (e) { this.error = e && e.message || this.t('error'); }
                finally { this.logPending = false; }
            },
            tab: function (key) { this.active = key; if (key === 'logs') this.loadLogs(); },
            ask: function (message) {
                var self = this; if (this.confirmResolve) this.confirmResolve(false);
                this.confirmMessage = message; this.confirmVisible = true;
                return new Promise(function (resolve) { self.confirmResolve = resolve; });
            },
            confirmAnswer: function (answer) {
                var resolve = this.confirmResolve; this.confirmResolve = null; this.confirmVisible = false;
                if (resolve) resolve(answer);
            }
        },
        render: function (h) {
            var self = this;
            var umdns = this.status.umdns;
            function t(key) { return self.t(key); }
            function button(key, click, primary, disabled) {
                return h('gl-button', {attrs: {type: primary ? 'primary' : 'default', disabled: self.busy || !!disabled}, on: {click: click}}, [t(key)]);
            }
            function fieldControl(group, field) {
                var value = self.settings[group.key][field.key], label = self.label(field.label), control;
                function change(next) { self.$set(self.settings[group.key], field.key, next); self.notice = ''; }
                var placeholder = t('default') + ': ' + (field.default ? field.kind === 'bool' ? t(field.default) : field.default : t('system'));
                if (field.kind === 'bool' || field.kind === 'enum') {
                    var options = [{value: '', label: placeholder}].concat((field.values || ['yes', 'no']).map(function (v) { return {value: v, label: t(v)}; }));
                    control = h('el-select', {attrs: {value: value, disabled: self.busy, 'aria-label': label, 'popper-class': 'main-select'}, on: {input: change}}, options.map(function (o) {
                        return h('el-option', {key: o.value, attrs: {value: o.value, label: o.label}});
                    }));
                } else control = h('el-input', {attrs: {value: value, disabled: self.busy, placeholder: placeholder, 'aria-label': label, maxlength: 253 - field.key.length, inputmode: field.kind === 'uint' ? 'numeric' : 'text'}, on: {input: change}});
                return h('div', {key: group.key + '.' + field.key, class: 'avahi-row', attrs: {'data-avahi-field': group.key + '.' + field.key}}, [
                    h('div', [label, h('span', {class: 'avahi-key'}, [field.key])]), h('div', {class: 'avahi-control'}, [control])
                ]);
            }
            var body = [];
            if (!this.loaded) body.push(h('p', [t('loading')]));
            else if (this.active === 'logs') {
                body.push(h('p', {class: 'avahi-muted'}, [t('logHint')]));
                body.push(h('div', {class: 'avahi-actions'}, [button('refresh', this.loadLogs, false, this.logPending), t('auto'), h('gl-switch', {attrs: {value: this.logAuto, size: 'small', 'aria-label': t('auto')}, on: {input: function (v) { self.logAuto = v; }}})]));
                body.push(h('pre', {class: 'avahi-log', attrs: {role: 'log', 'aria-label': t('logs')}}, [this.logText || t('empty')]));
            } else {
                body.push(h('p', {class: 'avahi-muted'}, [t('defaultHint')]));
                if (this.active === 'general') {
                    body.push(h('p', {class: 'avahi-muted'}, [t('interfacesHint')]));
                    body.push(h('p', {class: 'avahi-muted'}, [t('knownInterfaces') + this.interfaces.join(', ')]));
                }
                if (this.active === 'publish') body.push(h('p', {class: 'avahi-muted'}, [t('publishHint')]));
                if (this.active === 'reflector') body.push(h('p', {class: 'avahi-muted'}, [t('reflectHint')]), h('p', {class: 'avahi-muted'}, [t('reflectIpvHint')]));
                if (this.active === 'advanced') body.push(h('p', {class: 'avahi-muted'}, [t('advancedHint')]));
                this.schema.filter(function (g) { return g.tab === self.active; }).forEach(function (g) {
                    body.push(h('section', {class: 'avahi-group', key: g.key}, [h('h3', [self.label(g.label)])].concat(g.fields.map(function (f) { return fieldControl(g, f); }))));
                });
            }
            return h('div', {class: 'avahi-native'}, [
                h('style', [css]), h('gl-title', {attrs: {title: 'Avahi'}}),
                h('el-dialog', {class: 'avahi-confirm', attrs: {visible: this.confirmVisible, title: t('confirmTitle'), 'append-to-body': true, 'close-on-click-modal': false}, on: {close: function () { self.confirmAnswer(false); }}}, [
                    h('p', [this.confirmMessage]), h('div', {slot: 'footer'}, [button('cancel', function () { self.confirmAnswer(false); }), button('confirm', function () { self.confirmAnswer(true); }, true)])
                ]),
                h('gl-card', [h('p', {class: 'avahi-muted'}, [t('description')]),
                    h('div', {class: 'avahi-status'}, [
                        h('div', [h('strong', {attrs: {role: 'status', 'aria-live': 'polite'}}, [h('i', {class: ['avahi-dot', this.statusLoaded && this.status.running ? 'on' : '']}), t(!this.statusLoaded ? 'unknown' : this.status.running ? 'running' : 'stopped')]), h('div', {class: 'avahi-version'}, ['Avahi ' + (this.status.version || '—') + ' · UI ' + (this.status.ui_version || '—')])]),
                        h('div', {class: 'avahi-actions'}, [
                            t('boot'), h('gl-switch', {attrs: {value: !!this.status.enabled, size: 'small', disabled: this.busy || this.statusPending || !this.statusLoaded, 'aria-label': t('boot')}, on: {input: function (v) { self.action(v ? 'enable' : 'disable'); }}}),
                            button('start', function () { self.action('start'); }, false, !this.statusLoaded || this.status.running),
                            button('stop', function () { self.action('stop'); }, false, !this.statusLoaded || !this.status.running),
                            button('restart', function () { self.action('restart'); }, false, !this.statusLoaded || !this.status.running),
                            button(umdns && !umdns.running && !umdns.enabled ? 'enableUmdns' : 'disableUmdns', this.toggleUmdns, false, !this.statusLoaded || this.statusPending || !umdns || !umdns.installed)
                        ])
                    ]),
                    h('div', {class: 'avahi-tabs', attrs: {role: 'tablist', 'aria-label': 'Avahi'}}, ['general', 'publish', 'reflector', 'advanced', 'logs'].map(function (key) {
                        return h('button', {class: ['avahi-tab', self.active === key ? 'active' : ''], attrs: {type: 'button', role: 'tab', id: 'avahi-tab-' + key, 'aria-selected': String(self.active === key), 'aria-controls': 'avahi-panel'}, on: {click: function () { self.tab(key); }}}, [t(key)]);
                    })),
                    this.error ? h('p', {class: 'avahi-error', attrs: {role: 'alert'}}, [this.error]) : null,
                    this.notice ? h('p', {class: 'avahi-notice', attrs: {role: 'status'}}, [this.notice]) : null,
                    h('div', {attrs: {id: 'avahi-panel', role: 'tabpanel', 'aria-labelledby': 'avahi-tab-' + this.active}}, body),
                    h('div', {class: 'avahi-footer'}, [h('span', {class: 'avahi-muted'}, [t(this.dirty ? 'unsaved' : 'synced')]), h('div', {class: 'avahi-actions'}, [
                        button('refresh', this.refresh), button('save', function () { self.save(false); }, false, !this.loaded || !this.dirty), button('apply', function () { self.save(true); }, true, !this.loaded || !this.statusLoaded)
                    ])])
                ])
            ]);
        }
    };
})();

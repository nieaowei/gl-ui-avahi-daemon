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
        confirm: ['确定', 'Confirm'], cancel: ['取消', 'Cancel'], confirmTitle: ['确认操作', 'Confirm action'],
        dismiss: ['关闭提示', 'Dismiss'], discardChanges: ['撤销修改', 'Discard changes'],
        umdnsActive: ['umdns 运行中（建议禁用）', 'umdns active (recommended to disable)'],
        umdnsDisabled: ['umdns 已禁用', 'umdns disabled'],
        resetField: ['恢复默认', 'Reset to default'], configuredCount: ['项已设置', 'configured'],
        reflectWarn: ['已启用 mDNS 反射且未限制允许接口，可能会将服务反射到 WAN。建议在“基本设置”中设置允许的接口。', 'mDNS reflector is enabled without an interface allow-list, which may reflect across WAN. Consider restricting allowed interfaces in General.'],
        goGeneral: ['前往基本设置', 'Go to General'],
        logSearch: ['搜索日志关键词', 'Filter log lines'], errorsOnly: ['仅错误/警告', 'Errors & warnings'],
        exportLogs: ['导出日志', 'Export logs'], scrollBottom: ['滚动到底部', 'Scroll to bottom'],
        filterEmpty: ['没有匹配的日志记录', 'No matching log entries'],
        clickInterfaces: ['点击接口快速切换：', 'Click an interface to toggle:']
    };
    var css = [
        '.avahi-native{min-width:0;line-height:1.5}.avahi-native .avahi-muted{color:var(--text-subtitle);line-height:1.65;margin:0}',
        '.avahi-native .avahi-status,.avahi-native .avahi-actions,.avahi-native .avahi-footer{display:flex;align-items:center;gap:10px 12px;flex-wrap:wrap}',
        '.avahi-native .avahi-status,.avahi-native .avahi-footer,.avahi-native .avahi-between{justify-content:space-between}',
        '.avahi-native .avahi-status{margin:16px 0 20px;padding:16px 18px;border:1px solid var(--border);border-radius:8px;background:var(--background-subtitle,var(--bg-body,#f7f8fa))}',
        '.avahi-native .avahi-status strong{font-size:16px;font-weight:600;display:inline-flex;align-items:center}',
        '.avahi-native .avahi-status-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:6px}',
        '.avahi-native .avahi-version{font-size:12px;color:var(--text-subtitle)}',
        '.avahi-native .avahi-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:8px;background:var(--text-disabled,#9ca3af);flex-shrink:0}',
        '.avahi-native .avahi-dot.on{background:var(--success,#20a87b);box-shadow:0 0 0 3px rgba(32,168,123,.2)}',
        '.avahi-native .avahi-boot,.avahi-native .avahi-inline{display:inline-flex;align-items:center;gap:8px;white-space:nowrap}',
        '.avahi-native .avahi-badge{display:inline-flex;align-items:center;font-size:11px;line-height:1.4;padding:2px 8px;border-radius:10px;border:1px solid var(--border);color:var(--text-subtitle);background:var(--background-card,var(--bg-content,#fff));white-space:nowrap}',
        '.avahi-native .avahi-badge.is-warn{border-color:rgba(217,119,6,.4);color:var(--warning,#c28b2e);background:rgba(217,119,6,.1)}',
        '.avahi-native .avahi-badge.is-ok{border-color:rgba(32,168,123,.4);color:var(--success,#20a87b);background:rgba(32,168,123,.1)}',
        '.avahi-native .avahi-tabs{display:flex;gap:22px;overflow-x:auto;border-bottom:1px solid var(--border);margin:0 0 18px}',
        '.avahi-native .avahi-tab{display:inline-flex;align-items:center;gap:6px;background:transparent;border:0;border-bottom:2px solid transparent;padding:11px 2px;color:var(--text-subtitle);white-space:nowrap;font:inherit;cursor:pointer;transition:color .15s,border-color .15s}',
        '.avahi-native .avahi-tab:hover{color:var(--primary)}',
        '.avahi-native .avahi-tab.active{border-color:var(--primary);color:var(--primary);font-weight:600}',
        '.avahi-native .avahi-tab-count{font-size:11px;line-height:1.4;padding:1px 6px;border-radius:10px;border:1px solid var(--border);background:var(--background-subtitle,var(--bg-body,#f7f8fa));color:var(--text-subtitle);font-weight:400}',
        '.avahi-native .avahi-tab.active .avahi-tab-count{border-color:var(--primary);color:var(--primary)}',
        '.avahi-native .avahi-tab-dot{width:6px;height:6px;border-radius:50%;background:var(--primary);flex-shrink:0}',
        '.avahi-native .avahi-callout{margin:0 0 16px;padding:12px 14px;border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:6px;background:var(--background-subtitle,var(--bg-body,#f7f8fa));font-size:12px;line-height:1.65;color:var(--text-subtitle)}',
        '.avahi-native .avahi-callout p{margin:0 0 4px}.avahi-native .avahi-callout p:last-child{margin-bottom:0}',
        '.avahi-native .avahi-callout.is-warn{border-left-color:var(--warning,#c28b2e);background:rgba(217,119,6,.08);color:var(--text-regular);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}',
        '.avahi-native .avahi-group{margin:0 0 16px;border:1px solid var(--border);border-radius:8px;overflow:hidden}',
        '.avahi-native .avahi-group-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 18px;border-bottom:1px solid var(--border);background:var(--background-subtitle,var(--bg-body,#f7f8fa))}',
        '.avahi-native h3{font-size:15px;font-weight:600;margin:0}',
        '.avahi-native .avahi-group-body{padding:0 18px}',
        '.avahi-native .avahi-row{display:grid;grid-template-columns:minmax(200px,40%) minmax(0,1fr);align-items:start;gap:16px;padding:14px 0;border-bottom:1px solid var(--border)}',
        '.avahi-native .avahi-row:last-child{border-bottom:0}',
        '.avahi-native .avahi-row-label{min-width:0;overflow-wrap:anywhere}',
        '.avahi-native .avahi-label-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
        '.avahi-native .avahi-row.is-modified .avahi-label-top>span:first-child{color:var(--primary);font-weight:500}',
        '.avahi-native .avahi-reset{border:0;background:transparent;padding:0;color:var(--primary);font:inherit;font-size:11px;cursor:pointer;text-decoration:underline;text-underline-offset:2px}',
        '.avahi-native .avahi-reset:disabled{opacity:.45;cursor:default}',
        '.avahi-native .avahi-control{width:100%;max-width:460px}.avahi-native .el-select{width:100%}',
        '.avahi-native .avahi-key{display:block;font-size:11px;color:var(--text-subtitle);margin-top:3px;overflow-wrap:anywhere}',
        '.avahi-native .avahi-chips{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px}',
        '.avahi-native .avahi-chips-hint{font-size:11px;color:var(--text-subtitle)}',
        '.avahi-native .avahi-chip{border:1px solid var(--border);border-radius:14px;background:var(--background-subtitle,var(--bg-body,#f7f8fa));color:var(--text-regular);padding:2px 10px;font:inherit;font-size:12px;line-height:1.6;cursor:pointer;transition:border-color .15s,background .15s,color .15s}',
        '.avahi-native .avahi-chip:hover:not(:disabled){border-color:var(--primary)}',
        '.avahi-native .avahi-chip.is-selected{border-color:var(--primary);background:var(--primary-background,rgba(10,155,140,.12));color:var(--primary);font-weight:500}',
        '.avahi-native .avahi-chip:disabled{opacity:.45;cursor:default}',
        '.avahi-native .avahi-footer{position:sticky;bottom:0;z-index:5;box-sizing:border-box;min-width:0;margin-top:24px;padding:14px 18px;border:1px solid var(--border);border-radius:8px;background:var(--background-card,var(--bg-content,var(--bg-body,#fff)));box-shadow:0 -4px 16px rgba(0,0,0,.07)}',
        '.avahi-native .avahi-footer-status{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--text-subtitle)}',
        '.avahi-native .avahi-footer-status.is-dirty{color:var(--primary);font-weight:500}',
        '.avahi-native .avahi-dirty-dot{width:7px;height:7px;border-radius:50%;background:var(--primary);flex-shrink:0}',
        '.avahi-native .avahi-alert{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin:0 0 14px;padding:10px 14px;border:1px solid var(--border);border-radius:6px;line-height:1.6;overflow-wrap:anywhere}',
        '.avahi-native .avahi-alert.is-error{color:var(--error,#d95050);border-color:rgba(217,80,80,.35);background:rgba(217,80,80,.08)}',
        '.avahi-native .avahi-alert.is-notice{color:var(--success,#20a87b);border-color:rgba(32,168,123,.35);background:rgba(32,168,123,.08)}',
        '.avahi-native .avahi-alert-text{flex:1;min-width:0;white-space:pre-wrap}',
        '.avahi-native .avahi-alert-close{border:0;background:transparent;color:inherit;font:inherit;font-size:18px;line-height:1;padding:2px 4px;cursor:pointer;opacity:.75;border-radius:4px}',
        '.avahi-native .avahi-alert-close:hover{opacity:1}',
        '.avahi-native .avahi-log-bar{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin:12px 0}',
        '.avahi-native .avahi-log-search{flex:1;min-width:200px;max-width:340px}',
        '.avahi-native .avahi-log{background:var(--background-subtitle,var(--bg-body,#f7f8fa));border:1px solid var(--border);padding:14px;border-radius:6px;max-height:440px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.7 ui-monospace,SFMono-Regular,Consolas,monospace;margin:8px 0 0}',
        '.avahi-native .gl-btn,.avahi-confirm .gl-btn{height:36px;min-height:36px;margin:0;padding:0 18px;line-height:20px;white-space:nowrap}',
        '.avahi-native .avahi-tab:focus-visible,.avahi-native .avahi-chip:focus-visible,.avahi-native .avahi-reset:focus-visible,.avahi-native .avahi-alert-close:focus-visible{outline:2px solid var(--primary);outline-offset:-2px}',
        '.avahi-confirm{width:440px!important;max-width:calc(100vw - 32px)}',
        '.avahi-confirm .avahi-dialog-footer{display:flex;justify-content:flex-end;gap:10px}',
        '@media(max-width:600px){.avahi-native .avahi-status{padding:14px}.avahi-native .avahi-group-head{padding:10px 14px}.avahi-native .avahi-group-body{padding:0 14px}.avahi-native .avahi-row{grid-template-columns:1fr;gap:8px}.avahi-native .avahi-control{max-width:none}.avahi-native .avahi-log-search{max-width:none;width:100%}.avahi-native .avahi-tabs{gap:18px}.avahi-native .avahi-footer{align-items:flex-start;padding:12px 14px}.avahi-native .avahi-footer>.avahi-actions{width:100%;justify-content:flex-end}}',
        '@media(prefers-reduced-motion:reduce){.avahi-native *{transition:none!important}}'
    ].join('\n');
    return {
        name: 'avahi-daemon',
        data: function () { return {
            schema: [], settings: {}, original: '', revision: '', interfaces: [], loaded: false,
            status: {}, statusLoaded: false, statusPending: false, busy: false, error: '', notice: '',
            active: 'general', logText: '', logAuto: true, logSearch: '', errorsOnly: false, logPending: false, timer: null, disposed: false,
            unloadHandler: null, confirmVisible: false, confirmMessage: '', confirmResolve: null
        }; },
        computed: {
            dirty: function () { return this.loaded && JSON.stringify(this.settings) !== this.original; },
            visibleLogs: function () {
                var text = this.logText || '';
                if (!text) return '';
                var query = this.logSearch.trim().toLowerCase();
                if (!this.errorsOnly && !query) return text;
                return text.split('\n').filter(function (line) {
                    if (this.errorsOnly && !/error|warn|fail|denied|conflict/i.test(line)) return false;
                    if (query && line.toLowerCase().indexOf(query) === -1) return false;
                    return true;
                }, this).join('\n');
            }
        },
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
            tabKey: function (event, index) {
                var keys = ['general', 'publish', 'reflector', 'advanced', 'logs'], len = keys.length, next;
                if (event.key === 'ArrowRight') next = (index + 1) % len;
                else if (event.key === 'ArrowLeft') next = (index + len - 1) % len;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = len - 1;
                else return;
                if (event.preventDefault) event.preventDefault();
                this.tab(keys[next]);
                var tabs = event.currentTarget && event.currentTarget.parentNode && event.currentTarget.parentNode.querySelectorAll('[role="tab"]');
                if (tabs && tabs[next] && tabs[next].focus) tabs[next].focus();
            },
            tabModifiedCount: function (tabKey) {
                if (!this.loaded) return 0;
                var self = this, count = 0;
                (this.schema || []).filter(function (g) { return g.tab === tabKey; }).forEach(function (g) {
                    var group = self.settings[g.key] || {};
                    g.fields.forEach(function (f) { var v = group[f.key]; if (v !== undefined && v !== null && v !== '') count++; });
                });
                return count;
            },
            tabDirty: function (tabKey) {
                if (!this.loaded || !this.dirty) return false;
                try {
                    var orig = JSON.parse(this.original), self = this;
                    return (this.schema || []).some(function (g) {
                        return g.tab === tabKey && JSON.stringify(self.settings[g.key] || {}) !== JSON.stringify(orig[g.key] || {});
                    });
                } catch (e) { return false; }
            },
            selectedInterfaces: function (value) {
                return String(value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
            },
            toggleInterface: function (groupKey, fieldKey, iface) {
                var list = this.selectedInterfaces((this.settings[groupKey] || {})[fieldKey]);
                var idx = list.indexOf(iface);
                if (idx === -1) list.push(iface); else list.splice(idx, 1);
                this.$set(this.settings[groupKey], fieldKey, list.join(', '));
                this.notice = '';
            },
            discardChanges: async function () {
                if (this.busy || !this.dirty || !await this.ask(this.t('discard'))) return false;
                this.settings = JSON.parse(this.original);
                this.error = ''; this.notice = '';
                return true;
            },
            exportLogs: function () {
                if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return;
                var url = URL.createObjectURL(new Blob([this.visibleLogs], {type: 'text/plain;charset=utf-8'}));
                var a = document.createElement('a'); a.href = url; a.download = 'avahi-daemon.log'; a.click();
                setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
            },
            scrollLogs: function () { var el = this.$refs && this.$refs.logOutput; if (el) el.scrollTop = el.scrollHeight; },
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
            function alertBanner(kind, text, dismiss) {
                return h('div', {class: ['avahi-alert', kind === 'error' ? 'is-error' : 'is-notice'], attrs: {role: kind === 'error' ? 'alert' : 'status'}}, [
                    h('span', {class: 'avahi-alert-text'}, [text]),
                    h('button', {class: 'avahi-alert-close', attrs: {type: 'button', 'aria-label': t('dismiss')}, on: {click: dismiss}}, ['×'])
                ]);
            }
            function fieldControl(group, field) {
                var value = self.settings[group.key][field.key], label = self.label(field.label), control;
                var isModified = value !== undefined && value !== null && value !== '';
                function change(next) { self.$set(self.settings[group.key], field.key, next); self.notice = ''; }
                var placeholder = t('default') + ': ' + (field.default ? field.kind === 'bool' ? t(field.default) : field.default : t('system'));
                if (field.kind === 'bool' || field.kind === 'enum') {
                    var options = [{value: '', label: placeholder}].concat((field.values || ['yes', 'no']).map(function (v) { return {value: v, label: t(v)}; }));
                    control = h('el-select', {attrs: {value: value, disabled: self.busy, 'aria-label': label, 'popper-class': 'main-select'}, on: {input: change}}, options.map(function (o) {
                        return h('el-option', {key: o.value, attrs: {value: o.value, label: o.label}});
                    }));
                } else control = h('el-input', {attrs: {value: value, disabled: self.busy, placeholder: placeholder, 'aria-label': label, maxlength: 253 - field.key.length, inputmode: field.kind === 'uint' ? 'numeric' : 'text'}, on: {input: change}});
                var chips = null;
                if (field.kind === 'interfaces' && self.interfaces.length) {
                    var selected = self.selectedInterfaces(value);
                    chips = h('div', {class: 'avahi-chips'}, [h('span', {class: 'avahi-chips-hint'}, [t('clickInterfaces')])].concat(self.interfaces.map(function (iface) {
                        var active = selected.indexOf(iface) !== -1;
                        return h('button', {key: iface, class: ['avahi-chip', active ? 'is-selected' : ''], attrs: {type: 'button', disabled: self.busy, 'aria-pressed': String(active)}, on: {click: function () { self.toggleInterface(group.key, field.key, iface); }}}, [iface]);
                    })));
                }
                return h('div', {key: group.key + '.' + field.key, class: ['avahi-row', isModified ? 'is-modified' : ''], attrs: {'data-avahi-field': group.key + '.' + field.key}}, [
                    h('div', {class: 'avahi-row-label'}, [
                        h('div', {class: 'avahi-label-top'}, [
                            h('span', [label]),
                            isModified ? h('button', {class: 'avahi-reset', attrs: {type: 'button', disabled: self.busy, 'aria-label': label + ' - ' + t('resetField')}, on: {click: function () { change(''); }}}, [t('resetField')]) : null
                        ]),
                        h('span', {class: 'avahi-key'}, [field.key])
                    ]),
                    h('div', {class: 'avahi-control'}, [control, chips])
                ]);
            }
            var body = [];
            if (!this.loaded) body.push(h('p', [t('loading')]));
            else if (this.active === 'logs') {
                body.push(h('div', {class: 'avahi-callout'}, [h('p', [t('logHint')])]));
                body.push(h('div', {class: 'avahi-log-bar'}, [
                    h('div', {class: 'avahi-actions', style: {flex: '1', minWidth: '0'}}, [
                        h('div', {class: 'avahi-log-search'}, [h('el-input', {attrs: {value: this.logSearch, disabled: this.busy, clearable: true, placeholder: t('logSearch'), 'aria-label': t('logSearch')}, on: {input: function (v) { self.logSearch = v; }}})]),
                        h('label', {class: 'avahi-inline'}, [t('errorsOnly'), h('gl-switch', {attrs: {value: this.errorsOnly, size: 'small', disabled: this.busy, 'aria-label': t('errorsOnly')}, on: {input: function (v) { self.errorsOnly = v; }}})]),
                        h('label', {class: 'avahi-inline'}, [t('auto'), h('gl-switch', {attrs: {value: this.logAuto, size: 'small', disabled: this.busy, 'aria-label': t('auto')}, on: {input: function (v) { self.logAuto = v; }}})])
                    ]),
                    h('div', {class: 'avahi-actions'}, [button('refresh', this.loadLogs, false, this.logPending), button('scrollBottom', this.scrollLogs, false, !this.visibleLogs), button('exportLogs', this.exportLogs, false, !this.visibleLogs)])
                ]));
                body.push(h('pre', {ref: 'logOutput', class: 'avahi-log', attrs: {role: 'log', 'aria-label': t('logs')}}, [this.visibleLogs || t(this.errorsOnly || this.logSearch.trim() ? 'filterEmpty' : 'empty')]));
            } else {
                var hints = [h('p', [t('defaultHint')])];
                if (this.active === 'general') {
                    hints.push(h('p', [t('interfacesHint')]));
                    if (this.interfaces.length) hints.push(h('p', [t('knownInterfaces') + this.interfaces.join(', ')]));
                }
                if (this.active === 'publish') hints.push(h('p', [t('publishHint')]));
                if (this.active === 'reflector') hints.push(h('p', [t('reflectHint')]), h('p', [t('reflectIpvHint')]));
                if (this.active === 'advanced') hints.push(h('p', [t('advancedHint')]));
                body.push(h('div', {class: 'avahi-callout'}, hints));
                if (this.active === 'reflector' && this.settings.reflector && this.settings.reflector['enable-reflector'] === 'yes' && !(this.settings.server && this.settings.server['allow-interfaces'] && String(this.settings.server['allow-interfaces']).trim())) {
                    body.push(h('div', {class: 'avahi-callout is-warn', attrs: {role: 'status'}}, [h('span', [t('reflectWarn')]), button('goGeneral', function () { self.tab('general'); })]));
                }
                this.schema.filter(function (g) { return g.tab === self.active; }).forEach(function (g) {
                    var groupValues = self.settings[g.key] || {};
                    var configured = g.fields.filter(function (f) { var v = groupValues[f.key]; return v !== undefined && v !== null && v !== ''; }).length;
                    body.push(h('section', {class: 'avahi-group', key: g.key}, [
                        h('div', {class: 'avahi-group-head'}, [h('h3', [self.label(g.label)]), configured ? h('span', {class: 'avahi-badge'}, [configured + ' ' + t('configuredCount')]) : null]),
                        h('div', {class: 'avahi-group-body'}, g.fields.map(function (f) { return fieldControl(g, f); }))
                    ]));
                });
            }
            return h('div', {class: 'avahi-native'}, [
                h('style', [css]), h('gl-title', {attrs: {title: 'Avahi'}}),
                h('el-dialog', {class: 'avahi-confirm', attrs: {visible: this.confirmVisible, title: t('confirmTitle'), 'custom-class': 'avahi-confirm', 'append-to-body': true, 'close-on-click-modal': false}, on: {close: function () { self.confirmAnswer(false); }}}, [
                    h('p', [this.confirmMessage]), h('div', {slot: 'footer', class: 'avahi-dialog-footer'}, [button('cancel', function () { self.confirmAnswer(false); }), button('confirm', function () { self.confirmAnswer(true); }, true)])
                ]),
                h('gl-card', [h('p', {class: 'avahi-muted'}, [t('description')]),
                    h('div', {class: 'avahi-status'}, [
                        h('div', [
                            h('strong', {attrs: {role: 'status', 'aria-live': 'polite'}}, [h('i', {class: ['avahi-dot', this.statusLoaded && this.status.running ? 'on' : '']}), t(!this.statusLoaded ? 'unknown' : this.status.running ? 'running' : 'stopped')]),
                            h('div', {class: 'avahi-status-meta'}, [
                                h('span', {class: 'avahi-version'}, ['Avahi ' + (this.status.version || '—') + ' · UI ' + (this.status.ui_version || '—')]),
                                umdns && umdns.installed ? h('span', {class: ['avahi-badge', umdns.running || umdns.enabled ? 'is-warn' : 'is-ok']}, [t(umdns.running || umdns.enabled ? 'umdnsActive' : 'umdnsDisabled')]) : null
                            ])
                        ]),
                        h('div', {class: 'avahi-actions'}, [
                            h('label', {class: 'avahi-boot'}, [t('boot'), h('gl-switch', {attrs: {value: !!this.status.enabled, size: 'small', disabled: this.busy || this.statusPending || !this.statusLoaded, 'aria-label': t('boot')}, on: {input: function (v) { self.action(v ? 'enable' : 'disable'); }}})]),
                            button('start', function () { self.action('start'); }, false, !this.statusLoaded || this.status.running),
                            button('stop', function () { self.action('stop'); }, false, !this.statusLoaded || !this.status.running),
                            button('restart', function () { self.action('restart'); }, false, !this.statusLoaded || !this.status.running),
                            button(umdns && !umdns.running && !umdns.enabled ? 'enableUmdns' : 'disableUmdns', this.toggleUmdns, false, !this.statusLoaded || this.statusPending || !umdns || !umdns.installed)
                        ])
                    ]),
                    h('div', {class: 'avahi-tabs', attrs: {role: 'tablist', 'aria-label': 'Avahi'}}, ['general', 'publish', 'reflector', 'advanced', 'logs'].map(function (key, idx) {
                        var count = key !== 'logs' ? self.tabModifiedCount(key) : 0;
                        return h('button', {class: ['avahi-tab', self.active === key ? 'active' : ''], attrs: {type: 'button', role: 'tab', id: 'avahi-tab-' + key, 'aria-selected': String(self.active === key), 'aria-controls': 'avahi-panel', tabindex: self.active === key ? 0 : -1}, on: {click: function () { self.tab(key); }, keydown: function (e) { self.tabKey(e, idx); }}}, [
                            t(key),
                            count ? h('span', {class: 'avahi-tab-count'}, [String(count)]) : null,
                            self.tabDirty(key) ? h('span', {class: 'avahi-tab-dot', attrs: {'aria-hidden': 'true'}}) : null
                        ]);
                    })),
                    this.error ? alertBanner('error', this.error, function () { self.error = ''; }) : null,
                    this.notice ? alertBanner('notice', this.notice, function () { self.notice = ''; }) : null,
                    h('div', {attrs: {id: 'avahi-panel', role: 'tabpanel', 'aria-labelledby': 'avahi-tab-' + this.active}}, body)
                ]),
                h('div', {class: 'avahi-footer'}, [
                    h('span', {class: ['avahi-footer-status', this.dirty ? 'is-dirty' : ''], attrs: {role: 'status'}}, [this.dirty ? h('span', {class: 'avahi-dirty-dot', attrs: {'aria-hidden': 'true'}}) : null, t(this.dirty ? 'unsaved' : 'synced')]),
                    h('div', {class: 'avahi-actions'}, [button('refresh', this.refresh), button('discardChanges', this.discardChanges, false, !this.loaded || !this.dirty), button('save', function () { self.save(false); }, false, !this.loaded || !this.dirty), button('apply', function () { self.save(true); }, true, !this.loaded || !this.statusLoaded)])
                ])
            ]);
        }
    };
})();

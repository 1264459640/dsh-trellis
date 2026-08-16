/**
 * trellis-workflow client half — Web Settings tab for the allowlist.
 *
 * Contributes a tab to the Plugins settings section (slot
 * `settings.plugins.tab`) that reads/writes the same `trellis-workflow`
 * settings namespace the Host half registers, so the injection allowlist and
 * related config are editable in the Web UI and take effect on the next turn
 * without a restart.
 *
 * This file is a client bundle in the web shell's module format
 * (`window.__ModuleLoader__.load({ id, factory })`); it is served under
 * /plugins by the harness when the package is an enabled Loader entry whose
 * manifest declares `dsh.client` with `platform: web`.
 *
 * NOTE: the harness only exposes settings namespaces listed in
 * `WEB_SETTINGS_NAMESPACES` (dsh-host-apiproxy) to the Web client. Install
 * with `--patch-harness` (scripts/install.mjs) so `trellis-workflow` joins
 * that allowlist; otherwise the tab renders the "unavailable" fallback below.
 */

window.__ModuleLoader__.load({
  id: 'dsh-trellis',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    let react = require('react');

    // #region lib/types/client/trellis-settings-tab.js

    /** Settings namespace registered by the Host half (see lib/meta.js). */
    const NS = 'trellis-workflow';

    /** Locale dictionary namespace owned by this client half. */
    const LOCALE_NS = 'settings.trellisWorkflow';

    /** Services required by this client half. */
    const inject = ['slots', 'locale', 'settingsScope'];

    const zh = {
      tab: 'Trellis 工作流',
      loading: '正在读取配置…',
      unavailable:
        '当前 harness 未向 Web 暴露 trellis-workflow 命名空间（dsh-host-apiproxy 的 WEB_SETTINGS_NAMESPACES 白名单未包含它）。请用 scripts/install.mjs 的 --patch-harness 补丁后重启 DSH。',
      allowlist: '注入白名单',
      allowlistHint: '命中这些项目根的会话才会收到工作流面包屑。',
      addPlaceholder: '输入项目根路径，如 F:/Projects/FordProject',
      add: '添加',
      remove: '移除',
      empty: '（空）',
      injectStep: '注入步数（injectStep）',
      skipKeywords: '跳过关键词（逗号分隔）',
      inline: '按 codex-inline 调度解析阶段',
      saved: '已保存',
      writeFailed: '保存失败',
      chipTitle: 'Trellis Task',
      chipNoTask: '无活动任务',
      chipNoSummary: '尚无状态，点击刷新',
      chipFailed: '加载失败，点击重试',
      chipRefresh: '刷新',
      phasePlanning: '规划中',
      phaseInProgress: '执行中',
      phaseCompleted: '已完成',
      workTypeFeat: '功能',
      workTypeIssue: '缺陷',
      workTypeRefactor: '重构',
    };

    const en = {
      tab: 'Trellis Workflow',
      loading: 'Loading configuration…',
      unavailable:
        'The current harness does not expose the trellis-workflow namespace to the Web client (it is not in dsh-host-apiproxy WEB_SETTINGS_NAMESPACES). Run scripts/install.mjs --patch-harness and restart DSH.',
      allowlist: 'Injection allowlist',
      allowlistHint: 'Sessions whose cwd matches these project roots receive the workflow breadcrumb.',
      addPlaceholder: 'Project root path, e.g. F:/Projects/FordProject',
      add: 'Add',
      remove: 'Remove',
      empty: '(empty)',
      injectStep: 'Inject step (injectStep)',
      skipKeywords: 'Skip keywords (comma-separated)',
      inline: 'Resolve phases as codex-inline dispatch',
      saved: 'Saved',
      writeFailed: 'Save failed',
      chipTitle: 'Trellis Task',
      chipNoTask: 'No active task',
      chipNoSummary: 'No state yet — click to refresh',
      chipFailed: 'Load failed — click to retry',
      chipRefresh: 'Refresh',
      phasePlanning: 'Planning',
      phaseInProgress: 'In progress',
      phaseCompleted: 'Completed',
      workTypeFeat: 'Feature',
      workTypeIssue: 'Issue',
      workTypeRefactor: 'Refactor',
    };

    function TrellisSettingsTab(props) {
      const { scope, t } = props;
      const [draftPath, setDraftPath] = react.useState('');
      const [skipDraft, setSkipDraft] = react.useState('');
      const [saved, setSaved] = react.useState(false);

      const snapshot = react.useSyncExternalStore(
        (listener) => scope.subscribe(listener),
        () => scope.getSnapshot(),
      );
      const ready = snapshot && snapshot.status === 'ready';
      const value = ready ? snapshot.value : undefined;

      react.useEffect(() => {
        if (!saved) return undefined;
        const timer = setTimeout(() => setSaved(false), 2000);
        return () => clearTimeout(timer);
      }, [saved]);

      if (snapshot && snapshot.status === 'unavailable') {
        return react.createElement('p', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, t('unavailable'));
      }
      if (!ready) {
        return react.createElement('p', { style: { color: 'var(--dsw-alias-label-tertiary)' } }, t('loading'));
      }

      const write = (field, next) => {
        scope.set(field, next).then(
          () => setSaved(true),
          () => setSaved(false),
        );
      };

      const allowlist = Array.isArray(value && value.allowlist) ? value.allowlist : [];
      const skipKeywords = Array.isArray(value && value.skipKeywords) ? value.skipKeywords : [];

      const addPath = () => {
        const p = draftPath.trim();
        if (!p) return;
        if (!allowlist.includes(p)) write('allowlist', allowlist.concat(p));
        setDraftPath('');
      };

      const rowStyle = { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 };
      const inputStyle = {
        flex: 1,
        height: 32,
        padding: '0 10px',
        fontSize: 13,
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        font: 'inherit',
      };
      const btnStyle = {
        height: 32,
        padding: '0 12px',
        fontSize: 13,
        font: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-layer-3)',
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        cursor: 'pointer',
      };
      const labelStyle = { fontSize: 13, fontWeight: 600, margin: '14px 0 6px', color: 'var(--dsw-alias-label-primary)' };

      return react.createElement(
        'div',
        { style: { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 4 } },
        react.createElement('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 13 } }, t('allowlistHint')),
        react.createElement('label', { style: labelStyle }, t('allowlist')),
        allowlist.length === 0
          ? react.createElement('p', { style: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 } }, t('empty'))
          : allowlist.map((p) =>
              react.createElement(
                'div',
                { key: p, style: rowStyle },
                react.createElement(
                  'code',
                  { style: { flex: 1, overflowWrap: 'anywhere', fontFamily: 'var(--ds-font-family-code)', fontSize: 12 } },
                  p,
                ),
                react.createElement(
                  'button',
                  { type: 'button', style: btnStyle, onClick: () => write('allowlist', allowlist.filter((x) => x !== p)) },
                  t('remove'),
                ),
              ),
            ),
        react.createElement(
          'div',
          { style: rowStyle },
          react.createElement('input', {
            style: inputStyle,
            placeholder: t('addPlaceholder'),
            value: draftPath,
            onChange: (e) => setDraftPath(e.target.value),
            onKeyDown: (e) => { if (e.key === 'Enter') addPath(); },
          }),
          react.createElement('button', { type: 'button', style: btnStyle, onClick: addPath }, t('add')),
        ),
        react.createElement('label', { style: labelStyle }, t('injectStep')),
        react.createElement('input', {
          type: 'number',
          min: 1,
          style: { ...inputStyle, maxWidth: 160 },
          value: value && typeof value.injectStep === 'number' ? value.injectStep : 1,
          onChange: (e) => write('injectStep', Number(e.target.value) || 1),
        }),
        react.createElement('label', { style: labelStyle }, t('skipKeywords')),
        react.createElement('input', {
          style: inputStyle,
          value: skipDraft || skipKeywords.join(', '),
          onChange: (e) => {
            setSkipDraft(e.target.value);
            write('skipKeywords', e.target.value.split(',').map((s) => s.trim()).filter(Boolean));
          },
        }),
        react.createElement(
          'label',
          { style: { display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0 6px', fontSize: 13 } },
          react.createElement('input', {
            type: 'checkbox',
            checked: !!(value && value.inline),
            onChange: (e) => write('inline', e.target.checked),
          }),
          t('inline'),
        ),
        saved
          ? react.createElement('p', { style: { margin: 0, color: 'var(--dsw-alias-state-success-primary)', fontSize: 12 } }, t('saved'))
          : null,
      );
    }

    // #region lib/types/client/trellis-task-chip.js

    /** Stage tracks for the popover, aligned with skills/_templates/work-types.md. */
    const CHIP_TRACKS = {
      feat: ['prd', 'design', 'design-review', 'impl', 'review', 'check', 'finish'],
      issue: ['report', 'analyze', 'fix', 'fix-note'],
      refactor: ['scan', 'design', 'apply', 'done'],
    };

    const CHIP_POPOVER_STYLE = {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      zIndex: 1000,
      minWidth: 240,
      maxWidth: 320,
      padding: '10px 12px',
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 8,
      boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
      textAlign: 'left',
    };

    function chipPhaseColor(phase) {
      if (phase === 'completed') return 'var(--dsw-alias-state-success-primary)';
      if (phase === 'in_progress') return 'var(--dsw-alias-state-business-primary)';
      return 'var(--dsw-alias-state-warn-primary)'; // planning / unknown
    }

    function chipTypeLabel(summary, t) {
      const key = summary.workType && summary.workType[0].toUpperCase() + summary.workType.slice(1);
      const localized = key && t('workType' + key);
      const type = localized && localized !== 'workType' + key ? localized : summary.workType || '';
      return [type, summary.stage].filter(Boolean).join(' · ');
    }

    function buildPopover(summary, t, onRefresh) {
      const statusLabel =
        ({ planning: t('phasePlanning'), in_progress: t('phaseInProgress'), completed: t('phaseCompleted') }[summary.status]) ||
        summary.status ||
        '';
      const track = (summary.workType && CHIP_TRACKS[summary.workType]) || null;
      const currentIndex = track ? track.indexOf(summary.stage) : -1;
      const children = [];
      children.push(
        react.createElement(
          'div',
          { key: 'head', style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
          react.createElement('strong', { style: { fontSize: 12 } }, t('chipTitle')),
          react.createElement('span', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, statusLabel),
        ),
      );
      if (summary.title) {
        children.push(
          react.createElement(
            'div',
            {
              key: 'title',
              style: { marginTop: 6, fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere' },
            },
            summary.title,
          ),
        );
      }
      if (track) {
        const row = [];
        track.forEach((stage, i) => {
          if (i > 0) {
            row.push(
              react.createElement('span', { key: 'sep' + i, style: { color: 'var(--dsw-alias-label-tertiary)', fontSize: 11, flex: 'none' } }, '→'),
            );
          }
          const isCurrent = i === currentIndex;
          const done = currentIndex >= 0 && i < currentIndex;
          row.push(
            react.createElement(
              'span',
              {
                key: stage,
                style: {
                  fontSize: 11,
                  lineHeight: '16px',
                  whiteSpace: 'nowrap',
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent ? 'var(--dsw-alias-label-primary)' : done ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-tertiary)',
                  borderBottom: isCurrent ? '2px solid var(--dsw-alias-state-business-primary)' : 'none',
                },
              },
              stage,
            ),
          );
        });
        children.push(
          react.createElement(
            'div',
            { key: 'track', style: { display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 8 } },
            ...row,
          ),
        );
      }
      children.push(
        react.createElement(
          'button',
          {
            key: 'refresh',
            type: 'button',
            onClick: onRefresh,
            style: { marginTop: 8, font: 'inherit', fontSize: 11, cursor: 'pointer', color: 'var(--dsw-alias-label-secondary)', background: 'transparent', border: 'none', padding: 0, textDecoration: 'underline' },
          },
          t('chipRefresh'),
        ),
      );
      return children;
    }

    /**
     * The session-header phase chip: a compact embedded readout of the
     * project's active Trellis task. Session scope — the framework injects
     * `sessionId`; the chip only ever POSTs that id to the host's read-only
     * cache route and renders the path-free summary (or a minimal empty state).
     */
    function TaskChip(props) {
      const { sessionId, t } = props;
      const [state, setState] = react.useState({ loading: true, summary: null, failed: false });
      const [open, setOpen] = react.useState(false);
      const rootRef = react.useRef(null);

      const load = react.useCallback(() => {
        let cancelled = false;
        setState((prev) => (prev.loading ? prev : { ...prev, loading: true, failed: false }));
        fetch('/trellis-workflow/api/task-state', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error('http ' + res.status))))
          .then((json) => {
            if (cancelled) return;
            setState({ loading: false, summary: json && json.ok ? json.value : null, failed: !json || !json.ok });
          })
          .catch(() => {
            if (!cancelled) setState({ loading: false, summary: null, failed: true });
          });
        return () => {
          cancelled = true;
        };
      }, [sessionId]);

      react.useEffect(() => load(), [load]);
      react.useEffect(() => {
        const refetch = () => {
          if (document.visibilityState === 'visible' && !document.hidden) load();
        };
        document.addEventListener('visibilitychange', refetch);
        window.addEventListener('focus', refetch);
        return () => {
          document.removeEventListener('visibilitychange', refetch);
          window.removeEventListener('focus', refetch);
        };
      }, [load]);
      react.useEffect(() => {
        if (!open) return undefined;
        const onDown = (e) => {
          if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => {
          if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
          document.removeEventListener('mousedown', onDown);
          document.removeEventListener('keydown', onKey);
        };
      }, [open]);

      const { loading, summary, failed } = state;
      // Workspace not managed by Trellis: nothing to show at all.
      if (!loading && summary && summary.kind === 'no-match') return null;

      const interactive = !!(summary && summary.kind === 'task');
      let dotColor = 'var(--dsw-alias-label-tertiary)';
      let label = '';
      let title = t('chipTitle');
      if (failed) {
        dotColor = 'var(--dsw-alias-state-error-primary)';
        label = '!';
        title = t('chipFailed');
      } else if (!loading && summary) {
        if (summary.kind === 'no-task') title = t('chipNoTask');
        else if (summary.kind === 'no-summary') title = t('chipNoSummary');
        else if (summary.kind === 'task') {
          dotColor = chipPhaseColor(summary.phase);
          label = chipTypeLabel(summary, t);
        }
      }

      const chip = react.createElement(
        'button',
        {
          type: 'button',
          title,
          'aria-label': title,
          onClick: () => {
            if (interactive) setOpen(true);
            else load();
          },
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 24,
            padding: '0 8px',
            margin: 0,
            font: 'inherit',
            fontSize: 12,
            lineHeight: '16px',
            color: 'var(--dsw-alias-label-secondary)',
            background: 'transparent',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 999,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          },
        },
        react.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: dotColor, flex: 'none' } }),
        label ? react.createElement('span', {}, label) : null,
      );

      return react.createElement(
        'div',
        {
          ref: rootRef,
          onMouseEnter: () => {
            if (interactive) setOpen(true);
          },
          onMouseLeave: () => setOpen(false),
          style: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
        },
        chip,
        interactive && open
          ? react.createElement('div', { style: CHIP_POPOVER_STYLE }, buildPopover(summary, t, load))
          : null,
      );
    }
    // #endregion

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'trellis-workflow: dictionaries');
      const t = ctx.locale.bind(LOCALE_NS);
      // Bound once on this plugin's fiber: the scope's disposer follows the fiber.
      const scope = ctx.settingsScope.bind({ namespace: NS });
      ctx.slots.inject('settings.plugins.tab', () =>
        ctx.slots.register(
          {
            name: 'settings.plugins.tab',
            id: 'trellis-workflow',
            order: 20,
            label: () => t('tab'),
            locale: LOCALE_NS,
            inject: () => ({ scope }),
          },
          TrellisSettingsTab,
        ),
      );
      // Session-header phase chip: additive list seat; the framework injects
      // sessionId on this session-scope slot, so no sessions subscription.
      ctx.slots.inject('conversation.session.header.utilities', () =>
        ctx.slots.register(
          {
            name: 'conversation.session.header.utilities',
            id: 'trellis-workflow:task-chip',
            order: 100,
            locale: LOCALE_NS,
          },
          TaskChip,
        ),
      );
    }
    // #endregion

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});

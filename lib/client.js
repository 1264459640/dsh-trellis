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
  id: '@banana-peeljj12/dsh-trellis',
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
      kanbanTitle: 'Trellis 任务看板',
      kanbanRefresh: '刷新',
      colPlanning: '规划中',
      colInProgress: '进行中',
      colArchive: '历史归档',
      detailsTitle: '任务详情',
      metaType: '类型',
      metaStatus: '状态',
      metaStage: '阶段',
      metaArtifacts: '产物',
      noArtifacts: '暂无产物',
      activate: '设为当前会话激活',
      deactivate: '取消当前激活',
      archivedReadonly: '已归档任务（只读）',
      busy: '处理中…',
      otherMonth: '其他',
      noTasks: '暂无任务',
      boardLoading: '看板加载中…',
      boardFailed: '看板加载失败，点击重试',
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
      kanbanTitle: 'Trellis Task Board',
      kanbanRefresh: 'Refresh',
      colPlanning: 'Planning',
      colInProgress: 'In Progress',
      colArchive: 'Archive',
      detailsTitle: 'Task Details',
      metaType: 'Type',
      metaStatus: 'Status',
      metaStage: 'Stage',
      metaArtifacts: 'Artifacts',
      noArtifacts: 'No artifacts',
      activate: 'Set active for this session',
      deactivate: 'Clear active for this session',
      archivedReadonly: 'Archived task (read-only)',
      busy: 'Working…',
      otherMonth: 'Other',
      noTasks: 'No tasks',
      boardLoading: 'Loading board…',
      boardFailed: 'Board load failed — click to retry',
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

    // #region lib/types/client/trellis-kanban.js

    const KANBAN_POPOVER_STYLE = {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      zIndex: 1000,
      width: 640,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 480,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 10,
      boxShadow: '0 12px 32px rgba(0,0,0,0.22)',
      textAlign: 'left',
      overflow: 'hidden',
    };

    const KANBAN_HEADER_STYLE = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
      padding: '10px 12px',
      borderBottom: '1px solid var(--dsw-alias-border-l2)',
    };

    const KANBAN_BODY_STYLE = {
      display: 'flex',
      gap: 12,
      padding: 12,
      overflow: 'auto',
      flex: 1,
      minHeight: 0,
    };

    const KANBAN_LEFT_STYLE = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 };

    const KANBAN_RIGHT_STYLE = {
      flex: 'none',
      width: 216,
      borderLeft: '1px solid var(--dsw-alias-border-l2)',
      paddingLeft: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    };

    const ACTION_BUTTON_STYLE = {
      display: 'block',
      width: '100%',
      marginTop: 10,
      padding: '7px 10px',
      font: 'inherit',
      fontSize: 12,
      borderRadius: 7,
      cursor: 'pointer',
      background: 'transparent',
      border: '1px solid',
    };

    function taskTypeLabel(workType, t) {
      const key = workType && workType[0].toUpperCase() + workType.slice(1);
      const localized = key && t('workType' + key);
      return localized && localized !== 'workType' + key ? localized : workType || '';
    }

    function statusLabelOf(status, t) {
      return (
        ({ planning: t('phasePlanning'), in_progress: t('phaseInProgress'), completed: t('phaseCompleted') }[status]) ||
        status ||
        ''
      );
    }

    function KanbanTaskCard(props) {
      const { task, t, selected, active, onSelect } = props;
      const stageText = [taskTypeLabel(task.workType, t), task.stage].filter(Boolean).join(' · ');
      return react.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSelect(task.slug),
          title: task.title,
          style: {
            display: 'block',
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            padding: '7px 9px',
            margin: 0,
            borderRadius: 7,
            cursor: 'pointer',
            background: selected ? 'var(--dsw-alias-bg-layer-2)' : 'var(--dsw-alias-bg-layer-1)',
            border: selected
              ? '1px solid var(--dsw-alias-state-business-primary)'
              : '1px solid var(--dsw-alias-border-l2)',
          },
        },
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          active
            ? react.createElement('span', {
                style: {
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--dsw-alias-state-business-primary)',
                  flex: 'none',
                  boxShadow: '0 0 0 3px rgba(0,0,0,0.08)',
                },
              })
            : null,
          react.createElement(
            'span',
            {
              style: {
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--dsw-alias-label-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
              },
            },
            task.title,
          ),
        ),
        react.createElement(
          'div',
          {
            style: {
              marginTop: 3,
              fontSize: 11,
              color: 'var(--dsw-alias-label-tertiary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          },
          stageText,
        ),
      );
    }

    function KanbanColumn(props) {
      const { title, tasks, t, selected, activeSlug, onSelect } = props;
      return react.createElement(
        'div',
        { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 } },
        react.createElement(
          'div',
          {
            style: {
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--dsw-alias-label-secondary)',
              letterSpacing: 0.3,
            },
          },
          title + ' (' + tasks.length + ')',
        ),
        tasks.length === 0
          ? react.createElement(
              'div',
              { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)', padding: '6px 2px' } },
              t('empty'),
            )
          : tasks.map((task) =>
              react.createElement(KanbanTaskCard, {
                key: task.slug,
                task,
                t,
                selected: selected === task.slug,
                active: activeSlug === task.slug,
                onSelect,
              }),
            ),
      );
    }

    function KanbanArchive(props) {
      const { tasks, t, selected, onSelect, expanded, onToggle } = props;
      const groups = {};
      tasks.forEach((task) => {
        const key = task.month || t('otherMonth');
        (groups[key] = groups[key] || []).push(task);
      });
      // Keys are `yyyy-mm` (the archive bucket folder name, shared with the
      // archive operation) or a non-date fallback (e.g. the `other` bucket).
      // Sort date keys newest-first; non-date keys go last.
      const ymRank = (key) => {
        const match = /^(\d{4})-(\d{2})$/.exec(key);
        return match ? Number(match[1]) * 100 + Number(match[2]) : -1;
      };
      const keys = Object.keys(groups).sort((a, b) => ymRank(b) - ymRank(a));
      if (keys.length === 0) return null;
      return react.createElement(
        'div',
        { style: { borderTop: '1px solid var(--dsw-alias-border-l2)', marginTop: 4, paddingTop: 6 } },
        keys.map((key) => {
          const open = expanded.has(key);
          // A yyyy-mm key is its own label (the folder name); anything else
          // is already a localized fallback like the `other` bucket label.
          const monthLabel = key;
          return react.createElement(
            'div',
            { key: key },
            react.createElement(
              'button',
              {
                type: 'button',
                onClick: () => onToggle(key),
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  font: 'inherit',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--dsw-alias-label-secondary)',
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 2px',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                },
              },
              react.createElement('span', {}, open ? '▾' : '▸'),
              react.createElement('span', {}, '📦 ' + monthLabel + ' (' + groups[key].length + ')'),
            ),
            open
              ? groups[key].map((task) =>
                  react.createElement(
                    'button',
                    {
                      key: task.slug,
                      type: 'button',
                      onClick: () => onSelect(task.slug),
                      style: {
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        font: 'inherit',
                        fontSize: 11,
                        padding: '3px 8px',
                        margin: 0,
                        borderRadius: 5,
                        cursor: 'pointer',
                        background:
                          selected === task.slug ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
                        border:
                          selected === task.slug
                            ? '1px solid var(--dsw-alias-state-business-primary)'
                            : 'none',
                        color: 'var(--dsw-alias-label-secondary)',
                      },
                    },
                    '[' + taskTypeLabel(task.workType, t) + '] ' + task.slug,
                  ),
                )
              : null,
          );
        }),
      );
    }

    function KanbanDetails(props) {
      const { task, t, active, busy, onActivate, onDeactivate } = props;
      if (!task) {
        return react.createElement(
          'div',
          { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } },
          t('empty'),
        );
      }
      const track = (task.workType && CHIP_TRACKS[task.workType]) || null;
      const currentIndex = track ? track.indexOf(task.stage) : -1;
      const archived = task.status === 'completed';
      const stageFlow = track
        ? track.map((stage, i) => {
            const isCurrent = i === currentIndex;
            const done = currentIndex >= 0 && i < currentIndex;
            return react.createElement(
              'span',
              {
                key: stage,
                style: {
                  fontSize: 10,
                  lineHeight: '16px',
                  whiteSpace: 'nowrap',
                  fontWeight: isCurrent ? 700 : 400,
                  color: isCurrent
                    ? 'var(--dsw-alias-label-primary)'
                    : done
                      ? 'var(--dsw-alias-state-success-primary)'
                      : 'var(--dsw-alias-label-tertiary)',
                  borderBottom: isCurrent ? '2px solid var(--dsw-alias-state-business-primary)' : 'none',
                },
              },
              stage,
            );
          })
        : [];
      const artifacts = Array.isArray(task.artifacts)
        ? task.artifacts.filter((n) => /\.(md|yaml|ya?ml|json)$/.test(n || '')).slice(0, 6)
        : [];
      const metaRow = (label, value) =>
        react.createElement(
          'div',
          { style: { display: 'flex', gap: 6, fontSize: 11, marginBottom: 3 } },
          react.createElement('span', { style: { color: 'var(--dsw-alias-label-tertiary)', flex: 'none' } }, label),
          react.createElement(
            'span',
            { style: { color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere', flex: 1 } },
            value,
          ),
        );
      const action =
        archived
          ? react.createElement(
              'span',
              { style: { display: 'block', marginTop: 10, fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } },
              t('archivedReadonly'),
            )
          : active
            ? react.createElement(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: onDeactivate,
                  style: {
                    ...ACTION_BUTTON_STYLE,
                    color: 'var(--dsw-alias-state-error-primary)',
                    borderColor: 'var(--dsw-alias-state-error-primary)',
                    opacity: busy ? 0.6 : 1,
                  },
                },
                busy ? t('busy') : t('deactivate'),
              )
            : react.createElement(
                'button',
                {
                  type: 'button',
                  disabled: busy,
                  onClick: onActivate,
                  style: {
                    ...ACTION_BUTTON_STYLE,
                    color: 'var(--dsw-alias-state-business-primary)',
                    borderColor: 'var(--dsw-alias-state-business-primary)',
                    opacity: busy ? 0.6 : 1,
                  },
                },
                busy ? t('busy') : t('activate'),
              );
      return react.createElement(
        'div',
        { style: KANBAN_RIGHT_STYLE },
        react.createElement('div', { style: { fontSize: 11, fontWeight: 700, color: 'var(--dsw-alias-label-secondary)' } }, t('detailsTitle')),
        react.createElement(
          'div',
          { style: { fontSize: 13, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', overflowWrap: 'anywhere' } },
          task.title,
        ),
        metaRow(t('metaType'), taskTypeLabel(task.workType, t) + (task.workType ? '' : '—')),
        metaRow(t('metaStatus'), statusLabelOf(task.status, t)),
        metaRow(t('metaStage'), task.stage || '—'),
        stageFlow.length > 0
          ? react.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', marginTop: 4 } },
              ...stageFlow,
            )
          : null,
        react.createElement(
          'div',
          { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 3 } },
          react.createElement(
            'div',
            { style: { fontSize: 11, fontWeight: 700, color: 'var(--dsw-alias-label-secondary)' } },
            t('metaArtifacts'),
          ),
          artifacts.length === 0
            ? react.createElement('div', { style: { fontSize: 11, color: 'var(--dsw-alias-label-tertiary)' } }, t('noArtifacts'))
            : artifacts.map((name) =>
                react.createElement(
                  'div',
                  { key: name, style: { fontSize: 11, color: 'var(--dsw-alias-state-success-primary)', overflowWrap: 'anywhere' } },
                  '✔ ' + name,
                ),
              ),
        ),
        action,
      );
    }

    function KanbanBoard(props) {
      const { board, t, selected, onSelect, expanded, onToggle, busy, onActivate, onDeactivate } = props;
      const tasks = Array.isArray(board.tasks) ? board.tasks : [];
      const planning = tasks.filter((task) => task.status === 'planning');
      const inProgress = tasks.filter((task) => task.status === 'in_progress');
      const archived = tasks.filter((task) => task.status === 'completed');
      const activeSlug = board.currentTask || null;
      const selectedTask = tasks.find((task) => task.slug === selected) || null;
      return react.createElement(
        'div',
        { style: KANBAN_BODY_STYLE },
        react.createElement(
          'div',
          { style: KANBAN_LEFT_STYLE },
          tasks.length === 0
            ? react.createElement(
                'div',
                { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)', padding: '12px 2px' } },
                t('noTasks'),
              )
            : null,
          react.createElement(
            'div',
            { style: { display: 'flex', gap: 8 } },
            react.createElement(KanbanColumn, {
              title: t('colPlanning'),
              tasks: planning,
              t,
              selected,
              activeSlug,
              onSelect,
            }),
            react.createElement(KanbanColumn, {
              title: t('colInProgress'),
              tasks: inProgress,
              t,
              selected,
              activeSlug,
              onSelect,
            }),
          ),
          react.createElement(KanbanArchive, {
            tasks: archived,
            t,
            selected,
            onSelect,
            expanded,
            onToggle,
          }),
        ),
        react.createElement(KanbanDetails, {
          task: selectedTask,
          t,
          active: !!(selectedTask && selectedTask.slug === activeSlug),
          busy,
          onActivate: () => onActivate(selectedTask.slug),
          onDeactivate,
        }),
      );
    }

    /**
     * The session-header phase chip: a compact embedded readout of the
     * project's active Trellis task. Clicking the chip opens the mini kanban —
     * two active columns (planning / in-progress), a month-collapsed archive,
     * and a master-detail pane with an explicit activate/deactivate action for
     * THIS session only (per-session pointer file, never other sessions').
     */
    function TaskChip(props) {
      const { sessionId, t } = props;
      const [state, setState] = react.useState({ loading: true, summary: null, failed: false });
      const [open, setOpen] = react.useState(false);
      const [board, setBoard] = react.useState(null);
      const [boardFailed, setBoardFailed] = react.useState(false);
      const [selected, setSelected] = react.useState(null);
      const [expanded, setExpanded] = react.useState(() => new Set());
      const [busy, setBusy] = react.useState(false);
      const rootRef = react.useRef(null);
      // One-shot "open the board when the in-flight summary fetch lands":
      // a click on an unknown-state ('no-summary') chip refreshes, and if the
      // project turns out to be Trellis-matched it opens the kanban directly,
      // so a single click never looks dead. The focus/visibility refetch path
      // never sets this, so the popover won't pop open on tab switches.
      const pendingOpenRef = react.useRef(false);

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
            const next = json && json.ok ? json.value : null;
            setState({ loading: false, summary: next, failed: !json || !json.ok });
            if (pendingOpenRef.current) {
              pendingOpenRef.current = false;
              if (next && (next.kind === 'task' || next.kind === 'no-task')) setOpen(true);
            }
          })
          .catch(() => {
            if (!cancelled) {
              setState({ loading: false, summary: null, failed: true });
              pendingOpenRef.current = false;
            }
          });
        return () => {
          cancelled = true;
        };
      }, [sessionId]);

      const loadBoard = react.useCallback(() => {
        let cancelled = false;
        setBoardFailed(false);
        fetch('/trellis-workflow/api/board', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
          .then((res) => (res.ok ? res.json() : Promise.reject(new Error('http ' + res.status))))
          .then((json) => {
            if (cancelled) return;
            if (!json || !json.ok) {
              setBoardFailed(true);
              return;
            }
            const value = json.value;
            if (!value || value.kind !== 'board') {
              setBoardFailed(true);
              return;
            }
            setBoard(value);
            setSelected((prev) => {
              if (prev && Array.isArray(value.tasks) && value.tasks.some((task) => task.slug === prev)) return prev;
              return value.currentTask || null;
            });
          })
          .catch(() => {
            if (!cancelled) setBoardFailed(true);
          });
        return () => {
          cancelled = true;
        };
      }, [sessionId]);

      const bind = react.useCallback(
        (taskSlug) => {
          setBusy(true);
          fetch('/trellis-workflow/api/bind', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ sessionId, taskSlug }),
          })
            .then((res) => (res.ok ? res.json() : Promise.reject(new Error('http ' + res.status))))
            .then((json) => {
              if (json && json.ok) {
                loadBoard();
                load();
              }
            })
            .catch(() => {
              /* keep the board as-is; the user can retry */
            })
            .finally(() => setBusy(false));
        },
        [sessionId, load, loadBoard],
      );

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
      react.useEffect(() => {
        if (open && !board && !boardFailed) loadBoard();
      }, [open, board, boardFailed, loadBoard]);

      const { loading, summary, failed } = state;
      // Workspace not managed by Trellis: nothing to show at all.
      if (!loading && summary && summary.kind === 'no-match') return null;

      // Interactive (opens the mini kanban) for ANY Trellis-matched project,
      // with or without an active task: the board is the entry point to pick
      // and activate a task, so gating it on kind === 'task' made it
      // unreachable exactly when no task is active yet ('no-task').
      const interactive = !!(summary && (summary.kind === 'task' || summary.kind === 'no-task'));
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
            if (interactive) setOpen((v) => !v);
            else {
              pendingOpenRef.current = true;
              load();
            }
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

      const popover = !interactive
        ? null
        : open
          ? react.createElement(
              'div',
              { style: KANBAN_POPOVER_STYLE },
              react.createElement(
                'div',
                { style: KANBAN_HEADER_STYLE },
                react.createElement(
                  'strong',
                  { style: { fontSize: 12 } },
                  t('kanbanTitle'),
                ),
                react.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => {
                      setBoard(null);
                      setBoardFailed(false);
                      loadBoard();
                    },
                    style: {
                      font: 'inherit',
                      fontSize: 11,
                      cursor: 'pointer',
                      color: 'var(--dsw-alias-label-secondary)',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      textDecoration: 'underline',
                    },
                  },
                  t('kanbanRefresh'),
                ),
              ),
              boardFailed
                ? react.createElement(
                    'div',
                    {
                      style: { padding: 16, fontSize: 12, color: 'var(--dsw-alias-state-error-primary)', cursor: 'pointer' },
                      onClick: () => {
                        setBoard(null);
                        setBoardFailed(false);
                        loadBoard();
                      },
                    },
                    t('boardFailed'),
                  )
                : !board
                  ? react.createElement(
                      'div',
                      { style: { padding: 16, fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } },
                      t('boardLoading'),
                    )
                  : react.createElement(KanbanBoard, {
                      board,
                      t,
                      selected,
                      onSelect: setSelected,
                      expanded,
                      onToggle: (key) =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(key)) next.delete(key);
                          else next.add(key);
                          return next;
                        }),
                      busy,
                      onActivate: bind,
                      onDeactivate: () => bind(null),
                    }),
            )
          : null;

      return react.createElement(
        'div',
        {
          ref: rootRef,
          style: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
        },
        chip,
        popover,
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

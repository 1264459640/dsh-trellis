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
      enforceReadonlyPlanning: '规划期只读保护（enforceReadonlyPlanning）',
      enforceReadonlyPlanningHint:
        '开启后，命中白名单的项目里：新对话（未建任务）只有读工具 + 创建/跳过任务工具；规划中的任务只保留读工具与 trellis_artifact_update；经 trellis_task_skip 跳过任务的会话恢复完整写工具。',
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
      expandBoard: '⛶ 展开大看板',
      collapseBoard: '收起大看板',
      filterAll: '全部',
      filterFeat: '功能',
      filterIssue: '缺陷',
      filterRefactor: '重构',
      searchPlaceholder: '搜索标题或 slug…',
      sendToChat: '💬 推进任务',
      sendToChatSuccess: '已填入输入框，回车即可发送',
      sendToChatFailed: '自动填入失败，已复制到剪贴板',
      pendingVerification: '待验证',
      blocked: '阻塞',
      boardHint: '仅展示与推进，不直接改状态',
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
      enforceReadonlyPlanning: 'Read-only planning (enforceReadonlyPlanning)',
      enforceReadonlyPlanningHint:
        'When enabled, in allowlisted projects: a fresh conversation (no task yet) gets only read tools + create/skip-task tools; a task in the planning phase keeps read tools plus trellis_artifact_update only; a session that skipped the task via trellis_task_skip regains full write tools.',
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
      expandBoard: '⛶ Expand board',
      collapseBoard: 'Collapse board',
      filterAll: 'All',
      filterFeat: 'Feature',
      filterIssue: 'Issue',
      filterRefactor: 'Refactor',
      searchPlaceholder: 'Search title or slug…',
      sendToChat: '💬 Push to chat',
      sendToChatSuccess: 'Filled into the input — press Enter to send',
      sendToChatFailed: 'Auto-fill failed, copied to clipboard',
      pendingVerification: 'Verifying',
      blocked: 'Blocked',
      boardHint: 'View & push only — no direct state changes',
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
        react.createElement(
          'label',
          { style: { display: 'flex', gap: 8, alignItems: 'center', margin: '14px 0 6px', fontSize: 13 } },
          react.createElement('input', {
            type: 'checkbox',
            checked: !!(value && value.enforceReadonlyPlanning),
            onChange: (e) => write('enforceReadonlyPlanning', e.target.checked),
          }),
          t('enforceReadonlyPlanning'),
        ),
        react.createElement('p', { style: { margin: 0, color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } }, t('enforceReadonlyPlanningHint')),
        saved
          ? react.createElement('p', { style: { margin: 0, color: 'var(--dsw-alias-state-success-primary)', fontSize: 12 } }, t('saved'))
          : null,
      );
    }

    // #region lib/types/client/trellis-task-chip.js

    // NOTE: stage lanes are NOT maintained here anymore — the board payload
    // ships `tracks` (single source of truth: lib/state.js TRACKS), so the
    // client never holds its own track copy (design review P1 convergence).

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

    // Expanded full-board modal (Subtask 3). The overlay is fixed and rendered
    // inside TaskChip's rootRef, so the popover's outside/Esc handlers never
    // close it; the modal owns its own Esc / overlay-click close semantics.
    const KANBAN_MODAL_OVERLAY_STYLE = {
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    };

    const KANBAN_MODAL_STYLE = {
      width: 'min(1120px, 100%)',
      maxHeight: '88vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--dsw-alias-bg-layer-3)',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 12,
      boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
      overflow: 'hidden',
    };

    function taskTypeLabel(workType, t) {
      const key = workType && workType[0].toUpperCase() + workType.slice(1);
      const localized = key && t('workType' + key);
      return localized && localized !== 'workType' + key ? localized : workType || '';
    }

    function phaseLabelOf(phase, t) {
      if (phase === 'planning' || phase === 'planning-inline') return t('phasePlanning');
      if (phase === 'in_progress' || phase === 'in_progress-inline') return t('phaseInProgress');
      if (phase === 'completed') return t('phaseCompleted');
      return phase || '';
    }

    /**
     * Work-type accent color (DSW semantic variables only): feat=blue,
     * issue=red, refactor=orange. Unknown types fall back to neutral.
     */
    function workTypeColor(workType) {
      if (workType === 'feat') return 'var(--dsw-alias-state-business-primary)'
      if (workType === 'issue') return 'var(--dsw-alias-state-error-primary)'
      if (workType === 'refactor') return 'var(--dsw-alias-state-warn-primary)'
      return 'var(--dsw-alias-label-tertiary)'
    }

    /**
     * Compact single-row task card for the default popover list view.
     * Deliberately information-sparse: type dot, title, step brief, stage.
     */
    function KanbanTaskCard(props) {
      const { task, t, selected, active, onSelect } = props;
      const color = workTypeColor(task.workType);
      // Defensive defaults for partial payloads (design-review P2#5).
      const totalSteps = task.totalSteps || 0;
      const completedSteps = task.completedSteps || 0;
      const hasBlocked = task.hasBlocked === true;
      const hasPendingVerification = task.hasPendingVerification === true;
      const stepBrief =
        totalSteps > 0
          ? hasBlocked
            ? '⚠ ' + t('blocked')
            : hasPendingVerification
              ? completedSteps + '/' + totalSteps + ' ⏳'
              : completedSteps + '/' + totalSteps
          : null;
      return react.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSelect(task.slug),
          title: task.title,
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            fontSize: 12,
            lineHeight: '20px',
            padding: '2px 6px',
            margin: 0,
            borderRadius: 6,
            cursor: 'pointer',
            background: selected ? 'var(--dsw-alias-bg-layer-2)' : 'transparent',
            border: selected
              ? '1px solid var(--dsw-alias-state-business-primary)'
              : '1px solid transparent',
          },
        },
        active
          ? react.createElement('span', {
              style: {
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--dsw-alias-state-business-primary)',
                flex: 'none',
              },
            })
          : null,
        react.createElement('span', {
          style: { width: 7, height: 7, borderRadius: '50%', background: color, flex: 'none' },
        }),
        react.createElement(
          'span',
          {
            style: {
              color: 'var(--dsw-alias-label-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            },
          },
          task.title,
        ),
        stepBrief
          ? react.createElement(
              'span',
              {
                style: {
                  flex: 'none',
                  fontSize: 10,
                  color: task.hasBlocked
                    ? 'var(--dsw-alias-state-error-primary)'
                    : task.hasPendingVerification
                      ? 'var(--dsw-alias-state-warn-primary)'
                      : 'var(--dsw-alias-label-tertiary)',
                },
              },
              stepBrief,
            )
          : null,
        react.createElement(
          'span',
          {
            style: {
              flex: 'none',
              fontSize: 10,
              fontWeight: 600,
              padding: '0 5px',
              borderRadius: 4,
              lineHeight: '16px',
              color: 'var(--dsw-alias-label-secondary)',
              background: 'var(--dsw-alias-bg-layer-2)',
              border: '1px solid var(--dsw-alias-border-l2)',
            },
          },
          task.stage || '—',
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

    /**
     * Element visibility guard for composer targeting (skip hidden inputs).
     */
    function isVisibleEl(el) {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    }

    /**
     * Inject a text fragment into the DSH composer (Subtask 4). Strategy:
     *   1. visible React-controlled textarea — native value setter + input event
     *      (plain `.value =` does not update React's controlled state);
     *   2. visible contenteditable — execCommand('insertText');
     *   3. fallback: copy to clipboard (caller surfaces the notice).
     * Never touches task state — this is purely an input affordance.
     * @param {string} text text to append into the composer.
     * @returns {boolean} true when injected into the input, false when only
     *   clipboard-copied or failed (caller decides the notice text).
     */
    function injectToComposer(text) {
      const textareaSelectors = [
        'textarea[data-testid="composer-input"]',
        'textarea[data-testid="prompt-input"]',
        'textarea[placeholder]',
      ];
      for (const sel of textareaSelectors) {
        const nodes = Array.from(document.querySelectorAll(sel));
        for (const el of nodes) {
          if (!isVisibleEl(el)) continue;
          try {
            const proto = Object.getPrototypeOf(el);
            const desc = Object.getOwnPropertyDescriptor(proto, 'value');
            const next = el.value ? el.value.replace(/\s+$/, '') + ' ' + text : text;
            if (desc && desc.set) desc.set.call(el, next);
            else el.value = next;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.focus();
            return true;
          } catch {
            /* try the next candidate */
          }
        }
      }
      const editable = Array.from(document.querySelectorAll('[contenteditable="true"]')).find(isVisibleEl);
      if (editable) {
        try {
          editable.focus();
          document.execCommand('insertText', false, text);
          return true;
        } catch {
          /* fall through to clipboard */
        }
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch {
        /* last resort: nothing more we can do */
      }
      return false;
    }

    /**
     * Build the push-to-chat prompt for a task. The client does NOT re-derive
     * step semantics: it formats the host-computed `activeStep` verbatim, so
     * verification gates and attention priority (blocked > in_progress >
     * verifying > pending) stay aligned with the state machine.
     * @param {object} task board task record.
     * @returns {string} prompt text to inject.
     */
    function pushPromptFor(task) {
      const header = '请继续推进 Trellis 任务 ' + task.slug;
      const a = task.activeStep;
      if (a) {
        const stateTag =
          a.status === 'blocked'
            ? '（⚠️ 步骤已阻塞）'
            : a.status === 'verifying'
              ? '（待验证）'
              : a.status === 'in_progress'
                ? '（实施中）'
                : '';
        let msg =
          header +
          '，当前执行步骤 [' +
          a.id +
          '] ' +
          a.title +
          stateTag +
          '（步骤进度 ' +
          (a.index + 1) +
          '/' +
          a.total +
          '）。';
        if (a.status === 'blocked' && a.blockedReason) msg += '阻塞原因：' + a.blockedReason + '。';
        msg += '请按 Trellis 工作流继续推进。';
        return msg;
      }
      return header + '，当前处于 ' + (task.stage || '?') + ' 阶段。请按 Trellis 工作流继续推进。';
    }

    /**
     * Native file token for an artifact, with the archive-path branch so
     * archived tasks never produce dead references (design review P1):
     *   active:  @.trellis/tasks/<slug>/<name>
     *   archive: @.trellis/tasks/archive/<month>/<slug>/<name>
     * @param {object} task board task record.
     * @param {string} name artifact file name.
     * @returns {string} `@`-prefixed token the DSH composer resolves natively.
     */
    function artifactToken(task, name) {
      if (task.archived && task.month) {
        return '@.trellis/tasks/archive/' + task.month + '/' + task.slug + '/' + name;
      }
      return '@.trellis/tasks/' + task.slug + '/' + name;
    }

    function KanbanDetails(props) {
      const { task, t, active, busy, onActivate, onDeactivate, tracks } = props;
      // One-shot injection notice: 'ok' | 'fail' | null, auto-clears.
      const [notice, setNotice] = react.useState(null);
      react.useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), 2600);
        return () => clearTimeout(timer);
      }, [notice]);
      const push = (text) => {
        const injected = injectToComposer(text);
        setNotice(injected ? 'ok' : 'fail');
      };
      if (!task) {
        return react.createElement(
          'div',
          { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary)' } },
          t('empty'),
        );
      }
      const trackDef = (task.workType && tracks && tracks[task.workType]) || null;
      const track = trackDef ? trackDef.stages : null;
      const currentIndex = track ? track.indexOf(task.stage) : -1;
      // Read-only gate keys off `archived` (matching artifactToken's branch),
      // with status as a defensive complement — one consistent invariant.
      const archived = task.archived === true || task.status === 'completed';
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
      const pushButton = archived
        ? null
        : react.createElement(
            'button',
            {
              type: 'button',
              onClick: () => push(pushPromptFor(task)),
              style: {
                ...ACTION_BUTTON_STYLE,
                color: 'var(--dsw-alias-state-success-primary)',
                borderColor: 'var(--dsw-alias-state-success-primary)',
              },
            },
            t('sendToChat'),
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
        metaRow(t('metaStatus'), phaseLabelOf(task.phase, t)),
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
                  'button',
                  {
                    key: name,
                    type: 'button',
                    onClick: () => push(artifactToken(task, name)),
                    title: 'insert ' + artifactToken(task, name),
                    style: {
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      font: 'inherit',
                      fontSize: 11,
                      color: 'var(--dsw-alias-state-success-primary)',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      margin: 0,
                      cursor: 'pointer',
                      overflowWrap: 'anywhere',
                      textDecoration: 'underline dotted',
                    },
                  },
                  '✔ ' + name,
                ),
              ),
        ),
        pushButton,
        action,
        notice
          ? react.createElement(
              'div',
              {
                style: {
                  marginTop: 6,
                  fontSize: 11,
                  color:
                    notice === 'ok'
                      ? 'var(--dsw-alias-state-success-primary)'
                      : 'var(--dsw-alias-state-warn-primary)',
                  overflowWrap: 'anywhere',
                },
              },
              notice === 'ok' ? t('sendToChatSuccess') : t('sendToChatFailed'),
            )
          : null,
      );
    }

    function KanbanBoard(props) {
      const { board, t, selected, onSelect, expanded, onToggle, busy, onActivate, onDeactivate, filter, onFilterChange } = props;
      const tasksAll = Array.isArray(board.tasks) ? board.tasks : [];
      // Lightweight type filter (all | feat | issue | refactor) — shared with
      // the expanded modal; archived tasks keep their month grouping.
      const tasks =
        !filter || filter === 'all'
          ? tasksAll
          : tasksAll.filter((task) => task.workType === filter);
      // Columns key off the RESOLVED phase (board.phase, stage-aware) rather
      // than the raw status, so a refactor task at scan stays in the planning
      // (read-only) column even if its status drifted to in_progress.
      const planning = tasks.filter(
        (task) => task.phase === 'planning' || task.phase === 'planning-inline',
      );
      const inProgress = tasks.filter(
        (task) => task.phase === 'in_progress' || task.phase === 'in_progress-inline',
      );
      const archived = tasks.filter((task) => task.phase === 'completed' || task.archived === true);
      const activeSlug = board.currentTask || null;
      const selectedTask = tasksAll.find((task) => task.slug === selected) || null;

      const filterChip = (value, label) =>
        react.createElement(
          'button',
          {
            type: 'button',
            onClick: () => onFilterChange(filter === value ? 'all' : value),
            style: {
              font: 'inherit',
              fontSize: 11,
              lineHeight: '18px',
              padding: '0 8px',
              margin: 0,
              borderRadius: 999,
              cursor: 'pointer',
              background:
                filter === value ? 'var(--dsw-alias-bg-layer-3)' : 'transparent',
              color:
                filter === value
                  ? 'var(--dsw-alias-label-primary)'
                  : 'var(--dsw-alias-label-secondary)',
              border:
                filter === value
                  ? '1px solid var(--dsw-alias-state-business-primary)'
                  : '1px solid var(--dsw-alias-border-l2)',
              whiteSpace: 'nowrap',
            },
          },
          label,
        );

      return react.createElement(
        'div',
        { style: KANBAN_BODY_STYLE },
        react.createElement(
          'div',
          { style: KANBAN_LEFT_STYLE },
          react.createElement(
            'div',
            { style: { display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' } },
            filterChip('all', t('filterAll')),
            filterChip('feat', t('filterFeat')),
            filterChip('issue', t('filterIssue')),
            filterChip('refactor', t('filterRefactor')),
          ),
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
          tracks: board.tracks,
        }),
      );
    }

    /**
     * Roomier card for the expanded full-board lanes: title (up to 2 lines),
     * slug, step brief and stage badge. Still read-only; selection only.
     */
    function KanbanLaneCard(props) {
      const { task, t, selected, active, onSelect } = props;
      const color = workTypeColor(task.workType);
      // Defensive defaults for partial payloads (design-review P2#5).
      const totalSteps = task.totalSteps || 0;
      const completedSteps = task.completedSteps || 0;
      const hasBlocked = task.hasBlocked === true;
      const hasPendingVerification = task.hasPendingVerification === true;
      const stepBrief =
        totalSteps > 0
          ? hasBlocked
            ? '⚠ ' + t('blocked')
            : hasPendingVerification
              ? completedSteps + '/' + totalSteps + ' ⏳'
              : completedSteps + '/' + totalSteps
          : null;
      return react.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSelect(task.slug),
          title: task.slug,
          style: {
            display: 'block',
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            padding: '8px 10px',
            margin: 0,
            borderRadius: 8,
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
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--dsw-alias-state-business-primary)',
                  flex: 'none',
                },
              })
            : null,
          react.createElement('span', {
            style: { width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none' },
          }),
          react.createElement(
            'span',
            {
              style: {
                flex: 1,
                fontSize: 12.5,
                fontWeight: 600,
                lineHeight: '17px',
                color: 'var(--dsw-alias-label-primary)',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              },
            },
            task.title,
          ),
        ),
        react.createElement(
          'div',
          { style: { marginTop: 4, fontSize: 10, color: 'var(--dsw-alias-label-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
          task.slug,
        ),
        react.createElement(
          'div',
          { style: { marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          stepBrief
            ? react.createElement(
                'span',
                {
                  style: {
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '0 5px',
                    borderRadius: 4,
                    lineHeight: '15px',
                    color: task.hasBlocked
                      ? 'var(--dsw-alias-state-error-primary)'
                      : task.hasPendingVerification
                        ? 'var(--dsw-alias-state-warn-primary)'
                        : 'var(--dsw-alias-state-success-primary)',
                    background: 'var(--dsw-alias-bg-layer-2)',
                  },
                },
                stepBrief,
              )
            : null,
          react.createElement(
            'span',
            {
              style: {
                fontSize: 10,
                fontWeight: 600,
                padding: '0 5px',
                borderRadius: 4,
                lineHeight: '15px',
                color: 'var(--dsw-alias-label-secondary)',
                background: 'var(--dsw-alias-bg-layer-2)',
                border: '1px solid var(--dsw-alias-border-l2)',
              },
            },
            task.stage || '—',
          ),
        ),
      );
    }

    /**
     * Expanded full-board modal: stage lanes per work type (lanes come from the
     * board `tracks` payload — single source of truth), live title/slug search,
     * shared type filter, and the same read-only details pane on the right.
     */
    function KanbanExpandedModal(props) {
      const {
        board,
        t,
        selected,
        onSelect,
        busy,
        onActivate,
        onDeactivate,
        filter,
        onFilterChange,
        onClose,
      } = props;
      const [query, setQuery] = react.useState('');

      // The modal owns its close semantics (Esc + overlay click); because it
      // renders inside TaskChip's rootRef, the popover handlers never see it.
      react.useEffect(() => {
        const onKey = (e) => {
          if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

      // Null-board guard (P1 from code review): expanding always triggers a
      // fresh loadBoard(), so while it lands the modal shows a loading
      // placeholder instead of dereferencing board.tasks on null.
      if (!board) {
        return react.createElement(
          'div',
          { style: KANBAN_MODAL_OVERLAY_STYLE },
          react.createElement(
            'div',
            {
              style: {
                ...KANBAN_MODAL_STYLE,
                alignItems: 'center',
                justifyContent: 'center',
                padding: 32,
                fontSize: 12,
                color: 'var(--dsw-alias-label-tertiary)',
              },
            },
            t('boardLoading'),
          ),
        );
      }
      const tasksAll = Array.isArray(board.tasks) ? board.tasks : [];
      const tracks = (board && board.tracks) || null;
      const activeSlug = (board && board.currentTask) || null;

      const q = query.trim().toLowerCase();
      const tasks = tasksAll.filter((task) => {
        if (filter !== 'all' && task.workType !== filter) return false;
        if (!q) return true;
        return (
          (task.title || '').toLowerCase().includes(q) ||
          String(task.slug).toLowerCase().includes(q)
        );
      });
      const selectedTask = tasksAll.find((task) => task.slug === selected) || null;

      const laneItems = (wt, stage) =>
        tasks.filter(
          (task) =>
            task.phase !== 'completed' &&
            task.archived !== true &&
            task.workType === wt &&
            task.stage === stage,
        );
      const archivedItems = tasks.filter(
        (task) => task.phase === 'completed' || task.archived === true,
      );

      const workTypes = ['feat', 'issue', 'refactor'].filter(
        (wt) => filter === 'all' || filter === wt,
      );

      const filterChip = (value, label) =>
        react.createElement(
          'button',
          {
            type: 'button',
            onClick: () => onFilterChange(filter === value ? 'all' : value),
            style: {
              font: 'inherit',
              fontSize: 11,
              lineHeight: '18px',
              padding: '0 8px',
              margin: 0,
              borderRadius: 999,
              cursor: 'pointer',
              background: filter === value ? 'var(--dsw-alias-bg-layer-3)' : 'transparent',
              color:
                filter === value
                  ? 'var(--dsw-alias-label-primary)'
                  : 'var(--dsw-alias-label-secondary)',
              border:
                filter === value
                  ? '1px solid var(--dsw-alias-state-business-primary)'
                  : '1px solid var(--dsw-alias-border-l2)',
              whiteSpace: 'nowrap',
            },
          },
          label,
        );

      return react.createElement(
        'div',
        {
          style: KANBAN_MODAL_OVERLAY_STYLE,
          onMouseDown: (e) => {
            // Close only when the overlay itself (not the dialog) is clicked.
            if (e.target === e.currentTarget) onClose();
          },
        },
        react.createElement(
          'div',
          { style: KANBAN_MODAL_STYLE },
          react.createElement(
            'div',
            { style: { ...KANBAN_HEADER_STYLE, padding: '12px 16px' } },
            react.createElement('strong', { style: { fontSize: 13 } }, t('kanbanTitle')),
            react.createElement(
              'button',
              {
                type: 'button',
                onClick: onClose,
                style: {
                  font: 'inherit',
                  fontSize: 12,
                  cursor: 'pointer',
                  color: 'var(--dsw-alias-label-secondary)',
                  background: 'transparent',
                  border: '1px solid var(--dsw-alias-border-l2)',
                  borderRadius: 6,
                  padding: '2px 10px',
                },
              },
              '✕ ' + t('collapseBoard'),
            ),
          ),
          react.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                padding: '10px 16px',
                borderBottom: '1px solid var(--dsw-alias-border-l2)',
              },
            },
            react.createElement('input', {
              type: 'search',
              placeholder: t('searchPlaceholder'),
              value: query,
              onChange: (e) => setQuery(e.target.value),
              style: {
                flex: 1,
                minWidth: 180,
                height: 30,
                padding: '0 10px',
                fontSize: 12,
                color: 'var(--dsw-alias-label-primary)',
                background: 'var(--dsw-alias-bg-layer-1)',
                border: '1px solid var(--dsw-alias-border-l2)',
                borderRadius: 8,
                font: 'inherit',
              },
            }),
            filterChip('all', t('filterAll')),
            filterChip('feat', t('filterFeat')),
            filterChip('issue', t('filterIssue')),
            filterChip('refactor', t('filterRefactor')),
          ),
          react.createElement(
            'div',
            {
              style: {
                flex: 1,
                minHeight: 0,
                overflow: 'auto',
                padding: 12,
                display: 'flex',
                gap: 16,
                alignItems: 'flex-start',
              },
            },
            react.createElement(
              'div',
              { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 } },
              workTypes.map((wt) => {
                const trackDef = tracks && tracks[wt];
                const stages = trackDef ? trackDef.stages : [];
                return react.createElement(
                  'div',
                  { key: wt },
                  react.createElement(
                    'div',
                    {
                      style: {
                        fontSize: 11,
                        fontWeight: 700,
                        color: workTypeColor(wt),
                        letterSpacing: 0.4,
                        marginBottom: 6,
                      },
                    },
                    taskTypeLabel(wt, t),
                  ),
                  react.createElement(
                    'div',
                    { style: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 } },
                    stages.map((stage) => {
                      const items = laneItems(wt, stage);
                      return react.createElement(
                        'div',
                        {
                          key: stage,
                          style: {
                            flex: 'none',
                            width: 180,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            background: 'var(--dsw-alias-bg-layer-1)',
                            border: '1px solid var(--dsw-alias-border-l2)',
                            borderRadius: 8,
                            padding: 8,
                            minHeight: 60,
                          },
                        },
                        react.createElement(
                          'div',
                          {
                            style: {
                              fontSize: 10.5,
                              fontWeight: 700,
                              color: 'var(--dsw-alias-label-secondary)',
                              letterSpacing: 0.3,
                            },
                          },
                          stage + ' (' + items.length + ')',
                        ),
                        items.length === 0
                          ? react.createElement(
                              'div',
                              { style: { fontSize: 10, color: 'var(--dsw-alias-label-tertiary)', padding: '2px 0' } },
                              t('empty'),
                            )
                          : items.map((task) =>
                              react.createElement(KanbanLaneCard, {
                                key: task.slug,
                                task,
                                t,
                                selected: selected === task.slug,
                                active: activeSlug === task.slug,
                                onSelect,
                              }),
                            ),
                      );
                    }),
                    // Archive lane: completed / archived tasks of this type.
                    react.createElement(
                      'div',
                      {
                        style: {
                          flex: 'none',
                          width: 180,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          background: 'var(--dsw-alias-bg-layer-1)',
                          border: '1px dashed var(--dsw-alias-border-l2)',
                          borderRadius: 8,
                          padding: 8,
                          minHeight: 60,
                        },
                      },
                      react.createElement(
                        'div',
                        {
                          style: {
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: 'var(--dsw-alias-label-tertiary)',
                            letterSpacing: 0.3,
                          },
                        },
                        t('colArchive') + ' (' + archivedItems.filter((task) => task.workType === wt).length + ')',
                      ),
                      archivedItems
                        .filter((task) => task.workType === wt)
                        .map((task) =>
                          react.createElement(KanbanLaneCard, {
                            key: task.slug,
                            task,
                            t,
                            selected: selected === task.slug,
                            active: false,
                            onSelect,
                          }),
                        ),
                    ),
                  ),
                );
              }),
            ),
            react.createElement(KanbanDetails, {
              task: selectedTask,
              t,
              active: !!(selectedTask && selectedTask.slug === activeSlug),
              busy,
              onActivate: () => onActivate(selectedTask.slug),
              onDeactivate,
              tracks: board.tracks,
            }),
          ),
        ),
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
      // Lightweight type filter shared by the compact list and expanded modal.
      const [filter, setFilter] = react.useState('all');
      // Expanded full-board modal visibility (Subtask 3 renders KanbanExpandedModal).
      const [expandedBoard, setExpandedBoard] = react.useState(false);
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

      // closeExpanded MUST be declared before any conditional return — React
      // hooks rules require the same number of hooks on every render.
      const closeExpanded = react.useCallback(() => setExpandedBoard(false), []);

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
            // While the expanded modal is open the chip toggles IT instead of
            // the popover, so the two surfaces never stack.
            if (expandedBoard) {
              setExpandedBoard(false);
              return;
            }
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
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 10 } },
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
                  react.createElement(
                    'button',
                    {
                      type: 'button',
                      onClick: () => {
                        // Expanding always re-fetches (design.md contract) so
                        // the full view never shows stale data; the modal's
                        // null-board guard renders a loading placeholder while
                        // the fetch lands (P1 from code review).
                        setOpen(false);
                        loadBoard();
                        setExpandedBoard(true);
                      },
                      style: {
                        font: 'inherit',
                        fontSize: 11,
                        cursor: 'pointer',
                        color: 'var(--dsw-alias-state-business-primary)',
                        background: 'transparent',
                        border: '1px solid var(--dsw-alias-border-l2)',
                        borderRadius: 6,
                        padding: '2px 8px',
                        whiteSpace: 'nowrap',
                      },
                    },
                    t('expandBoard'),
                  ),
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
                      filter,
                      onFilterChange: setFilter,
                    }),
            )
          : null;

      const expandedModal = expandedBoard
        ? react.createElement(KanbanExpandedModal, {
            board,
            t,
            selected,
            onSelect: setSelected,
            busy,
            onActivate: bind,
            onDeactivate: () => bind(null),
            filter,
            onFilterChange: setFilter,
            onClose: closeExpanded,
          })
        : null;

      return react.createElement(
        'div',
        {
          ref: rootRef,
          style: { position: 'relative', display: 'inline-flex', alignItems: 'center' },
        },
        chip,
        popover,
        expandedModal,
      );
    }

    /**
     * Blank-session (hero) seat for the task chip. The session header that
     * hosts `conversation.session.header.utilities` hides its whole chrome
     * while the session is blank (a brand-new conversation, before the first
     * message), which made the chip — and with it the kanban activate flow —
     * unreachable exactly when a new conversation needs to pick its task.
     * This entry renders the SAME chip on `conversation.input.dock` (the row
     * above the composer card, rendered in the hero phase too), but ONLY
     * while that header seat is hidden (`session.blank === true`, the same
     * predicate the header uses to hide itself: for a blank session
     * activeTargets is empty, running is false, and promptAttempted is false,
     * so conversationPhase always returns "blank"), so the two seats are
     * mutually exclusive and the chip never duplicates.
     */
    function HeroTaskChip(props) {
      const { session, sessionId, t } = props;
      // The header hides itself when `session.blank && conversationPhase(session, conversation) === "blank"`.
      // `conversation.input.dock` owner props (InputZone) expose `session: SessionSnapshot` without
      // `conversation`, so `conversationPhase` is not computable here.  For a brand-new blank session,
      // `session.blank === true` is equivalent — activeTargets is empty, running is false, and
      // promptAttempted is false, so conversationPhase always returns "blank".
      const headerHidden = !!(
        session &&
        session.blank === true
      );
      if (!headerHidden) return null;
      return react.createElement(
        'div',
        {
          style: {
            position: 'relative',
            display: 'inline-flex',
            alignItems: 'center',
            alignSelf: 'flex-end',
          },
        },
        react.createElement(TaskChip, { sessionId, t }),
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
      // Blank-session (hero) seat: the session header hides its chrome — and
      // with it the utilities seat above — while the session is blank (a new
      // conversation before the first message), so the same chip also takes a
      // seat on the input dock row, which renders in the hero phase too.
      // HeroTaskChip renders only while the header seat is hidden, so the
      // chip is always visible exactly once and the kanban activate flow
      // stays reachable from a brand-new conversation.
      ctx.slots.inject('conversation.input.dock', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.dock',
            id: 'trellis-workflow:task-chip-hero',
            order: 20,
            locale: LOCALE_NS,
          },
          HeroTaskChip,
        ),
      );
    }
    // #endregion

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});

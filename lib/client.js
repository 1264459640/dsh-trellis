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
        '开启后，命中白名单的项目里：新对话（未建任务）只裁剪 write/edit 与任务写工具（trellis_task_update / trellis_artifact_update / trellis_task_archive / trellis_ui_update），其余工具（含其他插件的工具）保留；规划中的任务只裁剪 write/edit 与创建/跳过/归档类 trellis 工具，其余工具保留；经 trellis_task_skip 跳过任务的会话恢复完整工具。',
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
      metaArtifacts: '产物交付',
      noArtifacts: '暂无产物',
      activate: '设为当前会话激活',
      deactivate: '取消当前激活',
      archivedReadonly: '已归档任务（只读）',
      busy: '处理中…',
      otherMonth: '其他',
      noTasks: '暂无任务',
      boardLoading: '看板加载中…',
      boardFailed: '看板加载失败，点击重试',
      expandBoard: '展开大看板',
      collapseBoard: '收起大看板',
      filterAll: '全部',
      filterFeat: '功能',
      filterIssue: '缺陷',
      filterRefactor: '重构',
      searchPlaceholder: '搜索标题或 slug…',
      sendToChat: '推进任务',
      sendToChatSuccess: '已填入输入框，回车即可发送',
      sendToChatFailed: '自动填入失败，已复制到剪贴板',
      pendingVerification: '待验证',
      blocked: '阻塞',
      open: '打开',
      pipelineTitle: '阶段流水线',
      stepsTitle: '执行步骤清单',
      stepsUnit: '步骤',
      noSteps: '暂无执行步骤',
      stepCompleted: '已完成',
      stepInProgress: '进行中',
      stepPending: '未开始',
      viewLanes: '工作台',
      viewList: '列表',
      closeLabel: '关闭',
      previewLoading: '读取中…',
      previewFailed: '无法读取该产物',
      boardHint: '仅展示与推进，不直接改状态',
      selectTaskPrompt: '选择任务查看详情',
      selectTaskHint: '在左侧点击任务以查看产物与操作',
      noTasksInType: '暂无任务',
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
        'When enabled, in allowlisted projects: a fresh conversation (no task yet) trims only write/edit and task-write trellis tools (trellis_task_update / trellis_artifact_update / trellis_task_archive / trellis_ui_update), keeping all other tools (including other plugins\'); a task in the planning phase trims only write/edit and create/skip/archive trellis tools, keeping all other tools; a session that skipped the task via trellis_task_skip regains the full tool surface.',
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
      metaArtifacts: 'Artifacts Delivery',
      noArtifacts: 'No artifacts',
      activate: 'Set active for this session',
      deactivate: 'Clear active for this session',
      archivedReadonly: 'Archived task (read-only)',
      busy: 'Working…',
      otherMonth: 'Other',
      noTasks: 'No tasks',
      boardLoading: 'Loading board…',
      boardFailed: 'Board load failed — click to retry',
      expandBoard: 'Expand board',
      collapseBoard: 'Collapse board',
      filterAll: 'All',
      filterFeat: 'Feature',
      filterIssue: 'Issue',
      filterRefactor: 'Refactor',
      searchPlaceholder: 'Search title or slug…',
      sendToChat: 'Push to chat',
      sendToChatSuccess: 'Filled into the input — press Enter to send',
      sendToChatFailed: 'Auto-fill failed, copied to clipboard',
      pendingVerification: 'Verifying',
      blocked: 'Blocked',
      open: 'Open',
      pipelineTitle: 'Stage pipeline',
      stepsTitle: 'Execution Steps',
      stepsUnit: 'steps',
      noSteps: 'No execution steps',
      stepCompleted: 'Completed',
      stepInProgress: 'In Progress',
      stepPending: 'Pending',
      viewLanes: 'Board',
      viewList: 'List',
      closeLabel: 'Close',
      previewLoading: 'Reading…',
      previewFailed: 'Could not read this artifact',
      boardHint: 'View & push only — no direct state changes',
      selectTaskPrompt: 'Select a task',
      selectTaskHint: 'Click a task on the left to view details',
      noTasksInType: 'No tasks',
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
        background: TB.color.surfaceMuted,
        border: '1px solid ' + TB.color.borderStrong,
        borderRadius: 8,
        font: 'inherit',
      };
      const btnStyle = {
        height: 32,
        padding: '0 12px',
        fontSize: 13,
        font: 'inherit',
        color: 'var(--dsw-alias-label-primary)',
        background: TB.color.surface,
        border: '1px solid var(--dsw-alias-border-l2)',
        borderRadius: 8,
        cursor: 'pointer',
      };
      const labelStyle = { fontSize: 13, fontWeight: 600, margin: '14px 0 6px', color: 'var(--dsw-alias-label-primary)' };

      return react.createElement(
        'div',
        { style: { width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 4 } },
        react.createElement('p', { style: { margin: 0, color: TB.color.textSecondary, fontSize: 13 } }, t('allowlistHint')),
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
      return 'var(--dsw-alias-label-tertiary)'; // planning = gray
    }

    function chipTypeLabel(summary, t) {
      const key = summary.workType && summary.workType[0].toUpperCase() + summary.workType.slice(1);
      const localized = key && t('workType' + key);
      const type = localized && localized !== 'workType' + key ? localized : summary.workType || '';
      return [type, summary.stage].filter(Boolean).join(' · ');
    }

    function ensureAnimationStyles() {
      if (typeof document === 'undefined') return;
      const id = 'trellis-anim-styles';
      if (document.getElementById(id)) return;
      try {
        const style = document.createElement('style');
        style.id = id;
        style.textContent = '@keyframes trellis-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
      } catch {}
    }

    function stageDisplayName(stg) {
      if (!stg) return '';
      const map = {
        prd: '需求',
        design: '方案',
        'design-review': '评审',
        impl: '实现',
        review: '审查',
        check: '验收',
        finish: '交付',
        report: '报告',
        analyze: '分析',
        fix: '修复',
        'fix-note': '备忘',
        scan: '扫描',
        apply: '实施',
        done: '完成',
      };
      return map[stg] || stg;
    }

    function artifactMeta(name) {
      const lower = (name || '').toLowerCase();
      if (lower.endsWith('prd.md')) {
        return { title: '产品需求说明书 (PRD)', tag: 'PRD', desc: '需求规格与功能范围' };
      }
      if (lower.endsWith('design.md')) {
        return { title: '系统架构设计方案', tag: 'Design', desc: '架构演进与技术契约' };
      }
      if (lower.endsWith('design-review.md')) {
        return { title: '设计评审记录', tag: 'Review', desc: '设计决策与评审要点' };
      }
      if (lower.endsWith('implement.md')) {
        return { title: '实现备忘与执行清单', tag: 'Plan', desc: '代码改动与落地方案' };
      }
      if (lower.endsWith('review.md')) {
        return { title: '代码评审报告', tag: 'Review', desc: '改动审查与回归清单' };
      }
      if (lower.endsWith('check.md')) {
        return { title: '质量验收与校验报告', tag: 'Check', desc: '验收测试与验证记录' };
      }
      if (lower.endsWith('report.md')) {
        return { title: '缺陷诊断报告', tag: 'Report', desc: '异常复现与现象排查' };
      }
      if (lower.endsWith('analysis.md')) {
        return { title: '根因分析与方案', tag: 'Analysis', desc: '根因剖析与修复设计' };
      }
      if (lower.endsWith('fix-note.md')) {
        return { title: '修复备忘录', tag: 'Fix', desc: '修复要点与代码备忘' };
      }
      if (lower.endsWith('scan.md')) {
        return { title: '代码坏味道扫描', tag: 'Scan', desc: '重构扫描与坏味道清单' };
      }
      if (lower.endsWith('refactor-design.md')) {
        return { title: '重构架构方案', tag: 'Design', desc: '重构设计与方案' };
      }
      if (lower.endsWith('apply-notes.md')) {
        return { title: '重构落地记录', tag: 'Apply', desc: '重构验证与总结' };
      }
      if (lower.endsWith('checklist.yaml') || lower.endsWith('checklist.yml')) {
        return { title: '执行检查清单', tag: 'Checklist', desc: '结构化核验规则' };
      }
      if (lower.endsWith('task.json')) {
        return { title: '任务元数据定义', tag: 'Meta', desc: '任务状态与执行步骤' };
      }
      const parts = String(name || '').split('.');
      const ext = parts.length > 1 ? parts.pop().toUpperCase() : 'DOC';
      return { title: name, tag: ext, desc: '项目交付成果' };
    }

    function formatStepTitle(st, idx) {
      const raw = (st && st.title) ? String(st.title).trim() : '';
      if (!raw) return '步骤 ' + (idx + 1);
      if (/^(步骤|step)\s*\d+/i.test(raw)) return raw;
      return '步骤 ' + (idx + 1) + '：' + raw;
    }

    function formatStepDesc(st, isInProgress, isDone) {
      if (st.blockedReason) {
        return { text: '⚠️ ' + st.blockedReason, isDanger: true };
      }
      if (Array.isArray(st.acceptance) && st.acceptance.length > 0) {
        return { text: st.acceptance.join(' · '), isNormal: true };
      }
      if (typeof st.spec === 'string' && st.spec.trim()) {
        return { text: st.spec.trim(), isNormal: true };
      }
      if (isInProgress) {
        return { text: '正在执行该步骤交付任务…', isBrand: true };
      }
      if (isDone) {
        return { text: '已达成验收基准', isNormal: true };
      }
      return null;
    }

    function renderIcon(name, props) {
      const p = props || {};
      const size = p.size || 14;
      const s = {
        width: size,
        height: size,
        flex: 'none',
        verticalAlign: 'middle',
        stroke: p.color || 'currentColor',
        display: 'inline-block',
        ...(p.style || {}),
      };
      const baseProps = {
        xmlns: 'http://www.w3.org/2000/svg',
        viewBox: '0 0 24 24',
        fill: 'none',
        strokeWidth: p.strokeWidth || 1.75, // 默认 1.75px，比生硬的 2px 更加纤细高级
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        style: s,
        'aria-hidden': 'true',
      };
      switch (name) {
        case 'sparkles':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'm12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z' }),
            react.createElement('path', { d: 'M5 3v4' }),
            react.createElement('path', { d: 'M19 17v4' }),
            react.createElement('path', { d: 'M3 5h4' }),
            react.createElement('path', { d: 'M17 19h4' }),
          );
        case 'circleDashed':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M10.1 2.182a10 10 0 0 1 3.8 0' }),
            react.createElement('path', { d: 'M13.9 21.818a10 10 0 0 1-3.8 0' }),
            react.createElement('path', { d: 'M17.609 3.721a10 10 0 0 1 2.69 2.7' }),
            react.createElement('path', { d: 'M2.182 13.9a10 10 0 0 1 0-3.8' }),
            react.createElement('path', { d: 'M20.279 17.609a10 10 0 0 1-2.7 2.69' }),
            react.createElement('path', { d: 'M21.818 10.1a10 10 0 0 1 0 3.8' }),
            react.createElement('path', { d: 'M3.721 6.391a10 10 0 0 1 2.7-2.69' }),
            react.createElement('path', { d: 'M6.391 20.279a10 10 0 0 1-2.69-2.7' }),
          );
        case 'history':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
            react.createElement('path', { d: 'M3 3v5h5' }),
            react.createElement('polyline', { points: '12 7 12 12 15 15' }),
          );
        case 'spinner':
        case 'loader':
          ensureAnimationStyles();
          return react.createElement(
            'svg',
            {
              ...baseProps,
              style: {
                ...s,
                animation: 'trellis-spin 0.85s linear infinite',
              },
            },
            react.createElement('path', { d: 'M21 12a9 9 0 1 1-6.219-8.56' }),
          );
        case 'refresh':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }),
            react.createElement('path', { d: 'M3 3v5h5' }),
            react.createElement('path', { d: 'M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16' }),
            react.createElement('path', { d: 'M16 16h5v5' }),
          );
        case 'maximize':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '15 3 21 3 21 9' }),
            react.createElement('polyline', { points: '9 21 3 21 3 15' }),
            react.createElement('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
            react.createElement('line', { x1: '3', y1: '21', x2: '10', y2: '14' }),
          );
        case 'minimize':
        case 'collapse':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '4 14 10 14 10 20' }),
            react.createElement('polyline', { points: '20 10 14 10 14 4' }),
            react.createElement('line', { x1: '14', y1: '10', x2: '21', y2: '3' }),
            react.createElement('line', { x1: '3', y1: '21', x2: '10', y2: '14' }),
          );
        case 'close':
        case 'x':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('line', { x1: '18', y1: '6', x2: '6', y2: '18' }),
            react.createElement('line', { x1: '6', y1: '6', x2: '18', y2: '18' }),
          );
        case 'search':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('circle', { cx: '11', cy: '11', r: '8' }),
            react.createElement('line', { x1: '21', y1: '21', x2: '16.65', y2: '16.65' }),
          );
        case 'fileText':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
            react.createElement('polyline', { points: '14 2 14 8 20 8' }),
            react.createElement('line', { x1: '16', y1: '13', x2: '8', y2: '13' }),
            react.createElement('line', { x1: '16', y1: '17', x2: '8', y2: '17' }),
          );
        case 'fileCode':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }),
            react.createElement('polyline', { points: '14 2 14 8 20 8' }),
            react.createElement('path', { d: 'm10 13-2 2 2 2' }),
            react.createElement('path', { d: 'm14 17 2-2-2-2' }),
          );
        case 'externalLink':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' }),
            react.createElement('polyline', { points: '15 3 21 3 21 9' }),
            react.createElement('line', { x1: '10', y1: '14', x2: '21', y2: '3' }),
          );
        case 'folder':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z' }),
          );
        case 'chevronRight':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '9 18 15 12 9 6' }),
          );
        case 'chevronDown':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '6 9 12 15 18 9' }),
          );
        case 'play':
        case 'send':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polygon', { points: '6 4 20 12 6 20 6 4', fill: p.color || 'currentColor' }),
          );
        case 'check':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '20 6 9 17 4 12' }),
          );
        case 'checkCircle':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M22 11.08V12a10 10 0 1 1-5.93-9.14' }),
            react.createElement('polyline', { points: '22 4 12 14.01 9 11.01' }),
          );
        case 'checkSquare':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '9 11 12 14 22 4' }),
            react.createElement('path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' }),
          );
        case 'alertTriangle':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z' }),
            react.createElement('line', { x1: '12', y1: '9', x2: '12', y2: '13' }),
            react.createElement('line', { x1: '12', y1: '17', x2: '12.01', y2: '17' }),
          );
        case 'clock':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('circle', { cx: '12', cy: '12', r: '10' }),
            react.createElement('polyline', { points: '12 6 12 12 16 14' }),
          );
        default:
          return null;
      }
    }

    // #region lib/types/client/trellis-kanban.js

    var TB = {
      color: {
        surface: 'var(--dsw-alias-bg-layer-0, #FFFFFF)',
        surfaceMuted: 'var(--dsw-alias-bg-layer-1, #F8FAFC)',
        surfaceHover: 'var(--dsw-alias-bg-layer-2, #F1F5F9)',
        surfaceActive: 'var(--dsw-alias-bg-layer-3, #E2E8F0)',
        text: 'var(--dsw-alias-label-primary, #0F172A)',
        textSecondary: 'var(--dsw-alias-label-secondary, #475569)',
        textMuted: 'var(--dsw-alias-label-tertiary, #94A3B8)',
        border: 'var(--dsw-alias-border-l1, #E2E8F0)',
        borderStrong: 'var(--dsw-alias-border-l2, #CBD5E1)',
        brand: 'var(--dsw-alias-state-business-primary, #2563EB)',
        brandHover: '#1D4ED8',
        success: 'var(--dsw-alias-state-success-primary, #10B981)',
        warn: 'var(--dsw-alias-state-warn-primary, #F59E0B)',
        danger: 'var(--dsw-alias-state-error-primary, #EF4444)',
        ink: '#1E293B', // 高级深岩色 Slate-800，彻底告别死板纯黑
        inkHover: '#0F172A',
      },
      tint: {
        brand: 'rgba(37, 99, 235, 0.08)',
        brandDeep: 'rgba(37, 99, 235, 0.12)',
        brandLight: 'rgba(37, 99, 235, 0.04)',
        success: 'rgba(16, 185, 129, 0.08)',
        warn: 'rgba(245, 158, 11, 0.08)',
        danger: 'rgba(239, 68, 68, 0.08)',
        neutral: 'rgba(100, 116, 139, 0.08)',
      },
      R: {
        window: '20px',
        popover: '24px',
        modal: '20px',
        lane: '12px',
        card: '10px',
        ctrl: '8px',
        badge: '4px',
        pill: '9999px',
      },
      S: {
        modal: '0 24px 60px -12px rgba(15, 23, 42, 0.28), 0 0 1px rgba(15, 23, 42, 0.1)',
        popover: '0 20px 48px -10px rgba(15, 23, 42, 0.24), 0 0 1px rgba(15, 23, 42, 0.1)',
        card: '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        hover: '0 6px 16px -2px rgba(15, 23, 42, 0.08), 0 2px 4px -1px rgba(15, 23, 42, 0.04)',
        glow: '0 0 0 2px rgba(37, 99, 235, 0.2), 0 2px 8px rgba(37, 99, 235, 0.08)',
      },
      font: {
        base: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", sans-serif',
        mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
      },
    };

    function phaseDotColor(phase) {
      if (phase === 'in_progress' || phase === 'in_progress-inline') return TB.color.brand;
      if (phase === 'completed') return TB.color.success;
      return TB.color.textMuted;
    }
    function statusDotColor(task) {
      if (task.hasBlocked === true) return TB.color.danger;
      if (task.hasPendingVerification === true) return TB.color.warn;
      return phaseDotColor(task.phase);
    }
    function typePillBg(wt) {
      if (wt === 'feat') return TB.tint.brand;
      if (wt === 'issue') return TB.tint.danger;
      if (wt === 'refactor') return TB.tint.success;
      return TB.tint.neutral;
    }

    const KANBAN_POPOVER_STYLE = {
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      zIndex: 1000,
      width: 580,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'min(620px, calc(100vh - 60px))',
      display: 'flex',
      flexDirection: 'column',
      background: TB.color.surface,
      border: '1px solid ' + TB.color.borderStrong,
      borderRadius: TB.R.popover,
      boxShadow: TB.S.popover,
      textAlign: 'left',
      overflow: 'hidden',
    };

    const KANBAN_HEADER_STYLE = {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '16px 24px',
      borderBottom: '1px solid ' + TB.color.border,
      background: TB.color.surface,
      flex: 'none',
    };

    const KANBAN_BODY_STYLE = {
      display: 'flex',
      flexDirection: 'column',
      padding: '12px 20px 20px 20px',
      overflowY: 'auto',
      flex: 1,
      minHeight: 360,
      background: TB.color.surface,
    };

    const KANBAN_LEFT_STYLE = { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 };

    const KANBAN_RIGHT_STYLE = {
      flex: 'none',
      width: 350,
      minWidth: 280,
      background: TB.color.surface,
      borderLeft: '1px solid ' + TB.color.border,
      padding: '20px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      overflowY: 'auto',
    };

    const ACTION_BUTTON_STYLE = {
      display: 'block',
      width: '100%',
      marginTop: 10,
      padding: '9px 10px',
      font: 'inherit',
      fontSize: 13,
      fontWeight: 500,
      borderRadius: TB.R.ctrl,
      cursor: 'pointer',
      background: TB.color.ink,
      color: '#ffffff',
      border: 'none',
    };

    const KANBAN_MODAL_OVERLAY_STYLE = {
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(18,19,22,0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    };

    const KANBAN_MODAL_STYLE = {
      width: 'min(1450px, calc(100vw - 64px))',
      height: 'min(92vh, 960px)',
      maxHeight: '92vh',
      display: 'flex',
      flexDirection: 'column',
      background: TB.color.surface,
      borderRadius: TB.R.modal,
      boxShadow: TB.S.modal,
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
      if (workType === 'feat') return TB.color.brand
      if (workType === 'issue') return TB.color.danger
      if (workType === 'refactor') return TB.color.success
      return TB.color.textMuted
    }

    /**
     * Compact high-density task row item for the popover list view.
     * Full title visibility, work-type accent bar, mono slug and pill badges.
     */
    function KanbanTaskItem(props) {
      const { task, t, selected, active, onSelect } = props;
      const dot = statusDotColor(task);
      const tint = typePillBg(task.workType);
      const wtLabel = taskTypeLabel(task.workType, t);
      return react.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSelect(task.slug),
          title: task.title + ' (' + task.slug + ')',
          style: {
            position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', textAlign: 'left', font: 'inherit',
            padding: '10px 14px', margin: '1px 0', borderRadius: TB.R.card, cursor: 'pointer',
            background: selected ? TB.tint.brandDeep : 'transparent',
            border: selected ? '1.5px solid ' + TB.color.brand : '1.5px solid transparent',
            borderBottom: selected ? undefined : '1px solid ' + TB.color.border,
            boxShadow: selected ? TB.S.glow : 'none',
            transition: 'background 0.12s ease',
          },
        },
        selected ? react.createElement('span', { style: { position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3.5, borderRadius: TB.R.pill, background: TB.color.brand, flex: 'none' } }) : null,
        react.createElement('span', { style: { width: 7, height: 7, borderRadius: '50%', background: dot, flex: 'none' } }),
        react.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: selected ? 600 : 500, lineHeight: '18px', color: TB.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, task.title),
        wtLabel ? react.createElement('span', { style: { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: TB.R.badge, color: workTypeColor(task.workType), background: tint, border: '1px solid ' + TB.color.border, whiteSpace: 'nowrap', flex: 'none' } }, wtLabel) : null,
        react.createElement('span', { style: { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: TB.R.badge, color: TB.color.textSecondary, background: TB.color.surfaceHover, border: '1px solid ' + TB.color.border, whiteSpace: 'nowrap', flex: 'none' } }, task.stage || '—'),
        active ? react.createElement('span', { title: '当前会话激活', style: { width: 8, height: 8, borderRadius: '50%', background: TB.color.brand, flex: 'none' } }) : react.createElement('span', { style: { width: 8, flex: 'none' } }),
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
                  color: TB.color.textSecondary,
                  background: 'transparent',
                  border: 'none',
                  padding: '4px 2px',
                  cursor: 'pointer',
                  width: '100%',
                  textAlign: 'left',
                },
              },
              renderIcon(open ? 'chevronDown' : 'chevronRight', { size: 11, color: TB.color.textMuted }),
              renderIcon('folder', { size: 12, color: TB.color.warn }),
              react.createElement('span', {}, monthLabel + ' (' + groups[key].length + ')'),
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
                          selected === task.slug ? TB.color.surfaceHover : 'transparent',
                        border:
                          selected === task.slug
                            ? '1px solid var(--dsw-alias-state-business-primary)'
                            : 'none',
                        color: TB.color.textSecondary,
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
          {
            style: {
              ...KANBAN_RIGHT_STYLE,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              padding: '32px 16px',
              minHeight: 220,
            },
          },
          renderIcon('fileText', { size: 32, color: TB.color.borderStrong }),
          react.createElement(
            'div',
            {
              style: {
                marginTop: 12,
                fontSize: 13,
                fontWeight: 600,
                color: TB.color.textSecondary,
              },
            },
            t('selectTaskPrompt'),
          ),
          react.createElement(
            'div',
            {
              style: {
                marginTop: 4,
                fontSize: 11.5,
                color: TB.color.textMuted,
                lineHeight: '16px',
              },
            },
            t('selectTaskHint'),
          ),
        );
      }
      const trackDef = (task.workType && tracks && tracks[task.workType]) || null;
      const track = trackDef ? trackDef.stages : null;
      const currentIndex = track ? track.indexOf(task.stage) : -1;
      const archived = task.archived === true || task.status === 'completed';
      const wtColor = workTypeColor(task.workType);
      const wtLabel = taskTypeLabel(task.workType, t);
      const tint = typePillBg(task.workType);
      const totalSteps = task.totalSteps || 0;
      const completedSteps = task.completedSteps || 0;
      const pct = totalSteps > 0 ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 0;

      // 阶段流水线 (精美轻质 Stepper with 精致微节点与贯通中轴)
      const stageFlow = track && track.length > 0
        ? react.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
                padding: '10px 8px 6px',
                background: TB.color.surfaceMuted,
                border: '1px solid ' + TB.color.border,
                borderRadius: TB.R.ctrl,
                marginTop: 8,
              },
            },
            // 上层：节点和贯穿中轴的背景连线
            react.createElement(
              'div',
              {
                style: {
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: '100%',
                  height: 20,
                },
              },
              // 底层绝对定位贯通线
              react.createElement('div', {
                style: {
                  position: 'absolute',
                  left: (100 / (track.length * 2)) + '%',
                  right: (100 / (track.length * 2)) + '%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: 1.5,
                  background: TB.color.borderStrong,
                  zIndex: 0,
                },
              }),
              // 进度绿色线（贯穿从第一个节点到当前激活节点中心）
              (() => {
                const isCompletedTask = archived || task.status === 'completed';
                const targetIndex = isCompletedTask
                  ? track.length - 1
                  : Math.max(0, currentIndex);
                return targetIndex > 0
                  ? react.createElement('div', {
                      style: {
                        position: 'absolute',
                        left: (100 / (track.length * 2)) + '%',
                        width: ((targetIndex * 100) / track.length) + '%',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        height: 1.5,
                        background: TB.color.brand,
                        transition: 'width 0.25s ease',
                        zIndex: 1,
                      },
                    })
                  : null;
              })(),
              // 上层节点
              track.map((stg, i) => {
                const isCompletedTask = archived || task.status === 'completed';
                const isCurrent = !isCompletedTask && i === currentIndex;
                const done = isCompletedTask || (currentIndex >= 0 && i < currentIndex);
                return react.createElement(
                  'div',
                  {
                    key: stg,
                    style: {
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    },
                  },
                  react.createElement(
                    'div',
                    {
                      style: {
                        width: isCurrent ? 18 : 15,
                        height: isCurrent ? 18 : 15,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                        boxSizing: 'border-box',
                        background: isCurrent ? TB.color.brand : done ? TB.color.brand : '#FFFFFF',
                        color: isCurrent || done ? '#FFFFFF' : TB.color.textMuted,
                        border: isCurrent
                          ? '2px solid #FFFFFF'
                          : done
                            ? '1.5px solid ' + TB.color.brand
                            : '1.5px solid ' + TB.color.borderStrong,
                        boxShadow: isCurrent
                          ? '0 0 0 3px rgba(37, 99, 235, 0.25), ' + TB.S.card
                          : done
                            ? '0 1px 2px rgba(37, 99, 235, 0.15)'
                            : 'none',
                        transition: 'all 0.2s ease',
                      },
                    },
                    done
                      ? renderIcon('check', { size: 9, color: '#FFFFFF', strokeWidth: 2.5 })
                      : isCurrent
                        ? react.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: '#FFFFFF' } })
                        : react.createElement(
                            'span',
                            { style: { fontSize: 8.5, fontWeight: 600, fontFamily: TB.font.mono } },
                            i + 1,
                          ),
                  ),
                );
              }),
            ),
            // 下层：阶段名称文本，与节点严格均分列对齐
            react.createElement(
              'div',
              {
                style: {
                  display: 'flex',
                  width: '100%',
                  marginTop: 6,
                },
              },
              track.map((stg, i) => {
                const isCurrent = i === currentIndex;
                const dName = stageDisplayName(stg);
                return react.createElement(
                  'span',
                  {
                    key: stg,
                    title: dName + ' (' + stg + ')',
                    style: {
                      flex: 1,
                      fontSize: 10,
                      fontWeight: isCurrent ? 600 : 500,
                      color: isCurrent ? TB.color.brand : TB.color.textSecondary,
                      textAlign: 'center',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      padding: '0 1px',
                      letterSpacing: '-0.2px',
                    },
                  },
                  dName,
                );
              }),
            ),
          )
        : null;

      const artifacts = Array.isArray(task.artifacts)
        ? task.artifacts.filter((n) => /\.(md|yaml|ya?ml|json)$/.test(n || '')).slice(0, 8)
        : [];

      // 操作按钮组（精致分体设计，不横向粗暴堆叠）
      const actionButton = archived
        ? react.createElement(
            'div',
            {
              style: {
                flex: 1,
                padding: '7px 10px',
                fontSize: 11.5,
                fontWeight: 500,
                color: TB.color.textMuted,
                background: TB.color.surfaceHover,
                border: '1px solid ' + TB.color.border,
                borderRadius: TB.R.ctrl,
                textAlign: 'center',
                userSelect: 'none',
              },
            },
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
                  flex: '0 0 auto',
                  padding: '7px 12px',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: TB.R.ctrl,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  background: TB.color.surface,
                  color: TB.color.danger,
                  border: '1px solid ' + TB.color.borderStrong,
                  opacity: busy ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                },
              },
              renderIcon('close', { size: 12 }),
              busy ? t('busy') : t('deactivate'),
            )
          : react.createElement(
              'button',
              {
                type: 'button',
                disabled: busy,
                onClick: onActivate,
                style: {
                  flex: '0 0 auto',
                  padding: '7px 12px',
                  font: 'inherit',
                  fontSize: 12,
                  fontWeight: 500,
                  borderRadius: TB.R.ctrl,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  background: TB.color.surface,
                  color: TB.color.text,
                  border: '1px solid ' + TB.color.borderStrong,
                  opacity: busy ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 5,
                  boxShadow: TB.S.card,
                  transition: 'all 0.15s ease',
                },
              },
              renderIcon('checkSquare', { size: 12, color: TB.color.textSecondary }),
              busy ? t('busy') : t('activate'),
            );

      // 推进任务按钮（高质感主 CTA）
      const pushButton = archived
        ? null
        : react.createElement(
            'button',
            {
              type: 'button',
              onClick: () => push(pushPromptFor(task)),
              style: {
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '7px 14px',
                font: 'inherit',
                fontSize: 12,
                fontWeight: 600,
                borderRadius: TB.R.ctrl,
                cursor: 'pointer',
                background: TB.color.ink,
                color: '#FFFFFF',
                border: '1px solid ' + TB.color.ink,
                boxShadow: '0 1px 3px rgba(15, 23, 42, 0.2)',
                transition: 'all 0.15s ease',
              },
            },
            renderIcon('sparkles', { size: 12, color: '#93C5FD' }),
            t('sendToChat'),
          );

      return react.createElement(
        'div',
        { style: KANBAN_RIGHT_STYLE },
        // 头部元信息区
        react.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          react.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            react.createElement('span', { style: { fontSize: 11, fontWeight: 600, color: TB.color.textMuted } }, t('detailsTitle')),
            wtLabel
              ? react.createElement(
                  'span',
                  {
                    style: {
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: TB.R.badge,
                      color: wtColor,
                      background: tint,
                    },
                  },
                  wtLabel,
                )
              : null,
          ),
          react.createElement(
            'div',
            { style: { fontSize: 15, fontWeight: 600, lineHeight: '21px', color: TB.color.text, marginTop: 2 } },
            task.title,
          ),
          react.createElement(
            'div',
            { style: { fontSize: 11, color: TB.color.textMuted, fontFamily: TB.font.mono } },
            task.slug,
          ),
        ),

        // 主操作按钮栏（紧凑并排，不霸占视界）
        react.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 } },
          react.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8 } },
            pushButton,
            actionButton,
          ),
          notice
            ? react.createElement(
                'div',
                {
                  style: {
                    marginTop: 2,
                    fontSize: 11,
                    fontWeight: 500,
                    color: notice === 'ok' ? TB.color.success : TB.color.warn,
                    textAlign: 'center',
                  },
                },
                notice === 'ok' ? t('sendToChatSuccess') : t('sendToChatFailed'),
              )
            : null,
        ),

        // 阶段流水线
        stageFlow
          ? react.createElement(
              'div',
              { style: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 } },
              react.createElement('span', { style: { fontSize: 12, fontWeight: 600, color: TB.color.text } }, t('pipelineTitle')),
              stageFlow,
            )
          : null,

        // 产物交付（排在步骤清单上方，符合工作台主次层级）
        react.createElement(
          'div',
          { style: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 } },
          react.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
            react.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 6 } },
              react.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: TB.color.text } }, t('metaArtifacts')),
              artifacts.length > 0
                ? react.createElement(
                    'span',
                    {
                      style: {
                        fontSize: 10,
                        fontWeight: 600,
                        padding: '1px 6px',
                        borderRadius: TB.R.pill,
                        background: TB.color.surfaceHover,
                        color: TB.color.textMuted,
                      },
                    },
                    artifacts.length,
                  )
                : null,
            ),
          ),
          artifacts.length === 0
            ? react.createElement('div', { style: { fontSize: 11.5, color: TB.color.textMuted, padding: '6px 0' } }, t('noArtifacts'))
            : react.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 2 } },
                artifacts.map((name) => {
                  const meta = artifactMeta(name);
                  const isCode = /\.(ya?ml|json)$/i.test(name);

                  return react.createElement(
                    'div',
                    {
                      key: name,
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        background: '#FFFFFF',
                        border: '1px solid ' + TB.color.border,
                        borderRadius: TB.R.ctrl,
                        gap: 10,
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.03)',
                        transition: 'all 0.15s ease',
                      },
                    },
                    // 左侧大图标容器
                    react.createElement(
                      'div',
                      {
                        style: {
                          width: 32,
                          height: 32,
                          borderRadius: 7,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flex: 'none',
                          background: isCode ? '#F5F3FF' : '#EFF6FF',
                          border: isCode ? '1px solid #DDD6FE' : '1px solid #DBEAFE',
                        },
                      },
                      renderIcon(isCode ? 'fileCode' : 'fileText', {
                        size: 15,
                        color: isCode ? '#7C3AED' : TB.color.brand,
                      }),
                    ),
                    // 中间主信息
                    react.createElement(
                      'div',
                      { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 } },
                      react.createElement(
                        'span',
                        {
                          style: {
                            fontSize: 12,
                            fontWeight: 600,
                            color: TB.color.text,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          },
                          title: meta.title + ' (' + name + ')',
                        },
                        meta.title,
                      ),
                      react.createElement(
                        'div',
                        { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                        react.createElement(
                          'span',
                          {
                            style: {
                              fontSize: 10.5,
                              fontFamily: TB.font.mono,
                              color: TB.color.textMuted,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            },
                          },
                          name,
                        ),
                        meta.tag
                          ? react.createElement(
                              'span',
                              {
                                style: {
                                  fontSize: 9,
                                  fontWeight: 600,
                                  padding: '1px 5px',
                                  borderRadius: 3,
                                  background: TB.color.surfaceHover,
                                  color: TB.color.textSecondary,
                                  fontFamily: TB.font.mono,
                                  flex: 'none',
                                },
                              },
                              meta.tag,
                            )
                          : null,
                      ),
                    ),
                    // 右侧动作按钮
                    react.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: () => push(artifactToken(task, name)),
                        title: t('open') + ' ' + artifactToken(task, name),
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11,
                          fontWeight: 500,
                          color: TB.color.brand,
                          background: 'rgba(37, 99, 235, 0.06)',
                          border: '1px solid rgba(37, 99, 235, 0.15)',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          borderRadius: TB.R.ctrl,
                          flex: 'none',
                          transition: 'all 0.15s ease',
                        },
                      },
                      renderIcon('externalLink', { size: 11, color: TB.color.brand }),
                      t('open'),
                    ),
                  );
                }),
              ),
        ),

        // 执行步骤清单（垂直时间轴）
        react.createElement(
          'div',
          { style: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 6 } },
          react.createElement(
            'div',
            { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
            react.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: TB.color.text } }, t('stepsTitle')),
            totalSteps > 0
              ? react.createElement(
                  'span',
                  { style: { fontSize: 11, color: TB.color.textMuted, fontFamily: TB.font.mono, fontWeight: 500 } },
                  completedSteps + '/' + totalSteps + ' ' + t('stepsUnit') + ' · ' + pct + '%',
                )
              : null,
          ),
          totalSteps > 0
            ? react.createElement(
                'div',
                { style: { height: 4, width: '100%', borderRadius: TB.R.pill, background: TB.color.surfaceHover, overflow: 'hidden' } },
                react.createElement('div', {
                  style: {
                    height: '100%',
                    width: pct + '%',
                    borderRadius: TB.R.pill,
                    background: pct === 100 ? TB.color.success : TB.color.brand,
                    transition: 'width 0.25s ease',
                  },
                }),
              )
            : null,
          Array.isArray(task.steps) && task.steps.length > 0
            ? react.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    flexDirection: 'column',
                    marginTop: 6,
                    paddingRight: 2,
                  },
                },
                task.steps.map((st, idx) => {
                  const isLast = idx === task.steps.length - 1;
                  const isDone = st.status === 'completed';
                  const isInProgress = st.status === 'in_progress';
                  const isVerifying = st.status === 'verifying';
                  const isBlocked = st.status === 'blocked';

                  const lineColor = isDone ? TB.color.success : isInProgress ? TB.color.brand : TB.color.border;

                  const nodeBg = isDone
                    ? TB.color.success
                    : isInProgress
                      ? TB.color.surface
                      : isBlocked
                        ? TB.color.danger
                        : isVerifying
                          ? TB.color.warn
                          : TB.color.surface;

                  const nodeBorder = isDone
                    ? 'none'
                    : isInProgress
                      ? '2px solid ' + TB.color.brand
                      : isBlocked
                        ? 'none'
                        : isVerifying
                          ? 'none'
                          : '1.5px solid ' + TB.color.borderStrong;

                  const nodeGlow = isInProgress
                    ? '0 0 0 3px rgba(37, 99, 235, 0.15)'
                    : 'none';

                  const nodeIcon = isDone
                    ? renderIcon('check', { size: 9, color: '#FFFFFF', strokeWidth: 2.5 })
                    : isInProgress
                      ? react.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: TB.color.brand } })
                      : isBlocked
                        ? renderIcon('alertTriangle', { size: 9, color: '#FFFFFF' })
                        : isVerifying
                          ? renderIcon('clock', { size: 9, color: '#FFFFFF' })
                          : react.createElement('span', { style: { fontSize: 9, fontWeight: 600, fontFamily: TB.font.mono, color: TB.color.textMuted } }, idx + 1);

                  const badgeText = isDone
                    ? t('stepCompleted')
                    : isInProgress
                      ? t('stepInProgress')
                      : isVerifying
                        ? t('pendingVerification')
                        : isBlocked
                          ? t('blocked')
                          : t('stepPending');

                  const badgeColor = isDone
                    ? TB.color.success
                    : isInProgress
                      ? TB.color.brand
                      : isVerifying
                        ? TB.color.warn
                        : isBlocked
                          ? TB.color.danger
                          : TB.color.textSecondary;

                  const badgeBg = isDone
                    ? TB.tint.success
                    : isInProgress
                      ? TB.tint.brand
                      : isVerifying
                        ? TB.tint.warn
                        : isBlocked
                          ? TB.tint.danger
                          : TB.color.surfaceHover;

                  const stepTitleText = formatStepTitle(st, idx);
                  const stepDesc = formatStepDesc(st, isInProgress, isDone);

                  return react.createElement(
                    'div',
                    {
                      key: st.id || idx,
                      style: {
                        display: 'flex',
                        alignItems: 'stretch',
                        position: 'relative',
                      },
                    },
                    // 左侧时间轴轨道（节点 + 垂直连接线）
                    react.createElement(
                      'div',
                      {
                        style: {
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: 18,
                          flex: 'none',
                          marginRight: 10,
                        },
                      },
                      // 节点圆圈
                      react.createElement(
                        'div',
                        {
                          style: {
                            width: 16,
                            height: 16,
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 'none',
                            marginTop: 4,
                            background: nodeBg,
                            border: nodeBorder,
                            boxShadow: nodeGlow,
                            boxSizing: 'border-box',
                            zIndex: 2,
                            transition: 'all 0.15s ease',
                          },
                        },
                        nodeIcon,
                      ),
                      // 竖向连接线
                      !isLast
                        ? react.createElement('div', {
                            style: {
                              width: 1.5,
                              flex: 1,
                              minHeight: 18,
                              background: lineColor,
                              marginTop: 2,
                              marginBottom: 2,
                              borderRadius: 1,
                              opacity: isDone || isInProgress ? 0.9 : 0.4,
                            },
                          })
                        : null,
                    ),
                    // 右侧卡片内容
                    react.createElement(
                      'div',
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                          paddingBottom: isLast ? 0 : 10,
                        },
                      },
                      react.createElement(
                        'div',
                        {
                          style: {
                            padding: '10px 12px',
                            background: isInProgress ? '#F8FAFF' : TB.color.surface,
                            border: isInProgress ? '1px solid #BFDBFE' : '1px solid ' + TB.color.border,
                            borderRadius: TB.R.ctrl,
                            boxShadow: isInProgress ? '0 2px 8px rgba(37, 99, 235, 0.06)' : TB.S.card,
                            transition: 'all 0.15s ease',
                          },
                        },
                        // 步骤标题行
                        react.createElement(
                          'div',
                          { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 } },
                          react.createElement(
                            'div',
                            { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 } },
                            react.createElement(
                              'span',
                              {
                                style: {
                                  fontSize: 12.5,
                                  fontWeight: isInProgress ? 600 : 500,
                                  color: isInProgress ? TB.color.brand : TB.color.text,
                                  lineHeight: '17px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                },
                              },
                              stepTitleText,
                            ),
                          ),
                          react.createElement(
                            'span',
                            {
                              style: {
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '1.5px 7px',
                                borderRadius: TB.R.pill,
                                color: badgeColor,
                                background: badgeBg,
                                border: '1px solid ' + (isDone ? 'rgba(16, 185, 129, 0.2)' : isInProgress ? 'rgba(37, 99, 235, 0.2)' : TB.color.border),
                                whiteSpace: 'nowrap',
                                flex: 'none',
                              },
                            },
                            badgeText,
                          ),
                        ),
                        // 验收/说明副文本
                        stepDesc
                          ? react.createElement(
                              'div',
                              {
                                style: {
                                  fontSize: 11,
                                  color: stepDesc.isDanger
                                    ? TB.color.danger
                                    : stepDesc.isBrand
                                      ? TB.color.brand
                                      : TB.color.textMuted,
                                  marginTop: 4,
                                  lineHeight: '16px',
                                  overflowWrap: 'anywhere',
                                },
                              },
                              stepDesc.text,
                            )
                          : null,
                      ),
                    ),
                  );
                }),
              )
            : react.createElement('div', { style: { fontSize: 11.5, color: TB.color.textMuted, padding: '6px 0' } }, t('noSteps')),
        ),
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

      const activeTasks = [...inProgress, ...planning];
      const countOf = (val) => {
        if (val === 'all') return tasksAll.length;
        return tasksAll.filter((task) => task.workType === val).length;
      };

      const filterChip = (value, label) => {
        const count = countOf(value);
        const isSelected = filter === value;
        return react.createElement(
          'button',
          {
            key: value,
            type: 'button',
            onClick: () => onFilterChange(isSelected ? 'all' : value),
            style: {
              font: 'inherit',
              fontSize: 12,
              fontWeight: isSelected ? 600 : 500,
              lineHeight: '16px',
              padding: '4px 11px',
              margin: 0,
              borderRadius: TB.R.pill,
              cursor: 'pointer',
              background: isSelected ? TB.color.ink : TB.color.surface,
              color: isSelected ? '#FFFFFF' : TB.color.textSecondary,
              border: isSelected ? '1px solid ' + TB.color.ink : '1px solid ' + TB.color.borderStrong,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: isSelected ? '0 1px 3px rgba(15, 23, 42, 0.15)' : TB.S.card,
              transition: 'all 0.15s ease',
            },
          },
          label,
          react.createElement(
            'span',
            {
              style: {
                fontSize: 10.5,
                opacity: isSelected ? 0.9 : 0.65,
                fontWeight: 600,
                fontFamily: TB.font.mono,
              },
            },
            count,
          ),
        );
      };

      return react.createElement(
        'div',
        { style: KANBAN_BODY_STYLE },
        react.createElement(
          'div',
          { style: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 } },
          filterChip('all', t('filterAll')),
          filterChip('feat', t('filterFeat')),
          filterChip('issue', t('filterIssue')),
          filterChip('refactor', t('filterRefactor')),
        ),
        activeTasks.length === 0 && archived.length === 0
          ? react.createElement(
              'div',
              { style: { fontSize: 13, color: TB.color.textMuted, padding: '36px 0', textAlign: 'center' } },
              t('noTasks'),
            )
          : react.createElement(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 } },
              activeTasks.map((task) =>
                react.createElement(KanbanTaskItem, {
                  key: task.slug,
                  task,
                  t,
                  selected: selected === task.slug,
                  active: activeSlug === task.slug,
                  onSelect,
                }),
              ),
            ),
        archived.length > 0
          ? react.createElement(KanbanArchive, {
              tasks: archived,
              t,
              selected,
              onSelect,
              expanded,
              onToggle,
            })
          : null,
        react.createElement(
          'div',
          {
            style: {
              marginTop: 'auto',
              paddingTop: 16,
              fontSize: 12,
              color: TB.color.textMuted,
              textAlign: 'center',
              userSelect: 'none',
            },
          },
          t('boardHint'),
        ),
      );
    }

    /**
     * Roomier card for the expanded full-board lanes: title (up to 2 lines),
     * slug, step brief and stage badge. Still read-only; selection only.
     */
    function KanbanLaneCard(props) {
      const { task, t, selected, onSelect } = props;
      const totalSteps = task.totalSteps || 0;
      const completedSteps = task.completedSteps || 0;
      const isCompleted = task.phase === 'completed' || task.archived === true || task.status === 'completed';
      const pct = isCompleted ? 100 : totalSteps > 0 ? Math.min(100, Math.round((completedSteps / totalSteps) * 100)) : 0;
      const dotColor = statusDotColor(task);
      const wtColor = workTypeColor(task.workType);
      const wtLabel = taskTypeLabel(task.workType, t);
      const tint = typePillBg(task.workType);

      return react.createElement(
        'button',
        {
          type: 'button',
          onClick: () => onSelect(task.slug),
          title: task.title + ' (' + task.slug + ')',
          style: {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            padding: '12px 14px',
            margin: '0 0 10px 0',
            borderRadius: TB.R.card,
            cursor: 'pointer',
            background: TB.color.surface,
            border: selected ? '1.5px solid ' + TB.color.brand : '1px solid ' + TB.color.border,
            boxShadow: selected ? TB.S.glow : TB.S.card,
            transition: 'all 0.15s ease',
          },
        },
        selected
          ? react.createElement('span', {
              title: '选中任务',
              style: {
                position: 'absolute',
                top: 10,
                right: 10,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: TB.color.brand,
                flex: 'none',
              },
            })
          : null,
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6 } },
          react.createElement('span', {
            style: {
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: dotColor,
              flex: 'none',
            },
          }),
          wtLabel
            ? react.createElement(
                'span',
                {
                  style: {
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 6px',
                    borderRadius: TB.R.badge,
                    color: wtColor,
                    background: tint,
                    whiteSpace: 'nowrap',
                  },
                },
                wtLabel,
              )
            : null,
          react.createElement(
            'span',
            {
              style: {
                fontSize: 10.5,
                fontWeight: 500,
                color: TB.color.textMuted,
                marginLeft: 'auto',
                paddingRight: selected ? 14 : 0,
              },
            },
            task.stage || '—',
          ),
        ),
        react.createElement(
          'span',
          {
            style: {
              fontSize: 13,
              fontWeight: 500,
              lineHeight: '18px',
              color: TB.color.text,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            },
          },
          task.title,
        ),
        react.createElement(
          'div',
          {
            style: {
              fontSize: 11,
              color: TB.color.textMuted,
              fontFamily: TB.font.mono,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            },
          },
          task.slug,
        ),
        react.createElement(
          'div',
          { style: { marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 } },
          react.createElement(
            'div',
            {
              style: {
                height: 4,
                width: '100%',
                borderRadius: TB.R.pill,
                background: TB.color.surfaceHover,
                overflow: 'hidden',
              },
            },
            react.createElement('div', {
              style: {
                height: '100%',
                width: pct + '%',
                borderRadius: TB.R.pill,
                background: isCompleted ? TB.color.success : TB.color.brand,
                transition: 'width 0.2s ease',
              },
            }),
          ),
          react.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: 10.5,
                color: TB.color.textMuted,
              },
            },
            react.createElement(
              'span',
              {},
              completedSteps + '/' + totalSteps + ' ' + t('stepsUnit'),
            ),
            isCompleted
              ? react.createElement(
                  'span',
                  {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: TB.color.success,
                      fontWeight: 700,
                    },
                  },
                  renderIcon('check', { size: 12, color: TB.color.success }),
                )
              : null,
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
      const [viewMode, setViewMode] = react.useState('lanes'); // 'lanes' | 'list'

      react.useEffect(() => {
        const onKey = (e) => {
          if (e.key === 'Escape') onClose();
          if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            const input = document.getElementById('trellis-kanban-search-input');
            if (input) input.focus();
          }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
      }, [onClose]);

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
                fontSize: 13,
                color: TB.color.textMuted,
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

      // 3 泳道分类：规划中、进行中、已完成/归档
      const planningTasks = tasks.filter(
        (task) => task.phase === 'planning' || task.phase === 'planning-inline',
      );
      const inProgressTasks = tasks.filter(
        (task) => task.phase === 'in_progress' || task.phase === 'in_progress-inline',
      );
      const doneTasks = tasks.filter(
        (task) => task.phase === 'completed' || task.archived === true,
      );

      const countOf = (val) => {
        if (val === 'all') return tasksAll.length;
        return tasksAll.filter((task) => task.workType === val).length;
      };

      const filterChip = (value, label) => {
        const count = countOf(value);
        const isSelected = filter === value;
        return react.createElement(
          'button',
          {
            key: value,
            type: 'button',
            onClick: () => onFilterChange(isSelected ? 'all' : value),
            style: {
              font: 'inherit',
              fontSize: 12,
              fontWeight: isSelected ? 600 : 500,
              lineHeight: '16px',
              padding: '4px 11px',
              margin: 0,
              borderRadius: TB.R.pill,
              cursor: 'pointer',
              background: isSelected ? TB.color.ink : TB.color.surface,
              color: isSelected ? '#FFFFFF' : TB.color.textSecondary,
              border: isSelected ? '1px solid ' + TB.color.ink : '1px solid ' + TB.color.borderStrong,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: isSelected ? '0 1px 3px rgba(15, 23, 42, 0.15)' : TB.S.card,
              transition: 'all 0.15s ease',
            },
          },
          label,
          react.createElement(
            'span',
            {
              style: {
                fontSize: 10.5,
                opacity: isSelected ? 0.9 : 0.65,
                fontWeight: 600,
                fontFamily: TB.font.mono,
              },
            },
            count,
          ),
        );
      };

      const scrollbarStyles = `
        .trellis-workbench-main {
          min-width: 0;
        }
        @media (max-width: 1179px) {
          .trellis-workbench-main {
            overflow-x: auto !important;
            overflow-y: hidden !important;
          }
          .trellis-workbench-main > div {
            min-width: 220px !important;
          }
        }
        @media (max-width: 759px) {
          .trellis-workbench-main > div {
            min-width: 200px !important;
          }
        }
        .trellis-scrollbar::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        .trellis-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .trellis-scrollbar::-webkit-scrollbar-thumb {
          background: var(--dsw-alias-border-l2, rgba(140, 140, 140, 0.25));
          border-radius: 999px;
        }
        .trellis-scrollbar::-webkit-scrollbar-thumb:hover {
          background: var(--dsw-alias-label-tertiary, rgba(140, 140, 140, 0.45));
        }
      `;

      // 泳道卡片渲染器
      const renderLaneColumn = (title, items, count) => {
        return react.createElement(
          'div',
          {
            key: title,
            style: {
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: TB.color.surfaceMuted,
              border: '1px solid ' + TB.color.border,
              borderRadius: TB.R.lane,
              overflow: 'hidden',
            },
          },
          // 列头
          react.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderBottom: '1px solid ' + TB.color.border,
                background: TB.color.surfaceMuted,
                flex: 'none',
              },
            },
            react.createElement('span', { style: { fontSize: 13.5, fontWeight: 600, color: TB.color.text } }, title),
            react.createElement(
              'span',
              {
                style: {
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: TB.R.pill,
                  background: TB.color.surfaceHover,
                  color: TB.color.textSecondary,
                },
              },
              count,
            ),
          ),
          // 列体滚动区
          react.createElement(
            'div',
            {
              className: 'trellis-scrollbar',
              style: {
                flex: 1,
                padding: 10,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 0,
              },
            },
            items.length === 0
              ? react.createElement(
                  'div',
                  {
                    style: {
                      flex: 1,
                      minHeight: 120,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      color: TB.color.textMuted,
                      border: '1px dashed ' + TB.color.borderStrong,
                      borderRadius: TB.R.card,
                      margin: '4px 0',
                    },
                  },
                  t('noTasks'),
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
          ),
        );
      };

      // 效果图 C：列表形态行渲染
      const renderListView = () => {
        if (tasks.length === 0) {
          return react.createElement(
            'div',
            {
              style: {
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 13,
                color: TB.color.textMuted,
              },
            },
            t('noTasks'),
          );
        }

        return react.createElement(
          'div',
          {
            className: 'trellis-scrollbar',
            style: {
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '6px 14px',
              gap: 4,
            },
          },
          tasks.map((task) => {
            const isSelected = selected === task.slug;
            const dot = statusDotColor(task);
            const tint = typePillBg(task.workType);
            const wtLabel = taskTypeLabel(task.workType, t);
            const totalSteps = task.totalSteps || 0;
            const completedSteps = task.completedSteps || 0;
            const hasBlocked = task.hasBlocked === true;
            const hasPendingVerification = task.hasPendingVerification === true;

            return react.createElement(
              'button',
              {
                key: task.slug,
                type: 'button',
                onClick: () => onSelect(task.slug),
                title: task.title + ' (' + task.slug + ')',
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  width: '100%',
                  height: 52,
                  minHeight: 52,
                  padding: '0 14px',
                  borderRadius: TB.R.ctrl,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  background: isSelected ? '#F0F7FF' : 'transparent',
                  border: isSelected ? '1px solid #BFDBFE' : '1px solid transparent',
                  borderBottom: isSelected ? '1px solid #BFDBFE' : '1px solid ' + TB.color.border,
                  transition: 'all 0.12s ease',
                },
              },
              react.createElement('span', {
                style: { width: 8, height: 8, borderRadius: '50%', background: dot, flex: 'none' },
              }),
              react.createElement(
                'span',
                {
                  style: {
                    flex: '1 1 200px',
                    minWidth: 0,
                    fontSize: 13.5,
                    fontWeight: isSelected ? 600 : 500,
                    color: TB.color.text,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                task.title,
              ),
              react.createElement(
                'span',
                {
                  style: {
                    flex: '0 0 140px',
                    fontSize: 11.5,
                    color: TB.color.textMuted,
                    fontFamily: TB.font.mono,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                task.slug,
              ),
              wtLabel
                ? react.createElement(
                    'span',
                    {
                      style: {
                        flex: 'none',
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: TB.R.badge,
                        color: workTypeColor(task.workType),
                        background: tint,
                        whiteSpace: 'nowrap',
                      },
                    },
                    wtLabel,
                  )
                : null,
              react.createElement(
                'span',
                {
                  style: {
                    flex: 'none',
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: TB.R.badge,
                    color: TB.color.textSecondary,
                    background: TB.color.surfaceHover,
                    border: '1px solid ' + TB.color.border,
                    whiteSpace: 'nowrap',
                  },
                },
                task.stage ? task.stage + ' (' + (phaseLabelOf(task.phase, t) || '—') + ')' : '—',
              ),
              totalSteps > 0
                ? react.createElement(
                    'span',
                    {
                      style: {
                        flex: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        color: hasBlocked
                          ? TB.color.danger
                          : hasPendingVerification
                            ? TB.color.warn
                            : TB.color.textMuted,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      },
                    },
                    completedSteps + '/' + totalSteps + ' ' + t('stepsUnit'),
                  )
                : react.createElement('span', { style: { flex: 'none', width: 40 } }),
              isSelected
                ? react.createElement('span', {
                    style: { width: 8, height: 8, borderRadius: '50%', background: TB.color.brand, flex: 'none' },
                  })
                : react.createElement('span', { style: { width: 8, flex: 'none' } }),
            );
          }),
        );
      };

      return react.createElement(
        'div',
        {
          style: KANBAN_MODAL_OVERLAY_STYLE,
          onMouseDown: (e) => {
            if (e.target === e.currentTarget) onClose();
          },
        },
        react.createElement('style', null, scrollbarStyles),
        react.createElement(
          'div',
          { style: KANBAN_MODAL_STYLE },
          // 顶栏工具条
          react.createElement(
            'div',
            {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 24px',
                borderBottom: '1px solid ' + TB.color.border,
                background: TB.color.surface,
                flexWrap: 'wrap',
                gap: 12,
              },
            },
            // 左：搜索框
            react.createElement(
              'div',
              {
                style: {
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  width: 280,
                  maxWidth: '100%',
                },
              },
              react.createElement(
                'span',
                { style: { position: 'absolute', left: 10, pointerEvents: 'none', display: 'flex' } },
                renderIcon('search', { size: 14, color: TB.color.textMuted }),
              ),
              react.createElement('input', {
                id: 'trellis-kanban-search-input',
                type: 'search',
                placeholder: t('searchPlaceholder'),
                value: query,
                onChange: (e) => setQuery(e.target.value),
                style: {
                  width: '100%',
                  height: 36,
                  padding: '0 36px 0 32px',
                  fontSize: 12.5,
                  color: TB.color.text,
                  background: TB.color.surface,
                  border: '1px solid ' + TB.color.borderStrong,
                  borderRadius: TB.R.ctrl,
                  font: 'inherit',
                  outline: 'none',
                },
              }),
              react.createElement(
                'span',
                {
                  style: {
                    position: 'absolute',
                    right: 8,
                    fontSize: 10,
                    fontWeight: 700,
                    color: TB.color.textMuted,
                    background: TB.color.surfaceHover,
                    border: '1px solid ' + TB.color.border,
                    borderRadius: 4,
                    padding: '1px 5px',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  },
                },
                '⌘K',
              ),
            ),
            // 中：分类药丸
            react.createElement(
              'div',
              { style: { display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' } },
              filterChip('all', t('filterAll')),
              filterChip('feat', t('filterFeat')),
              filterChip('issue', t('filterIssue')),
              filterChip('refactor', t('filterRefactor')),
            ),
            // 右：视图切换 + 关闭
            react.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 12 } },
              react.createElement(
                'div',
                {
                  style: {
                    display: 'inline-flex',
                    background: TB.color.surfaceHover,
                    borderRadius: TB.R.ctrl,
                    padding: 3,
                    border: '1px solid ' + TB.color.border,
                    gap: 2,
                  },
                },
                react.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setViewMode('lanes'),
                    style: {
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: viewMode === 'lanes' ? 600 : 500,
                      color: viewMode === 'lanes' ? '#FFFFFF' : TB.color.textSecondary,
                      background: viewMode === 'lanes' ? TB.color.ink : 'transparent',
                      border: 'none',
                      borderRadius: TB.R.badge,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    },
                  },
                  t('viewLanes'),
                ),
                react.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setViewMode('list'),
                    style: {
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: viewMode === 'list' ? 600 : 500,
                      color: viewMode === 'list' ? '#FFFFFF' : TB.color.textSecondary,
                      background: viewMode === 'list' ? TB.color.ink : 'transparent',
                      border: 'none',
                      borderRadius: TB.R.badge,
                      padding: '4px 10px',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                    },
                  },
                  t('viewList'),
                ),
              ),
              react.createElement(
                'button',
                {
                  type: 'button',
                  onClick: onClose,
                  title: t('closeLabel'),
                  'aria-label': t('closeLabel'),
                  style: {
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 32,
                    height: 32,
                    cursor: 'pointer',
                    color: TB.color.textSecondary,
                    background: 'transparent',
                    border: '1px solid ' + TB.color.borderStrong,
                    borderRadius: TB.R.ctrl,
                    padding: 0,
                    transition: 'background 0.12s ease',
                  },
                },
                renderIcon('close', { size: 16 }),
              ),
            ),
          ),
          // 内容主体（左看板/列表 + 右详情抽屉）
          react.createElement(
            'div',
            { style: { display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' } },
            react.createElement(
              'div',
              {
                className: 'trellis-workbench-main',
                style: {
                  flex: 1,
                  display: 'flex',
                  minWidth: 0,
                  overflow: 'hidden',
                  padding: viewMode === 'lanes' ? '16px 20px' : '10px 0',
                  gap: 16,
                  background: viewMode === 'lanes' ? TB.color.surface : TB.color.surface,
                },
              },
              viewMode === 'lanes'
                ? react.createElement(
                    react.Fragment,
                    null,
                    renderLaneColumn(t('colPlanning'), planningTasks, planningTasks.length),
                    renderLaneColumn(t('colInProgress'), inProgressTasks, inProgressTasks.length),
                    renderLaneColumn(t('colArchive'), doneTasks, doneTasks.length),
                  )
                : renderListView(),
            ),
            react.createElement(KanbanDetails, {
              task: selectedTask,
              t,
              active: !!(selectedTask && selectedTask.slug === activeSlug),
              busy,
              onActivate: () => onActivate(selectedTask.slug),
              onDeactivate,
              tracks,
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
              if (value.currentTask) return value.currentTask;
              if (Array.isArray(value.tasks) && value.tasks.length > 0) return value.tasks[0].slug;
              return null;
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
      let dotColor = TB.color.textMuted;
      let label = '';
      let title = t('chipTitle');
      if (failed) {
        dotColor = TB.color.danger;
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
            padding: '0 10px',
            margin: 0,
            font: 'inherit',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: '16px',
            color: TB.color.textSecondary,
            background: TB.color.surface,
            border: '1px solid ' + TB.color.borderStrong,
            borderRadius: TB.R.pill,
            boxShadow: TB.S.card,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease',
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
                      title: t('kanbanRefresh'),
                      'aria-label': t('kanbanRefresh'),
                      onClick: () => {
                        setBoard(null);
                        setBoardFailed(false);
                        loadBoard();
                      },
                      style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                        color: TB.color.textSecondary,
                        background: 'transparent',
                        border: '1px solid var(--dsw-alias-border-l2)',
                        borderRadius: 6,
                        padding: 0,
                      },
                    },
                    renderIcon('refresh', { size: 12 }),
                  ),
                  react.createElement(
                    'button',
                    {
                      type: 'button',
                      title: t('expandBoard'),
                      'aria-label': t('expandBoard'),
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
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        cursor: 'pointer',
                        color: TB.color.textSecondary,
                        background: 'transparent',
                        border: '1px solid var(--dsw-alias-border-l2)',
                        borderRadius: 6,
                        padding: 0,
                      },
                    },
                    renderIcon('maximize', { size: 12 }),
                  ),
                ),
              ),
              boardFailed
                ? react.createElement(
                    'div',
                    {
                      style: { padding: 16, fontSize: 12, color: TB.color.danger, cursor: 'pointer' },
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
                      { style: { padding: 16, fontSize: 12, color: TB.color.textMuted } },
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

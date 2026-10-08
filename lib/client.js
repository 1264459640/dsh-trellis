/**
 * trellis-workflow client half — configuration page on the Plugins list.
 *
 * Contributes the `trellis-workflow` loader entry's configuration to the
 * Plugins page (slot `plugins.row.config`, keyed
 * `<package name>#<row id>`) so the injection allowlist, injectStep,
 * skipKeywords, inline, and enforceReadonlyPlanning fields are editable there
 * and take effect on the next turn without a restart.
 *
 * This file is a client bundle in the web shell's module format
 * (`window.__ModuleLoader__.load({ id, factory })`); it is served under
 * /plugins by the harness when the package is an enabled Loader entry whose
 * manifest declares `dsh.client` with `platform: web`.
 *
 * DSH 0.1.7 settings are Loader-entry driven: the namespace IS the loader entry
 * id (`trellis-workflow`) and the value is the entry's projected Config. The
 * Web client reads and writes it through the shared `configForms` service, and
 * the card registers into the Plugins page's `plugins.row.config` seat.
 */

window.__ModuleLoader__.load({
  id: '@banana-peeljj12/dsh-trellis',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });

    let react = require('react');
    let primitives = require('@deepseek-ai/dsh-client-ui-primitives');

    /**
     * Module-level client root context, captured in apply(ctx). Components (slot
     * registrations) do not receive ctx directly, but need host services such as
     * `sidebarRight` (native document preview) at click time — this is the
     * bridge. Null until apply runs, which happens before any component mounts.
     */
    let clientCtx = null;

    // #region lib/types/client/trellis-shared.js

    /**
     * The bundle patch row id — also the settings entry id this page edits. A
     * row inserted by a bundle patch is loaded under a namespaced entry id
     * (`include:trellis-workflow`) while a directly-declared row keeps the bare
     * id, so consumers match it as a suffix (see `entryIdOf`).
     */
    const NS = 'trellis-workflow';

    /** Locale dictionary namespace owned by this client half. */
    const LOCALE_NS = 'settings.trellisWorkflow';

    /** Services required by this client half. */
    const inject = ['slots', 'locale', 'configForms', 'uiWorkspace', 'sidebarRight'];

    const zh = {
      unavailable: '该插件当前未加载，暂不可配置（宿主未提供 trellis-workflow 条目）。',
      servedNamespaces: '宿主已服务的命名空间：',
      noneServed: '（无）',
      allowlist: '注入白名单',
      allowlistHint: '命中这些项目根的会话才会收到工作流面包屑。',
      injectStep: '注入步数（injectStep）',
      injectStepHint: '只在该步注入（1 = 每条用户消息的第一步）。',
      skipKeywords: '跳过关键词（逗号分隔）',
      skipKeywordsHint: '出现这些词（独立单词，逗号分隔）时，本轮跳过注入。',
      inline: '按 codex-inline 调度解析阶段',
      enforceReadonlyPlanning: '规划期只读保护（enforceReadonlyPlanning）',
      enforceReadonlyPlanningHint:
        '开启后，命中白名单的项目里：新对话（未建任务）只裁剪 write/edit 与任务写工具（trellis_task_update / trellis_artifact_update / trellis_task_archive / trellis_ui_update），其余工具（含其他插件的工具）保留；规划中的任务只裁剪 write/edit 与创建/跳过/归档类 trellis 工具，其余工具保留；经 trellis_task_skip 跳过任务的会话恢复完整工具。',
      save: '保存',
      saving: '保存中…',
      saveFailed: '本部署没有接受这些值，已保留供你修改。',
      readOnly: '本部署的设置为只读。',
      overridden: '已覆盖',
      reset: '恢复默认',
      invalidNumber: '请填数字；留空表示使用默认值。',
      desc: 'Trellis 工作流：按会话项目注入阶段面包屑、提供任务阶段工具与看板。',
      browse: '浏览…',
      browseFailed: '调用文件夹选择器失败，请手动输入路径',
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
      colArchive: '已完成 · 归档',
      detailsTitle: '激活任务',
      metaArtifacts: '产物',
      noArtifacts: '暂无产物',
      activate: '设为当前会话激活',
      activateCta: '激活任务',
      deactivate: '取消当前激活',
      archivedReadonly: '已归档任务（只读）',
      busy: '处理中…',
      otherMonth: '其他',
      noTasks: '暂无任务',
      boardLoading: '看板加载中…',
      boardFailed: '看板加载失败，点击重试',
      expandBoard: '展开大看板',
      filterAll: '全部',
      filterFeat: '功能',
      filterIssue: '缺陷',
      filterRefactor: '重构',
      searchPlaceholder: '搜索标题或 slug…',
      sendToChat: '推进任务',
      sendToChatSuccess: '已填入输入框，回车即可发送',
      sendToChatFailed: '自动填入失败，已复制到剪贴板',
      openFailed: '打开失败，文件引用已复制到剪贴板',
      pendingVerification: '待验证',
      blocked: '阻塞',
      open: '打开',
      pipelineTitle: '阶段流水线',
      stepsUnit: '步骤',
      stepsDoneCaption: '已完成 {n} 个步骤，共 {m} 个步骤',
      noSteps: '暂无执行步骤',
      stepCompleted: '已完成',
      stepInProgress: '进行中',
      stepPending: '未开始',
      viewLanes: '工作台',
      viewList: '列表',
      viewBoard: '看板',
      closeLabel: '关闭',
      previewLoading: '读取中…',
      previewFailed: '无法读取该产物',
      boardHint: '仅展示，不直接改状态',
      selectTaskPrompt: '选择任务查看详情',
      selectTaskHint: '在左侧点击任务以查看产物与操作',
    };

    const en = {
      unavailable:
        'This plugin is not loaded, so it cannot be configured right now (the Host does not serve the trellis-workflow entry).',
      servedNamespaces: 'Namespaces the Host serves:',
      noneServed: '(none)',
      allowlist: 'Injection allowlist',
      allowlistHint: 'Sessions whose cwd matches these project roots receive the workflow breadcrumb.',
      browse: 'Browse…',
      browseFailed: 'Could not open the directory picker — enter the path manually',
      injectStep: 'Inject step (injectStep)',
      injectStepHint: 'Only inject on this step index (1 = the first step of each user message).',
      skipKeywords: 'Skip keywords (comma-separated)',
      skipKeywordsHint: 'Standalone words (comma-separated) that suppress injection for a turn.',
      inline: 'Resolve phases as codex-inline dispatch',
      enforceReadonlyPlanning: 'Read-only planning (enforceReadonlyPlanning)',
      enforceReadonlyPlanningHint:
        'When enabled, in allowlisted projects: a fresh conversation (no task yet) trims only write/edit and task-write trellis tools (trellis_task_update / trellis_artifact_update / trellis_task_archive / trellis_ui_update), keeping all other tools (including other plugins\'); a task in the planning phase trims only write/edit and create/skip/archive trellis tools, keeping all other tools; a session that skipped the task via trellis_task_skip regains the full tool surface.',
      save: 'Save',
      saving: 'Saving…',
      saveFailed: 'The deployment did not accept these values; they were left for you to correct.',
      readOnly: 'This deployment stores settings read-only.',
      overridden: 'Overridden',
      reset: 'Reset to default',
      invalidNumber: 'Enter a number, or leave blank to use the default.',
      desc: 'Trellis workflow: injects a per-project phase breadcrumb and provides the task/phase tools and board.',
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
      colArchive: 'Completed · Archive',
      detailsTitle: 'Activate Task',
      metaArtifacts: 'Artifacts',
      noArtifacts: 'No artifacts',
      activate: 'Set active for this session',
      activateCta: 'Activate task',
      deactivate: 'Clear active for this session',
      archivedReadonly: 'Archived task (read-only)',
      busy: 'Working…',
      otherMonth: 'Other',
      noTasks: 'No tasks',
      boardLoading: 'Loading board…',
      boardFailed: 'Board load failed — click to retry',
      expandBoard: 'Expand board',
      filterAll: 'All',
      filterFeat: 'Feature',
      filterIssue: 'Issue',
      filterRefactor: 'Refactor',
      searchPlaceholder: 'Search title or slug…',
      sendToChat: 'Push to chat',
      sendToChatSuccess: 'Filled into the input — press Enter to send',
      sendToChatFailed: 'Auto-fill failed, copied to clipboard',
      openFailed: 'Failed to open — file reference copied to clipboard',
      pendingVerification: 'Verifying',
      blocked: 'Blocked',
      open: 'Open',
      pipelineTitle: 'Stage pipeline',
      stepsUnit: 'steps',
      stepsDoneCaption: 'Completed {n} of {m} steps',
      noSteps: 'No execution steps',
      stepCompleted: 'Completed',
      stepInProgress: 'In Progress',
      stepPending: 'Pending',
      viewLanes: 'Board',
      viewList: 'List',
      viewBoard: 'Board',
      closeLabel: 'Close',
      previewLoading: 'Reading…',
      previewFailed: 'Could not read this artifact',
      boardHint: 'View only — no direct state changes',
      selectTaskPrompt: 'Select a task',
      selectTaskHint: 'Click a task on the left to view details',
    };

    // #region lib/types/client/trellis-settings-card.js

    /**
     * DSH 0.1.7 settings surface for the `trellis-workflow` loader entry.
     *
     * The old per-plugin settings-scope model is gone: namespaces are loader
     * entry ids, and the Web client reads/writes them through the shared
     * `configForms` service (the same path the official settings cards use).
     * The custom page registers into the Plugins page's `plugins.row.config`
     * seat, keyed `<package name>#<row id>` — the key the plugin list page
     * dispatches for this bundle's `trellis-workflow` row.
     */

    /** The Plugins-page row key this bundle's configuration registers under. */
    const ROW_CONFIG_KEY = '@banana-peeljj12/dsh-trellis#trellis-workflow';

    /** Minimal button style for the browse control (the form frame owns the rest). */
    const btnStyle = {
      height: 30,
      padding: '0 12px',
      fontSize: 13,
      font: 'inherit',
      color: 'var(--dsw-alias-label-primary)',
      background: 'transparent',
      border: '1px solid var(--dsw-alias-border-l2)',
      borderRadius: 8,
      cursor: 'pointer',
    };

    /** The label frame the shared settings form renders. */
    function formLabels(t) {
      return {
        unavailable: t('unavailable'),
        readOnly: t('readOnly'),
        saveFailed: t('saveFailed'),
        save: t('save'),
        saving: t('saving'),
      };
    }

    /**
     * A comma-separated list field. The shared form model is text based, so a
     * list stages as one line; an empty draft clears the override.
     * @param {string} field field name inside the entry's config section.
     * @returns {{ field: string, format: (v: unknown) => string, parse: (t: string) => unknown }}
     */
    function settingsListField(field) {
      return {
        field,
        format: (value) => (Array.isArray(value) ? value.join(', ') : ''),
        parse: (text) => {
          const items = String(text)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          return items.length === 0 ? { kind: 'clear' } : { kind: 'set', value: items };
        },
      };
    }

    /**
     * A boolean field staged as the text `true`/`false`, so a checkbox can ride
     * the same staged-draft and save semantics as every other control.
     * @param {string} field field name inside the entry's config section.
     * @returns {{ field: string, format: (v: unknown) => string, parse: (t: string) => unknown }}
     */
    function settingsBoolField(field) {
      return {
        field,
        format: (value) => (value === true ? 'true' : 'false'),
        parse: (text) => ({ kind: 'set', value: String(text).trim() === 'true' }),
      };
    }

    /** Parse a staged comma-separated draft back into a list. */
    function listFromText(text) {
      return String(text || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    /**
     * A minimal snapshot store for the card's injected hook. The shared form
     * model owns its own store, but the card must also render before the entry
     * is resolved, so the controller publishes through this one.
     * @param {object} initial the first snapshot.
     * @returns {{ getSnapshot: () => object, subscribe: (fn: () => void) => (() => void), set: (next: object) => void }}
     */
    function createStore(initial) {
      let snapshot = initial;
      const listeners = new Set();
      return {
        getSnapshot: () => snapshot,
        subscribe(listener) {
          listeners.add(listener);
          return () => listeners.delete(listener);
        },
        set(next) {
          snapshot = next;
          for (const listener of listeners) {
            try {
              listener();
            } catch {
              /* one listener must not break the others */
            }
          }
        },
      };
    }

    /** The form state before the entry is resolved: nothing to edit yet. */
    function emptyFormState() {
      const empty = { text: '', overridden: false, invalid: false };
      return {
        available: false,
        writable: false,
        dirty: false,
        invalid: false,
        saving: false,
        failed: false,
        served: [],
        allowlist: empty,
        injectStep: empty,
        skipKeywords: empty,
        inline: empty,
        enforceReadonlyPlanning: empty,
      };
    }

    /**
     * Resolve this bundle's loader entry id from the served namespaces.
     *
     * A row inserted by a bundle patch is loaded under a namespaced entry id
     * (`include:trellis-workflow`), while the same row declared directly in a
     * profile patch keeps the bare id — so match the row id as a suffix rather
     * than assuming one form.
     * @param {Iterable<string>} served namespaces the Host currently serves.
     * @returns {string | undefined} the entry id, when served.
     */
    function entryIdOf(served) {
      for (const ns of served) {
        if (ns === NS || ns.endsWith(':' + NS)) return ns;
      }
      return undefined;
    }

    /**
     * Stage this entry's config edits over the shared `configForms` form and
     * write them on save (the same controller shape the official cards use).
     *
     * The entry id is resolved lazily from the describe mirror: the Web client
     * can mount before the Host serves the entry, and the id a bundle patch
     * produces is namespaced.
     */
    class TrellisConfigController {
      /**
       * @param {object} configForms the shared `configForms` service.
       */
      constructor(configForms) {
        this.configForms = configForms;
        this.mirror = configForms.describe();
        this.model = null;
        this.entryId = undefined;
        this.store = createStore(emptyFormState());
        this.modelStore = null;
        this.modelOff = null;
        this.mirrorOff = this.mirror.subscribe(() => this.settle());
        this.mirror.ensure();
        this.settle();
      }

      /**
       * The namespaces the Host currently serves, read from the shared mirror.
       * @returns {string[]} served namespace ids.
       */
      servedNamespaces() {
        try {
          const view = this.mirror.getSnapshot().view;
          const rows = view && view.namespaces ? view.namespaces : [];
          return rows.map((row) => row && row.ns).filter(Boolean);
        } catch {
          return [];
        }
      }

      /** Build the shared form model once the Host serves this entry. */
      settle() {
        if (this.model) return;
        const entryId = entryIdOf(this.servedNamespaces());
        if (entryId === undefined) return;
        this.entryId = entryId;
        this.model = new primitives.SettingsFormModel(this.configForms.get(entryId), [
          settingsListField('allowlist'),
          primitives.settingsNumberField('injectStep'),
          settingsListField('skipKeywords'),
          settingsBoolField('inline'),
          settingsBoolField('enforceReadonlyPlanning'),
        ]);
        this.modelStore = this.model.bind(() => this.projection());
        this.modelOff = this.modelStore.subscribe(() => this.store.set(this.projection()));
        this.store.set(this.projection());
      }

      /** Build the snapshot the card renders from. */
      projection() {
        const served = this.servedNamespaces();
        if (!this.model) return { ...emptyFormState(), served };
        return {
          ...this.model.shell(),
          served,
          allowlist: this.model.field('allowlist'),
          injectStep: this.model.field('injectStep'),
          skipKeywords: this.model.field('skipKeywords'),
          inline: this.model.field('inline'),
          enforceReadonlyPlanning: this.model.field('enforceReadonlyPlanning'),
        };
      }

      /**
       * Build the face the slot registration injects.
       * @returns the form snapshot hook and the staged-form actions.
       */
      inject() {
        const call = (name) => (...args) => {
          if (!this.model) return undefined;
          return this.model.actions()[name](...args);
        };
        return {
          hooks: { trellisConfig: this.store },
          edit: call('edit'),
          resetField: call('resetField'),
          save: call('save'),
          discard: call('discard'),
        };
      }

      /** Release every subscription. */
      dispose() {
        if (this.mirrorOff) this.mirrorOff();
        if (this.modelOff) this.modelOff();
        if (this.model) this.model.dispose();
        this.mirrorOff = null;
        this.modelOff = null;
        this.model = null;
      }
    }

    /** One labelled checkbox row for a boolean config field. */
    function BooleanRow(props) {
      const { id, label, hint, checked, disabled, onToggle } = props;
      return react.createElement(
        'div',
        { style: { margin: '12px 0 2px' } },
        react.createElement(
          'label',
          { htmlFor: id, style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 } },
          react.createElement('input', {
            id,
            type: 'checkbox',
            checked,
            disabled,
            onChange: (e) => onToggle(e.target.checked),
          }),
          label,
        ),
        hint
          ? react.createElement(
              'p',
              { style: { margin: '4px 0 0', color: 'var(--dsw-alias-label-secondary)', fontSize: 12 } },
              hint,
            )
          : null,
      );
    }

    /**
     * Render this entry's configuration: the one-liner when the page asks for a
     * summary, otherwise the shared form with its staged fields and one save.
     * @param {object} props the view asked for, locale copy, the form snapshot,
     *   its actions, and the injected slot face.
     * @returns {unknown} the summary line, or the form.
     */
    function TrellisConfigCard(props) {
      const { t } = props;
      if (props.view === 'summary') return t('desc');
      const state = props.useTrellisConfig((snapshot) => snapshot);
      const disabled = !state.writable;
      const field = (name) => state[name] || { text: '', overridden: false, invalid: false };

      const onBrowse = () => {
        const ws = clientCtx && clientCtx.uiWorkspace;
        if (!ws || typeof ws.pickDirectory !== 'function') {
          setBrowseError(true);
          return;
        }
        ws.pickDirectory()
          .then((picked) => {
            if (picked === null || picked === undefined) return;
            const normalized = String(picked).trim().replace(/\\/g, '/');
            if (!normalized) return;
            const current = listFromText(field('allowlist').text);
            if (current.includes(normalized)) return;
            props.edit('allowlist', current.concat(normalized).join(', '));
          })
          .catch(() => setBrowseError(true));
      };

      const [browseError, setBrowseError] = react.useState(false);
      react.useEffect(() => {
        if (!browseError) return undefined;
        const timer = setTimeout(() => setBrowseError(false), 2600);
        return () => clearTimeout(timer);
      }, [browseError]);

      if (!state.available) {
        // The Host does not (yet) serve this entry. Say so, and name what it
        // does serve, so a mis-resolved entry id is diagnosable from the page
        // itself instead of showing up as an unexplained blank.
        const served = Array.isArray(state.served) ? state.served : [];
        return react.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          react.createElement(
            'p',
            { role: 'status', style: { margin: 0, color: 'var(--dsw-alias-label-tertiary)', fontSize: 13 } },
            t('unavailable'),
          ),
          react.createElement(
            'p',
            {
              style: {
                margin: 0,
                color: 'var(--dsw-alias-label-tertiary)',
                fontSize: 12,
                fontFamily: 'var(--ds-font-family-code)',
                overflowWrap: 'anywhere',
              },
            },
            `${t('servedNamespaces')} ${served.length ? served.join(', ') : t('noneServed')}`,
          ),
        );
      }

      return react.createElement(
        primitives.SettingsForm,
        { labels: formLabels(t), state, onSave: props.save, onDiscard: props.discard },
        react.createElement(primitives.SettingsValueField, {
          id: 'trellis-config-allowlist',
          label: t('allowlist'),
          hint: t('allowlistHint'),
          overriddenLabel: t('overridden'),
          resetLabel: t('reset'),
          invalidLabel: t('invalidNumber'),
          disabled,
          ...field('allowlist'),
          onEdit: (text) => props.edit('allowlist', text),
          onReset: () => props.resetField('allowlist'),
        }),
        react.createElement(
          'div',
          { style: { display: 'flex', gap: 8, alignItems: 'center' } },
          react.createElement(
            'button',
            { type: 'button', style: btnStyle, disabled, onClick: onBrowse },
            t('browse'),
          ),
          browseError
            ? react.createElement(
                'p',
                { style: { margin: 0, color: 'var(--dsw-alias-state-error-primary)', fontSize: 12 }, role: 'alert' },
                t('browseFailed'),
              )
            : null,
        ),
        react.createElement(primitives.SettingsValueField, {
          id: 'trellis-config-inject-step',
          label: t('injectStep'),
          hint: t('injectStepHint'),
          overriddenLabel: t('overridden'),
          resetLabel: t('reset'),
          invalidLabel: t('invalidNumber'),
          numeric: true,
          disabled,
          ...field('injectStep'),
          onEdit: (text) => props.edit('injectStep', text),
          onReset: () => props.resetField('injectStep'),
        }),
        react.createElement(primitives.SettingsValueField, {
          id: 'trellis-config-skip-keywords',
          label: t('skipKeywords'),
          hint: t('skipKeywordsHint'),
          overriddenLabel: t('overridden'),
          resetLabel: t('reset'),
          invalidLabel: t('invalidNumber'),
          disabled,
          ...field('skipKeywords'),
          onEdit: (text) => props.edit('skipKeywords', text),
          onReset: () => props.resetField('skipKeywords'),
        }),
        react.createElement(BooleanRow, {
          id: 'trellis-config-inline',
          label: t('inline'),
          checked: field('inline').text === 'true',
          disabled,
          onToggle: (next) => props.edit('inline', next ? 'true' : 'false'),
        }),
        react.createElement(BooleanRow, {
          id: 'trellis-config-readonly',
          label: t('enforceReadonlyPlanning'),
          hint: t('enforceReadonlyPlanningHint'),
          checked: field('enforceReadonlyPlanning').text === 'true',
          disabled,
          onToggle: (next) => props.edit('enforceReadonlyPlanning', next ? 'true' : 'false'),
        }),
      );
    }

    // #endregion

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

    function formatStepTitle(st, idx) {
      const raw = (st && st.title) ? String(st.title).trim() : '';
      if (!raw) return String(idx + 1) + '. ';
      return String(idx + 1) + '. ' + raw;
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
        case 'maximize':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '15 3 21 3 21 9' }),
            react.createElement('polyline', { points: '9 21 3 21 3 15' }),
            react.createElement('line', { x1: '21', y1: '3', x2: '14', y2: '10' }),
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
        case 'check':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('polyline', { points: '20 6 9 17 4 12' }),
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
        // Use a real host token: an unknown surface alias falls back to white
        // even while the host's label tokens switch to their dark-mode values.
        surface: 'var(--dsw-alias-bg-base, #FFFFFF)',
        surfaceMuted: 'var(--dsw-alias-bg-layer-1, #F8FAFC)',
        surfaceHover: 'var(--dsw-alias-bg-layer-2, #F1F5F9)',
        surfaceActive: 'var(--dsw-alias-bg-layer-3, #E2E8F0)',
        text: 'var(--dsw-alias-label-primary, #0F172A)',
        textSecondary: 'var(--dsw-alias-label-secondary, #475569)',
        textMuted: 'color-mix(in srgb, var(--dsw-alias-label-tertiary, #64748B) 70%, var(--dsw-alias-label-primary, #0F172A))',
        border: 'var(--dsw-alias-border-l1, #E2E8F0)',
        borderStrong: 'var(--dsw-alias-border-l2, #CBD5E1)',
        brand: 'var(--dsw-alias-state-business-primary, #185DDD)',
        brandHover: '#1D4ED8',
        brandBar: '#216AE2', // 进行中进度条填充（效果图采样）
        accentBright: '#146BFE', // 弹窗左竖条 / 右选中点（效果图采样）
        success: 'var(--dsw-alias-state-success-primary, #3BAF62)',
        warn: 'var(--dsw-alias-state-warn-primary, #F59E0B)',
        danger: 'var(--dsw-alias-state-error-primary, #EF4444)',
        // Accent fills are not text colors: mix labels toward the host's
        // foreground so small badges stay legible in both palettes.
        brandText: 'color-mix(in srgb, var(--dsw-alias-state-business-primary, #185DDD) 50%, var(--dsw-alias-label-primary, #0F172A))',
        successText: 'color-mix(in srgb, var(--dsw-alias-state-success-primary, #3BAF62) 50%, var(--dsw-alias-label-primary, #0F172A))',
        warnText: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary, #F59E0B) 50%, var(--dsw-alias-label-primary, #0F172A))',
        dangerText: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #EF4444) 50%, var(--dsw-alias-label-primary, #0F172A))',
        issue: 'color-mix(in srgb, #F77032 50%, var(--dsw-alias-label-primary, #0F172A))',
        brandSolid: '#185DDD', // Paired with white stage numbers, never a pale dark-mode accent.
        ink: '#0B0C0D', // Paired with white CTA/filter labels in both themes.
        inkHover: '#0F172A',
        selectBg: 'var(--dsw-alias-state-business-tertiary, #EFF6FE)',
        selectBgPop: 'var(--dsw-alias-state-business-tertiary, #F2F6FC)',
        chipBg: 'var(--dsw-alias-interactive-bg-hover-solid, #F1F2F3)',
        chipText: 'var(--dsw-alias-label-secondary, #626471)',
        ring: '#61BD7E',
        successSoft: 'var(--dsw-alias-state-success-tertiary, #E0F2E6)',
        featBg: 'var(--dsw-alias-state-business-tertiary, #EFF4FD)',
        issueBg: 'var(--dsw-alias-state-warn-tertiary, #FEF3E9)',
        refactorBg: 'var(--dsw-alias-state-success-tertiary, #EEFBF1)',
      },
      tint: {
        neutral: 'rgba(100, 116, 139, 0.08)',
      },
      R: {
        window: '20px',
        popover: '16px',
        modal: '16px',
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
      if (wt === 'feat') return TB.color.featBg;
      if (wt === 'issue') return TB.color.issueBg;
      if (wt === 'refactor') return TB.color.refactorBg;
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
      color: TB.color.text,
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
      padding: '18px 22px',
      borderBottom: '1px solid ' + TB.color.border,
      background: TB.color.surface,
      flex: 'none',
    };

    const KANBAN_BODY_STYLE = {
      display: 'flex',
      flexDirection: 'column',
      padding: '14px 22px 22px 22px',
      overflowY: 'auto',
      flex: 1,
      minHeight: 360,
      background: TB.color.surface,
    };

    const KANBAN_RIGHT_STYLE = {
      flex: 'none',
      width: 376,
      minWidth: 300,
      background: TB.color.surface,
      borderLeft: '1px solid ' + TB.color.border,
      padding: '22px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      overflowY: 'auto',
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
      color: TB.color.text,
      borderRadius: TB.R.modal,
      boxShadow: TB.S.modal,
      overflow: 'hidden',
    };

    function taskTypeLabel(workType, t) {
      const key = workType && workType[0].toUpperCase() + workType.slice(1);
      const localized = key && t('workType' + key);
      return localized && localized !== 'workType' + key ? localized : workType || '';
    }

    /**
     * Work-type accent color: feat=blue, issue=orange, refactor=green.
     * Unknown types fall back to neutral（效果图采样：缺陷橙 #F77032）。
     */
    function workTypeColor(workType) {
      if (workType === 'feat') return TB.color.brandText
      if (workType === 'issue') return TB.color.issue
      if (workType === 'refactor') return TB.color.successText
      return TB.color.textMuted
    }

    /**
     * Compact high-density task row item for the popover list view.
     * Full title visibility, work-type accent bar, mono slug and pill badges.
     */
    function KanbanTaskItem(props) {
      const { task, t, selected, active, onSelect } = props;
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
            padding: '12px 14px', margin: '1px 0', borderRadius: TB.R.card, cursor: 'pointer',
            background: selected ? TB.color.selectBgPop : 'transparent',
            border: selected ? '1px solid ' + TB.color.brand : '1px solid transparent',
            borderBottom: selected ? undefined : '1px solid ' + TB.color.border,
            boxShadow: 'none',
            transition: 'background 0.12s ease',
          },
        },
        selected ? react.createElement('span', { style: { position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3.5, borderRadius: TB.R.pill, background: TB.color.accentBright, flex: 'none' } }) : null,
        react.createElement('span', { style: { flex: 1, minWidth: 0, fontSize: 13, fontWeight: selected ? 600 : 500, lineHeight: '18px', color: TB.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, task.title),
        wtLabel ? react.createElement('span', { style: { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: TB.R.badge, color: workTypeColor(task.workType), background: tint, border: '1px solid ' + TB.color.border, whiteSpace: 'nowrap', flex: 'none' } }, wtLabel) : null,
        react.createElement('span', { style: { fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: TB.R.badge, color: TB.color.textSecondary, background: TB.color.surfaceHover, border: '1px solid ' + TB.color.border, whiteSpace: 'nowrap', flex: 'none' } }, task.stage || '—'),
        selected
          ? react.createElement('span', { style: { width: 8, height: 8, borderRadius: '50%', background: TB.color.accentBright, flex: 'none' } })
          : active
            ? react.createElement('span', { title: '当前会话激活', style: { width: 8, height: 8, borderRadius: '50%', background: TB.color.brand, flex: 'none' } })
            : null,
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

    /**
     * DSH-native file address for an artifact token. Mirrors the official
     * `fileAddressFor` / `sessionFileAddress` contract
     * (@deepseek-ai/dsh-client-ui-sidebar-files): the token's path (minus the
     * leading `@`) is a workspace-relative path, so it maps to a session-scoped
     * `dsh-resource://file/session/<sessionId>/<path>` address the right-sidebar
     * document preview resolves against the session's workspace. Path segments
     * are component-encoded, keeping `:` literal for drive letters.
     * @param {string} sessionId the session whose workspace resolves the path.
     * @param {string} token artifact token from {@link artifactToken}.
     * @returns {string} `dsh-resource://file/session/...` address.
     */
    function artifactResourceUrl(sessionId, token) {
      const path = (token || '').replace(/^@/, '');
      const encodeSegment = (segment) => encodeURIComponent(segment).replace(/%3A/gi, ':');
      const encodedPath = path
        .replace(/\\/g, '/')
        .split('/')
        .map(encodeSegment)
        .join('/');
      return 'dsh-resource://file/session/' + encodeSegment(sessionId) + '/' + encodedPath;
    }

    /**
     * Open an artifact file in the DSH-native document preview (right sidebar),
     * mirroring how the official chat client opens `@file` references
     * (`ctx.sidebarRight.openResource(...)`). Never touches the composer input.
     * Falls back to copying the token to the clipboard when the right-sidebar
     * service is unavailable or the open fails, so the click still yields
     * something useful without polluting the input box.
     * @param {object} ctx client root context (with `sidebarRight` injected).
     * @param {string} sessionId the session owning the artifact's workspace.
     * @param {string} token artifact token from {@link artifactToken}.
     * @returns {boolean} true when opened natively; false when only copied.
     */
    function openArtifactFile(ctx, sessionId, token) {
      try {
        const sidebar = ctx && ctx.sidebarRight;
        if (sidebar && typeof sidebar.openResource === 'function') {
          sidebar.openResource(artifactResourceUrl(sessionId, token));
          return true;
        }
      } catch {
        /* fall through to clipboard copy */
      }
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(token);
        } else {
          const ta = document.createElement('textarea');
          ta.value = token;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
      } catch {
        /* nothing more we can do */
      }
      return false;
    }

    function KanbanDetails(props) {
      const { task, t, active, busy, onActivate, onDeactivate, tracks, onOpenArtifact } = props;
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

      // 阶段流水线 (轻质 Stepper：单一灰轴线 + 白/蓝节点)
      const stageFlow = track && track.length > 0
        ? react.createElement(
            'div',
            {
              style: {
                display: 'flex',
                flexDirection: 'column',
                width: '100%',
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
                  height: 24,
                },
              },
              // 贯通轴线（浅灰，位于节点后方）
              react.createElement('div', {
                style: {
                  position: 'absolute',
                  left: (100 / (track.length * 2)) + '%',
                  right: (100 / (track.length * 2)) + '%',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  height: 2,
                  background: TB.color.borderStrong,
                  zIndex: 0,
                },
              }),
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
                        width: isCurrent ? 24 : 20,
                        height: isCurrent ? 24 : 20,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 'none',
                        boxSizing: 'border-box',
                        background: isCurrent ? TB.color.brandSolid : TB.color.surface,
                        color: isCurrent ? '#FFFFFF' : TB.color.text,
                        border: isCurrent
                          ? '2px solid ' + TB.color.brand
                          : '1px solid ' + TB.color.border,
                        boxShadow: 'none',
                        transition: 'all 0.2s ease',
                      },
                    },
                    done
                      ? renderIcon('check', { size: 10, color: TB.color.text, strokeWidth: 2.5 })
                      : isCurrent
                        ? react.createElement(
                            'span',
                            { style: { fontSize: 10, fontWeight: 600, fontFamily: TB.font.mono, color: '#FFFFFF' } },
                            i + 1,
                          )
                        : react.createElement(
                            'span',
                            { style: { fontSize: 10, fontWeight: 600, fontFamily: TB.font.mono, color: TB.color.text } },
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
                      fontSize: 10.5,
                      fontWeight: isCurrent ? 600 : 500,
                      color: isCurrent ? TB.color.text : TB.color.textMuted,
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

      // 单一主操作 CTA（状态机）：归档=灰只读块；已激活=黑「推进任务」+ 轻量取消入口；未激活=黑「激活任务」
      const actionControl = archived
        ? react.createElement(
            'div',
            {
              style: {
                width: '100%',
                padding: '10px 12px',
                fontSize: 12,
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
        : react.createElement(
            'div',
            { style: { display: 'flex', flexDirection: 'column', gap: 4, width: '100%' } },
            react.createElement(
              'button',
              {
                type: 'button',
                disabled: busy,
                onClick: active ? () => push(pushPromptFor(task)) : onActivate,
                style: {
                  width: '100%',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 16px',
                  font: 'inherit',
                  fontSize: 12.5,
                  fontWeight: 600,
                  borderRadius: TB.R.ctrl,
                  cursor: busy ? 'not-allowed' : 'pointer',
                  background: TB.color.ink,
                  color: '#FFFFFF',
                  border: '1px solid ' + TB.color.ink,
                  boxShadow: '0 1px 3px rgba(15, 23, 42, 0.2)',
                  opacity: busy ? 0.6 : 1,
                  transition: 'all 0.15s ease',
                },
              },
              active ? renderIcon('sparkles', { size: 12, color: '#93C5FD' }) : null,
              busy ? t('busy') : active ? t('sendToChat') : t('activateCta'),
            ),
            // 轻量取消激活入口（保留 onDeactivate 能力，design-review 并入项）
            active && !busy
              ? react.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: onDeactivate,
                    style: {
                      alignSelf: 'center',
                      background: 'none',
                      border: 'none',
                      padding: '2px 4px',
                      font: 'inherit',
                      fontSize: 11,
                      fontWeight: 500,
                      color: TB.color.textMuted,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    },
                  },
                  t('deactivate'),
                )
              : null,
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
            react.createElement('span', { style: { fontSize: 11.5, fontWeight: 600, color: TB.color.textMuted } }, t('detailsTitle')),
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
            { style: { fontSize: 16, fontWeight: 600, lineHeight: '22px', color: TB.color.text, marginTop: 2 } },
            task.title,
          ),
          react.createElement(
            'div',
            { style: { fontSize: 11, color: TB.color.textMuted, fontFamily: TB.font.mono } },
            task.slug,
          ),
        ),

        // 主操作按钮区（单一黑 CTA 状态机）
        react.createElement(
          'div',
          { style: { display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 } },
          actionControl,
          notice
            ? react.createElement(
                'div',
                {
                  style: {
                    marginTop: 2,
                    fontSize: 11,
                    fontWeight: 500,
                    color: notice === 'ok' ? TB.color.successText : TB.color.warnText,
                    textAlign: 'center',
                  },
                },
                notice === 'ok'
                  ? t('sendToChatSuccess')
                  : notice === 'open-fail'
                    ? t('openFailed')
                    : t('sendToChatFailed'),
              )
            : null,
        ),

        // 阶段流水线
        stageFlow
          ? react.createElement(
              'div',
              { style: { marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 } },
              react.createElement('span', { style: { fontSize: 13, fontWeight: 600, color: TB.color.text } }, t('pipelineTitle')),
              stageFlow,
            )
          : null,

        // 产物
        react.createElement(
          'div',
          { style: { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 6 } },
          react.createElement('span', { style: { fontSize: 13.5, fontWeight: 600, color: TB.color.text } }, t('metaArtifacts')),
          artifacts.length === 0
            ? react.createElement('div', { style: { fontSize: 11.5, color: TB.color.textMuted, padding: '6px 0' } }, t('noArtifacts'))
            : react.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', paddingRight: 2 } },
                artifacts.map((name) =>
                  react.createElement(
                    'div',
                    {
                      key: name,
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 6px',
                        borderBottom: '1px solid ' + TB.color.border,
                      },
                    },
                    renderIcon('fileText', { size: 16, color: TB.color.textMuted }),
                    react.createElement(
                      'span',
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                          fontSize: 11.5,
                          fontFamily: TB.font.mono,
                          color: TB.color.textSecondary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                        title: name,
                      },
                      name,
                    ),
                    react.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: () => {
                          const token = artifactToken(task, name);
                          const opened = onOpenArtifact ? onOpenArtifact(token) : false;
                          // Notice only on failure: a successful native open is
                          // visible in the right sidebar already, so no toast.
                          setNotice(opened ? null : 'open-fail');
                        },
                        title: t('open') + ' ' + artifactToken(task, name),
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: TB.color.textSecondary,
                          background: TB.color.surface,
                          border: '1px solid ' + TB.color.borderStrong,
                          cursor: 'pointer',
                          padding: '4px 10px',
                          borderRadius: TB.R.ctrl,
                          flex: 'none',
                          transition: 'all 0.15s ease',
                        },
                      },
                      renderIcon('externalLink', { size: 11, color: TB.color.textSecondary }),
                      t('open'),
                    ),
                  ),
                ),
              ),
        ),

        // 执行步骤（简行清单：计数标题 + 进度条 + 完成说明 + 圆图标行）
        react.createElement(
          'div',
          { style: { marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 } },
          totalSteps > 0
            ? react.createElement(
                'span',
                { style: { fontSize: 16, fontWeight: 600, color: TB.color.text } },
                completedSteps + '/' + totalSteps + ' ' + t('stepsUnit'),
              )
            : null,
          totalSteps > 0
            ? react.createElement(
                'div',
                { style: { height: 5, width: '100%', borderRadius: TB.R.pill, background: TB.color.surfaceHover, overflow: 'hidden' } },
                react.createElement('div', {
                  style: {
                    height: '100%',
                    width: pct + '%',
                    borderRadius: TB.R.pill,
                    background: pct === 100 ? TB.color.success : TB.color.brandBar,
                    transition: 'width 0.25s ease',
                  },
                }),
              )
            : null,
          totalSteps > 0
            ? react.createElement(
                'span',
                { style: { fontSize: 11.5, color: TB.color.textMuted } },
                t('stepsDoneCaption').replace('{n}', String(completedSteps)).replace('{m}', String(totalSteps)),
              )
            : null,
          Array.isArray(task.steps) && task.steps.length > 0
            ? react.createElement(
                'div',
                { style: { display: 'flex', flexDirection: 'column', marginTop: 4, paddingRight: 2 } },
                task.steps.map((st, idx) => {
                  const isDone = st.status === 'completed';
                  const isInProgress = st.status === 'in_progress';
                  const isVerifying = st.status === 'verifying';
                  const isBlocked = st.status === 'blocked';
                  const stepTitleText = formatStepTitle(st, idx);
                  const badgeText = isDone
                    ? t('stepCompleted')
                    : isInProgress
                      ? t('stepInProgress')
                      : isVerifying
                        ? t('pendingVerification')
                        : isBlocked
                          ? t('blocked')
                          : t('stepPending');
                  const desc = formatStepDesc(st, isInProgress, isDone);

                  const circleBg = isDone
                    ? TB.color.brand
                    : isInProgress
                      ? TB.color.surface
                      : isBlocked
                        ? TB.color.danger
                        : isVerifying
                          ? TB.color.warn
                          : TB.color.surface;
                  const circleBorder = isDone
                    ? 'none'
                    : isInProgress
                      ? '2px solid ' + TB.color.brand
                      : isBlocked
                        ? 'none'
                        : isVerifying
                          ? 'none'
                          : '1.5px solid ' + TB.color.borderStrong;
                  const circleIcon = isDone
                    ? renderIcon('check', { size: 9, color: '#FFFFFF', strokeWidth: 2.5 })
                    : isInProgress
                      ? react.createElement('span', { style: { width: 5, height: 5, borderRadius: '50%', background: TB.color.brand } })
                      : isBlocked
                        ? renderIcon('alertTriangle', { size: 9, color: '#FFFFFF' })
                        : isVerifying
                          ? renderIcon('clock', { size: 9, color: '#FFFFFF' })
                          : null;
                  const tooltip =
                    badgeText +
                    (st.blockedReason ? '：' + st.blockedReason : '') +
                    (desc && desc.text ? '；' + desc.text : '');
                  return react.createElement(
                    'div',
                    {
                      key: st.id || idx,
                      title: tooltip,
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 0',
                        borderBottom: '1px solid ' + TB.color.border,
                      },
                    },
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
                          background: circleBg,
                          border: circleBorder,
                          boxSizing: 'border-box',
                        },
                      },
                      circleIcon,
                    ),
                    react.createElement(
                      'span',
                      {
                        style: {
                          flex: 1,
                          minWidth: 0,
                          fontSize: 12.5,
                          fontWeight: isInProgress ? 600 : 500,
                          color: isInProgress ? TB.color.brandText : TB.color.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      },
                      stepTitleText,
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
      const filterChip = (value, label) => {
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
              padding: '7px 14px',
              margin: 0,
              borderRadius: TB.R.ctrl,
              cursor: 'pointer',
              background: isSelected ? TB.color.ink : TB.color.surface,
              color: isSelected ? '#FFFFFF' : TB.color.textSecondary,
              border: isSelected ? '1px solid ' + TB.color.ink : '1px solid ' + TB.color.borderStrong,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: isSelected ? '0 1px 3px rgba(15, 23, 42, 0.15)' : 'none',
              transition: 'all 0.15s ease',
            },
          },
          label,
        );
      };

      return react.createElement(
        'div',
        { style: KANBAN_BODY_STYLE },
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
            gap: 7,
            width: '100%',
            textAlign: 'left',
            font: 'inherit',
            padding: '14px 16px',
            margin: '0 0 12px 0',
            borderRadius: TB.R.card,
            cursor: 'pointer',
            background: selected ? TB.color.selectBg : TB.color.surface,
            border: selected ? '1px solid ' + TB.color.brand : '1px solid ' + TB.color.border,
            boxShadow: TB.S.card,
            transition: 'all 0.15s ease',
          },
        },
        selected
          ? react.createElement('span', {
              title: '选中任务',
              style: {
                position: 'absolute',
                top: '50%',
                right: 10,
                transform: 'translateY(-50%)',
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
        ),
        react.createElement(
          'span',
          {
            style: {
              fontSize: 13.5,
              fontWeight: 600,
              lineHeight: '19px',
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
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              },
            },
            react.createElement(
              'div',
              {
                style: {
                  flex: 1,
                  height: 5,
                  borderRadius: TB.R.pill,
                  background: isCompleted ? TB.color.successSoft : TB.color.surfaceHover,
                  overflow: 'hidden',
                },
              },
              react.createElement('div', {
                style: {
                  height: '100%',
                  width: pct + '%',
                  borderRadius: TB.R.pill,
                  background: isCompleted ? TB.color.success : TB.color.brandBar,
                  transition: 'width 0.2s ease',
                },
              }),
            ),
            // 右槽：未完成→步骤文本同行右对齐；完成→绿色圆环勾
            isCompleted
              ? react.createElement(
                  'span',
                  {
                    style: {
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      border: '2px solid ' + TB.color.ring,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 'none',
                    },
                  },
                  renderIcon('check', { size: 11, color: TB.color.success }),
                )
              : react.createElement(
                  'span',
                  {
                    style: {
                      fontSize: 10.5,
                      color: TB.color.textMuted,
                      whiteSpace: 'nowrap',
                      flex: 'none',
                    },
                  },
                  completedSteps + '/' + totalSteps + ' ' + t('stepsUnit'),
                ),
          ),
          // 完成卡：进度条下左对齐显示步骤文本
          isCompleted
            ? react.createElement(
                'div',
                {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 10.5,
                    color: TB.color.textMuted,
                  },
                },
                completedSteps + '/' + totalSteps + ' ' + t('stepsUnit'),
              )
            : null,
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
        sessionId,
        selected,
        onSelect,
        busy,
        onActivate,
        onDeactivate,
        filter,
        onFilterChange,
        onClose,
        initialViewMode,
        onOpenArtifact,
      } = props;
      const [query, setQuery] = react.useState('');
      const [viewMode, setViewMode] = react.useState(initialViewMode === 'list' ? 'list' : 'lanes'); // 'lanes' | 'list'

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

      const filterChip = (value, label) => {
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
              padding: '7px 14px',
              margin: 0,
              borderRadius: TB.R.ctrl,
              cursor: 'pointer',
              background: isSelected ? TB.color.ink : TB.color.surface,
              color: isSelected ? '#FFFFFF' : TB.color.textSecondary,
              border: isSelected ? '1px solid ' + TB.color.ink : '1px solid ' + TB.color.borderStrong,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              boxShadow: isSelected ? '0 1px 3px rgba(15, 23, 42, 0.15)' : 'none',
              transition: 'all 0.15s ease',
            },
          },
          label,
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
                padding: '13px 16px',
                borderBottom: '1px solid ' + TB.color.border,
                background: TB.color.surfaceMuted,
                flex: 'none',
              },
            },
            react.createElement('span', { style: { fontSize: 14, fontWeight: 600, color: TB.color.text } }, title),
            react.createElement(
              'span',
              {
                style: {
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '1px 7px',
                  borderRadius: TB.R.pill,
                  background: TB.color.chipBg,
                  color: TB.color.chipText,
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
                padding: 12,
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
                  height: 56,
                  minHeight: 56,
                  padding: '0 14px',
                  borderRadius: TB.R.ctrl,
                  cursor: 'pointer',
                  textAlign: 'left',
                  font: 'inherit',
                  background: isSelected ? TB.color.selectBg : 'transparent',
                  border: isSelected ? '1px solid ' + TB.color.brand : '1px solid transparent',
                  borderBottom: isSelected ? '1px solid ' + TB.color.brand : '1px solid ' + TB.color.border,
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
                    fontSize: 14,
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
                task.stage ? stageDisplayName(task.stage) + '（' + task.stage + '）' : '—',
              ),
              totalSteps > 0
                ? react.createElement(
                    'span',
                    {
                      style: {
                        flex: 'none',
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: TB.R.badge,
                        color: hasBlocked
                          ? TB.color.dangerText
                          : hasPendingVerification
                            ? TB.color.warnText
                            : TB.color.chipText,
                        background: TB.color.chipBg,
                        border: '1px solid ' + TB.color.border,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        whiteSpace: 'nowrap',
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
                justifyContent: 'flex-start',
                padding: '20px 24px',
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
                  width: 300,
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
              { style: { display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' } },
              react.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'center', gap: 8 } },
                // 左：'工作台' 静态标签（恒中性、不可点，效果图两态均如此）
                react.createElement(
                  'span',
                  {
                    style: {
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: 500,
                      lineHeight: '16px',
                      padding: '7px 12px',
                      borderRadius: TB.R.ctrl,
                      background: TB.color.surface,
                      color: TB.color.textSecondary,
                      border: '1px solid ' + TB.color.borderStrong,
                      whiteSpace: 'nowrap',
                      cursor: 'default',
                    },
                  },
                  t('viewLanes'),
                ),
                // 右：黑底按钮 = 当前模式名（看板/列表），点击切换
                react.createElement(
                  'button',
                  {
                    type: 'button',
                    onClick: () => setViewMode(viewMode === 'lanes' ? 'list' : 'lanes'),
                    style: {
                      font: 'inherit',
                      fontSize: 12,
                      fontWeight: 600,
                      lineHeight: '16px',
                      padding: '7px 12px',
                      borderRadius: TB.R.ctrl,
                      background: TB.color.ink,
                      color: '#FFFFFF',
                      border: '1px solid ' + TB.color.ink,
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    },
                  },
                  viewMode === 'lanes' ? t('viewBoard') : t('viewList'),
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
                    width: 34,
                    height: 34,
                    cursor: 'pointer',
                    color: TB.color.textSecondary,
                    background: 'transparent',
                    border: 'none',
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
              onOpenArtifact: (token) => openArtifactFile(clientCtx, sessionId, token),
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
                // 筛选药丸移入头部（效果图 2：标题后、图标前，无计数）
                react.createElement(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 6 } },
                  [
                    ['all', t('filterAll')],
                    ['feat', t('filterFeat')],
                    ['issue', t('filterIssue')],
                    ['refactor', t('filterRefactor')],
                  ].map(([value, label]) => {
                    const isSelected = filter === value;
                    return react.createElement(
                      'button',
                      {
                        key: value,
                        type: 'button',
                        onClick: () => setFilter(isSelected ? 'all' : value),
                        style: {
                          font: 'inherit',
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 500,
                          lineHeight: '16px',
                          padding: '4px 10px',
                          margin: 0,
                          borderRadius: TB.R.ctrl,
                          cursor: 'pointer',
                          background: isSelected ? TB.color.ink : TB.color.surface,
                          color: isSelected ? '#FFFFFF' : TB.color.textSecondary,
                          border: isSelected ? '1px solid ' + TB.color.ink : '1px solid ' + TB.color.borderStrong,
                          whiteSpace: 'nowrap',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                        },
                      },
                      label,
                    );
                  }),
                ),
                react.createElement(
                  'div',
                  { style: { display: 'flex', alignItems: 'center', gap: 10 } },
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
                  react.createElement(
                    'button',
                    {
                      type: 'button',
                      title: t('closeLabel'),
                      'aria-label': t('closeLabel'),
                      onClick: () => {
                        // 清空 board：重开必拉新，避免删刷新按钮后的陈旧数据路径
                        setBoard(null);
                        setOpen(false);
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
                    renderIcon('close', { size: 12 }),
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
            sessionId,
            selected,
            onSelect: setSelected,
            busy,
            onActivate: bind,
            onDeactivate: () => bind(null),
            filter,
            onFilterChange: setFilter,
            onClose: closeExpanded,
            onOpenArtifact: (token) => openArtifactFile(clientCtx, sessionId, token),
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
      clientCtx = ctx;
      ctx.effect(() => ctx.locale.register(LOCALE_NS, { zh, en }), 'trellis-workflow: dictionaries');
      const t = ctx.locale.bind(LOCALE_NS);
      // The entry's configuration on the Plugins page: staged edits over the
      // shared `configForms` form, registered under the row key that page
      // dispatches for this bundle's `trellis-workflow` row. The controller
      // resolves the entry's (possibly namespaced) id from the describe mirror
      // itself, so the card also works when the Host has not served it yet.
      const controller = new TrellisConfigController(ctx.configForms);
      ctx.effect(() => () => controller.dispose(), 'trellis-workflow: config form');
      ctx.slots.inject('plugins.row.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.row.config',
            key: ROW_CONFIG_KEY,
            locale: LOCALE_NS,
            inject: () => controller.inject(),
          },
          TrellisConfigCard,
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

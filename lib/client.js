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
      noTasks: '暂无任务',
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
      noSteps: '暂无执行步骤',
      stepCompleted: '已完成',
      stepInProgress: '进行中',
      stepPending: '未开始',
      closeLabel: '关闭',
      currentTag: '当前',
      chipPick: '选择任务',
      chipRetry: '重试',
      noActiveTasks: '暂无其他未完成任务',
      boardFailedText: '看板加载失败',
      currentSessionTask: '当前会话任务',
      currentSession: '当前会话',
      noCurrentTask: '尚未绑定任务，从下面选一个',
      unbind: '解除绑定',
      archivedCount: '已归档 {n}',
      hintSelect: '选择',
      hintBind: '绑定',
      boardTitleShort: '任务',
      stepsTitle: '步骤',
      stepsFolded: '已完成 {n} 个步骤',
      stepsExpandAll: '展开全部 {n} 个步骤',
      stepsCollapse: '收起',
      acceptanceLabel: '验收',
      humanTag: '人工',
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
      noTasks: 'No tasks',
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
      noSteps: 'No execution steps',
      stepCompleted: 'Completed',
      stepInProgress: 'In Progress',
      stepPending: 'Pending',
      closeLabel: 'Close',
      currentTag: 'Current',
      chipPick: 'Pick a task',
      chipRetry: 'Retry',
      noActiveTasks: 'No other open tasks',
      boardFailedText: 'Could not load the board',
      currentSessionTask: 'This session’s task',
      currentSession: 'This session',
      noCurrentTask: 'No task bound — pick one below',
      unbind: 'Unbind',
      archivedCount: 'Archived {n}',
      hintSelect: 'Select',
      hintBind: 'Bind',
      boardTitleShort: 'Tasks',
      stepsTitle: 'Steps',
      stepsFolded: '{n} steps completed',
      stepsExpandAll: 'Show all {n} steps',
      stepsCollapse: 'Collapse',
      acceptanceLabel: 'Acceptance',
      humanTag: 'Human',
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
        // Stroke-only triangle: renderIcon hardcodes fill:'none' on baseProps,
        // so a filled polygon would render invisible here.
        case 'play':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('path', { d: 'M7 4.5v15l13-7.5-13-7.5Z' }),
          );
        // Stop glyph for "clear this session's active task" (stroke square, so
        // it inherits the same fill:'none' treatment as every other icon).
        case 'stop':
          return react.createElement(
            'svg',
            baseProps,
            react.createElement('rect', { x: 6, y: 6, width: 12, height: 12, rx: 2.5 }),
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
    //
    // Design v2 (feat-10-21, prototype variant A "quiet list · current task on
    // top"): one accent color, type as plain text, two-line rows, actions on
    // hover, steps kept visible. See the task's design.md for the full spec.

    var TB = {
      color: {
        // Real host tokens only (no bg-layer-0); fallbacks are the standalone light palette.
        surface: 'var(--dsw-alias-bg-base, #FFFFFF)',
        surfaceRaised: 'var(--dsw-alias-bg-layer-1, #FFFFFF)',
        text: 'var(--dsw-alias-label-primary, #0F172A)',
        textSecondary: 'var(--dsw-alias-label-secondary, #475569)',
        textMuted: 'color-mix(in srgb, var(--dsw-alias-label-tertiary, #64748B) 70%, var(--dsw-alias-label-primary, #0F172A))',
        border: 'var(--dsw-alias-border-l1, #E2E8F0)',
        borderStrong: 'var(--dsw-alias-border-l2, #CBD5E1)',
        brand: 'var(--dsw-alias-state-business-primary, #185DDD)',
        success: 'var(--dsw-alias-state-success-primary, #3BAF62)',
        warn: 'var(--dsw-alias-state-warn-primary, #F59E0B)',
        danger: 'var(--dsw-alias-state-error-primary, #EF4444)',
        // Accent fills are not text colors: labels mix toward the foreground.
        brandText: 'color-mix(in srgb, var(--dsw-alias-state-business-primary, #185DDD) 55%, var(--dsw-alias-label-primary, #0F172A))',
        warnText: 'color-mix(in srgb, var(--dsw-alias-state-warn-primary, #F59E0B) 50%, var(--dsw-alias-label-primary, #0F172A))',
        dangerText: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #EF4444) 55%, var(--dsw-alias-label-primary, #0F172A))',
        // Fixed deep blue paired with white glyphs (spec 23: explicit pair).
        brandSolid: '#185DDD',
        // Quiet surfaces.
        well: 'color-mix(in srgb, var(--dsw-alias-label-primary, #0F172A) 4%, var(--dsw-alias-bg-base, #FFFFFF))',
        hover: 'color-mix(in srgb, var(--dsw-alias-label-primary, #0F172A) 5%, transparent)',
        // Selected table row in the expanded board (the one tinted selection).
        brandTint: 'color-mix(in srgb, var(--dsw-alias-state-business-primary, #185DDD) 9%, transparent)',
        track: 'color-mix(in srgb, var(--dsw-alias-label-primary, #0F172A) 9%, transparent)',
        brandHalf: 'color-mix(in srgb, var(--dsw-alias-state-business-primary, #185DDD) 45%, transparent)',
      },
      R: { popover: '14px', modal: '16px', card: '12px', row: '9px', ctrl: '8px', pill: '9999px' },
      S: {
        popover: '0 0 0 1px var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.1)), 0 24px 56px -12px rgba(0, 0, 0, 0.28)',
        modal: '0 0 0 1px var(--dsw-alias-border-l2, rgba(15, 23, 42, 0.1)), 0 32px 80px -16px rgba(0, 0, 0, 0.35)',
        inset: '0 0 0 1px var(--dsw-alias-border-l1, rgba(15, 23, 42, 0.06))',
      },
      font: {
        mono: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace',
      },
    };

    const isRunning = (task) => task.phase === 'in_progress' || task.phase === 'in_progress-inline';
    const isPlanning = (task) => task.phase === 'planning' || task.phase === 'planning-inline';
    const isDone = (task) => task.phase === 'completed' || task.archived === true || task.status === 'completed';

    /** Phase color for status dots: blue running, green done, hollow gray planning. */
    function phaseDotColor(phase) {
      if (phase === 'in_progress' || phase === 'in_progress-inline') return TB.color.brand;
      if (phase === 'completed') return TB.color.success;
      return TB.color.textMuted;
    }
    function taskPct(task) {
      if (isDone(task)) return 100;
      const total = task.totalSteps || 0;
      return total > 0 ? Math.min(100, Math.round(((task.completedSteps || 0) / total) * 100)) : 0;
    }

    function taskTypeLabel(workType, t) {
      const key = workType && workType[0].toUpperCase() + workType.slice(1);
      const localized = key && t('workType' + key);
      return localized && localized !== 'workType' + key ? localized : workType || '';
    }

    /**
     * Scoped interaction sheet. Inline styles keep structure and theme colors
     * (the contrast tests read them); this sheet only layers pseudo-classes,
     * reveal-on-hover, transitions and keyframes on `.tw-*` classes. Hover
     * fills use !important so they win over inline `transparent`. Idempotent;
     * a no-op without a DOM (tests).
     */
    const TW_STYLE_ID = 'trellis-kanban-styles';
    const TW_CSS = `
      .tw-focus:focus { outline: none; }
      .tw-focus:focus-visible { outline: 2px solid ${TB.color.brand}; outline-offset: 2px; }
      .tw-list:focus, .tw-list:focus-visible { outline: none; }
      .tw-row, .tw-tr, .tw-icon-btn, .tw-chip, .tw-ghost, .tw-art, .tw-tab { transition: background-color .12s ease, color .12s ease, opacity .12s ease; }
      .tw-row:hover, .tw-row[data-selected="true"], .tw-list:focus-visible .tw-row[data-selected="true"] { background: ${TB.color.hover} !important; }
      .tw-row .tw-go { opacity: 0; }
      .tw-row:hover .tw-go, .tw-row[data-selected="true"] .tw-go, .tw-go:focus-visible { opacity: 1; }
      .tw-go:not(:disabled):hover { background: color-mix(in srgb, ${TB.color.brand} 12%, transparent) !important; }
      .tw-tr:not([data-selected="true"]):hover { background: ${TB.color.hover} !important; }
      .tw-icon-btn:hover, .tw-ghost:not(:disabled):hover, .tw-tab:not([aria-pressed="true"]):hover { background: ${TB.color.hover} !important; color: ${TB.color.text} !important; }
      .tw-chip:hover, .tw-chip[data-open="true"] { background: ${TB.color.hover} !important; color: ${TB.color.text} !important; }
      .tw-chip .tw-chevron { transition: transform .2s ease; }
      .tw-chip[data-open="true"] .tw-chevron { transform: rotate(180deg); }
      .tw-art:hover { background: ${TB.color.hover} !important; color: ${TB.color.text} !important; }
      .tw-art .tw-ext { opacity: 0; } .tw-art:hover .tw-ext, .tw-art:focus-visible .tw-ext { opacity: 1; }
      .tw-primary:not(:disabled):hover { filter: brightness(1.06); }
      .tw-input:focus { box-shadow: inset 0 0 0 1px ${TB.color.brand}, 0 0 0 3px color-mix(in srgb, ${TB.color.brand} 18%, transparent) !important; }
      .tw-pop { animation: tw-pop .16s cubic-bezier(.2,.8,.2,1); transform-origin: top right; }
      .tw-overlay { animation: tw-fade .16s ease; }
      .tw-modal { animation: tw-modal .2s cubic-bezier(.2,.8,.2,1); }
      .tw-live { animation: tw-live 2.4s ease-out infinite; }
      .tw-skeleton { background: linear-gradient(90deg, ${TB.color.well} 0%, ${TB.color.hover} 50%, ${TB.color.well} 100%) !important;
        background-size: 200% 100% !important; animation: tw-shimmer 1.3s linear infinite; }
      @keyframes tw-pop { from { opacity: 0; transform: translateY(-4px) scale(.98); } to { opacity: 1; transform: none; } }
      @keyframes tw-fade { from { opacity: 0; } to { opacity: 1; } }
      @keyframes tw-modal { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } }
      @keyframes tw-live {
        0% { box-shadow: 0 0 0 0 color-mix(in srgb, ${TB.color.brand} 55%, transparent); }
        70%, 100% { box-shadow: 0 0 0 5px color-mix(in srgb, ${TB.color.brand} 0%, transparent); }
      }
      @keyframes tw-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      .tw-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .tw-scroll::-webkit-scrollbar-track { background: transparent; }
      .tw-scroll::-webkit-scrollbar-thumb { background: ${TB.color.borderStrong}; border-radius: 999px; }
      @media (prefers-reduced-motion: reduce) {
        .tw-pop, .tw-overlay, .tw-modal, .tw-live, .tw-skeleton { animation: none !important; }
        .tw-row, .tw-tr, .tw-icon-btn, .tw-chip, .tw-ghost, .tw-art, .tw-tab, .tw-chip .tw-chevron, .tw-go { transition: none !important; }
      }
    `;
    function ensureStyles() {
      if (typeof document === 'undefined' || !document.head) return;
      if (document.getElementById(TW_STYLE_ID)) return;
      const el = document.createElement('style');
      el.id = TW_STYLE_ID;
      el.textContent = TW_CSS;
      document.head.appendChild(el);
    }

    // ---- primitives -------------------------------------------------------

    /** Status dot; `live` adds the breathing halo (session-bound task). */
    function Dot(props) {
      const { color, live, hollow, size } = props;
      const s = size || 6;
      return react.createElement('span', {
        className: live ? 'tw-live' : undefined,
        'aria-hidden': 'true',
        style: {
          width: s,
          height: s,
          borderRadius: '50%',
          flex: 'none',
          boxSizing: 'border-box',
          background: hollow ? 'transparent' : color,
          boxShadow: hollow ? 'inset 0 0 0 1.5px ' + color : undefined,
        },
      });
    }

    /** Thin progress bar (track + fill). */
    function ProgressBar(props) {
      const { pct, done, height, style } = props;
      return react.createElement(
        'span',
        {
          'aria-hidden': 'true',
          style: {
            display: 'block',
            height: height || 3,
            borderRadius: TB.R.pill,
            background: TB.color.track,
            overflow: 'hidden',
            ...(style || {}),
          },
        },
        react.createElement('span', {
          style: {
            display: 'block',
            height: '100%',
            width: (pct || 0) + '%',
            borderRadius: TB.R.pill,
            background: done ? TB.color.success : TB.color.brand,
            transition: 'width .25s ease',
          },
        }),
      );
    }

    /** Inline anomaly flag: blocked > pending verification; null otherwise. */
    function AnomalyFlag(props) {
      const { task, t } = props;
      const blocked = task.hasBlocked === true;
      const verifying = !blocked && task.hasPendingVerification === true;
      if (!blocked && !verifying) return null;
      return react.createElement(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            fontWeight: 600,
            whiteSpace: 'nowrap',
            color: blocked ? TB.color.dangerText : TB.color.warnText,
          },
        },
        renderIcon(blocked ? 'alertTriangle' : 'clock', { size: 11, color: blocked ? TB.color.danger : TB.color.warn, strokeWidth: 2 }),
        blocked ? t('blocked') : t('pendingVerification'),
      );
    }

    /** Square ghost icon button (28px) for headers. */
    function IconButton(props) {
      const { icon, label, onClick, size } = props;
      const box = size || 28;
      return react.createElement(
        'button',
        {
          type: 'button',
          title: label,
          'aria-label': label,
          onClick,
          className: 'tw-icon-btn tw-focus',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: box,
            height: box,
            padding: 0,
            margin: 0,
            cursor: 'pointer',
            color: TB.color.textMuted,
            background: 'transparent',
            border: 'none',
            borderRadius: TB.R.ctrl,
            flex: 'none',
          },
        },
        renderIcon(icon, { size: box > 30 ? 16 : 14 }),
      );
    }

    /** Text button: 'primary' (brand fill), 'ghost' (hairline), 'quiet' (text only). */
    function TextButton(props) {
      const { kind, icon, label, onClick, disabled, ariaLabel, title } = props;
      const primary = kind === 'primary';
      return react.createElement(
        'button',
        {
          type: 'button',
          disabled: !!disabled,
          onClick,
          title,
          'aria-label': ariaLabel,
          className: (primary ? 'tw-primary' : 'tw-ghost') + ' tw-focus',
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            height: 30,
            padding: '0 12px',
            margin: 0,
            font: 'inherit',
            fontSize: 12.5,
            fontWeight: primary ? 600 : 500,
            whiteSpace: 'nowrap',
            borderRadius: TB.R.ctrl,
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            // Primary: fixed deep blue + white label (explicit pair, readable in both themes).
            background: primary ? TB.color.brandSolid : 'transparent',
            color: primary ? '#FFFFFF' : kind === 'ghost' ? TB.color.textSecondary : TB.color.textMuted,
            boxShadow: kind === 'ghost' ? 'inset 0 0 0 1px ' + TB.color.borderStrong : 'none',
          },
        },
        icon ? renderIcon(icon, { size: 13, color: primary ? '#FFFFFF' : 'currentColor' }) : null,
        label,
      );
    }

    /** Keyboard hint chip (e.g. ↑↓, ↵, ⌘K). */
    function Kbd(props) {
      return react.createElement(
        'span',
        {
          'aria-hidden': 'true',
          style: {
            font: '600 10.5px/16px ' + TB.font.mono,
            padding: '0 5px',
            borderRadius: 4,
            color: TB.color.textMuted,
            boxShadow: 'inset 0 0 0 1px ' + TB.color.borderStrong,
            whiteSpace: 'nowrap',
          },
        },
        props.children,
      );
    }

    /** Centered empty / failed state with an icon, message and optional action. */
    function EmptyState(props) {
      const { icon, text, actionLabel, onAction, tone } = props;
      return react.createElement(
        'div',
        {
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: '32px 16px',
            textAlign: 'center',
          },
        },
        react.createElement(
          'span',
          {
            style: {
              width: 40,
              height: 40,
              borderRadius: 12,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: TB.color.well,
            },
          },
          renderIcon(icon, { size: 18, color: tone === 'danger' ? TB.color.danger : TB.color.textMuted }),
        ),
        react.createElement('span', { style: { fontSize: 12.5, color: TB.color.textSecondary } }, text),
        actionLabel ? react.createElement(TextButton, { kind: 'ghost', label: actionLabel, onClick: onAction }) : null,
      );
    }

    /** Shimmering placeholder rows while the board loads. */
    function SkeletonRows() {
      const bar = (w, h) =>
        react.createElement('span', { className: 'tw-skeleton', style: { display: 'block', width: w, height: h, borderRadius: 5, background: TB.color.well } });
      return react.createElement(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 18px 20px' } },
        react.createElement('span', { className: 'tw-skeleton', style: { display: 'block', height: 120, borderRadius: TB.R.card, background: TB.color.well } }),
        [220, 170, 200].map((w, i) =>
          react.createElement(
            'div',
            { key: i, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
            bar(w, 10),
            bar(110, 8),
          ),
        ),
      );
    }

    /** Small "section" label used for groups (进行中 3, 产物, 步骤 …). */
    function SectionLabel(props) {
      const { label, count, style } = props;
      return react.createElement(
        'div',
        {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11.5,
            fontWeight: 600,
            color: TB.color.textMuted,
            ...(style || {}),
          },
        },
        react.createElement('span', null, label),
        typeof count === 'number'
          ? react.createElement('span', { style: { fontWeight: 500, fontVariantNumeric: 'tabular-nums' } }, String(count))
          : null,
        props.children,
      );
    }

    // ---- step list ---------------------------------------------------------

    /**
     * Index of the step to emphasise: the first non-completed step. Display
     * only — the push prompt still uses the host-computed `task.activeStep`.
     */
    function currentStepIndex(steps) {
      return steps.findIndex((st) => st && st.status !== 'completed');
    }

    function stepStatusLabel(status, t) {
      if (status === 'completed') return t('stepCompleted');
      if (status === 'in_progress') return t('stepInProgress');
      if (status === 'verifying') return t('pendingVerification');
      if (status === 'blocked') return t('blocked');
      return t('stepPending');
    }

    function StepIcon(props) {
      const { status, current } = props;
      const base = {
        width: 16,
        height: 16,
        borderRadius: '50%',
        flex: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        position: 'relative',
        zIndex: 1,
        marginTop: 1,
        background: TB.color.surfaceRaised,
      };
      if (status === 'completed') {
        return react.createElement('span', { style: { ...base, background: TB.color.brandSolid } }, renderIcon('check', { size: 10, color: '#FFFFFF', strokeWidth: 3 }));
      }
      if (status === 'blocked') {
        return react.createElement('span', { style: { ...base, boxShadow: 'inset 0 0 0 1.5px ' + TB.color.danger } }, renderIcon('alertTriangle', { size: 9, color: TB.color.danger, strokeWidth: 2.2 }));
      }
      if (status === 'verifying') {
        return react.createElement('span', { style: { ...base, boxShadow: 'inset 0 0 0 1.5px ' + TB.color.warn } }, renderIcon('clock', { size: 9, color: TB.color.warn, strokeWidth: 2.2 }));
      }
      if (current || status === 'in_progress') {
        return react.createElement(
          'span',
          { style: { ...base, boxShadow: 'inset 0 0 0 1.5px ' + TB.color.brand } },
          react.createElement('span', { style: { width: 6, height: 6, borderRadius: '50%', background: TB.color.brand } }),
        );
      }
      return react.createElement('span', { style: { ...base, boxShadow: 'inset 0 0 0 1.5px ' + TB.color.borderStrong } });
    }

    /**
     * Ordered step checklist. The current step is bold, shows its status, and
     * inlines its acceptance criteria (or blocked reason). Human-gated steps
     * carry a tag. `compact` folds earlier completed steps into one summary line
     * (keeping the last completed one for context).
     */
    function StepList(props) {
      const { steps: raw, t, compact } = props;
      const steps = Array.isArray(raw) ? raw.filter((st) => st && typeof st === 'object') : [];
      if (steps.length === 0) {
        return react.createElement('div', { style: { fontSize: 12, color: TB.color.textMuted } }, t('noSteps'));
      }
      const cur = currentStepIndex(steps);
      const keepFrom = compact ? Math.max(0, (cur < 0 ? steps.length : cur) - 1) : 0;
      const folded = compact ? keepFrom : 0;
      const visible = steps.map((st, i) => ({ st, i })).filter(({ i }) => i >= keepFrom);
      const rows = [];
      if (folded > 0) {
        rows.push({ fold: true, key: 'fold' });
      }
      visible.forEach((v) => rows.push(v));

      return react.createElement(
        'ol',
        { style: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' } },
        rows.map((row, ri) => {
          const last = ri === rows.length - 1;
          const connectorDone = row.fold || (row.st && row.st.status === 'completed');
          const connector = last
            ? null
            : react.createElement('span', {
                'aria-hidden': 'true',
                style: {
                  position: 'absolute',
                  left: 7.5,
                  top: 22,
                  bottom: -4,
                  width: 1,
                  background: connectorDone ? TB.color.brandHalf : TB.color.borderStrong,
                },
              });
          if (row.fold) {
            return react.createElement(
              'li',
              { key: 'fold', style: { position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' } },
              connector,
              react.createElement(StepIcon, { status: 'completed' }),
              react.createElement('span', { style: { fontSize: 12, lineHeight: '18px', color: TB.color.textMuted } }, t('stepsFolded').replace('{n}', String(folded))),
            );
          }
          const { st, i } = row;
          const isCur = i === cur;
          const status = st.status || 'pending';
          const human = st.verification === 'human';
          const showStatus = isCur || status === 'blocked' || status === 'verifying';
          const acceptance = Array.isArray(st.acceptance) ? st.acceptance.filter(Boolean) : [];
          const sub = isCur && st.blockedReason
            ? { text: t('blocked') + '：' + st.blockedReason, color: TB.color.dangerText }
            : isCur && acceptance.length > 0
              ? { text: t('acceptanceLabel') + '：' + acceptance.join('；'), color: TB.color.textMuted }
              : null;
          return react.createElement(
            'li',
            {
              key: st.id || i,
              'data-step-current': isCur ? 'true' : undefined,
              style: { position: 'relative', display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' },
            },
            connector,
            react.createElement(StepIcon, { status, current: isCur }),
            react.createElement(
              'div',
              { style: { flex: 1, minWidth: 0 } },
              react.createElement(
                'div',
                { style: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12.5, lineHeight: '18px' } },
                react.createElement('span', { style: { flex: 'none', width: 12, fontSize: 11, color: TB.color.textMuted, fontVariantNumeric: 'tabular-nums' } }, String(i + 1)),
                react.createElement(
                  'span',
                  {
                    title: st.title || '',
                    style: {
                      flex: '0 1 auto',
                      minWidth: 0,
                      color: isCur ? TB.color.text : status === 'completed' ? TB.color.textMuted : TB.color.textSecondary,
                      fontWeight: isCur ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: isCur ? 'normal' : 'nowrap',
                    },
                  },
                  st.title || '—',
                ),
                human
                  ? react.createElement(
                      'span',
                      {
                        style: {
                          flex: 'none',
                          fontSize: 10.5,
                          lineHeight: '16px',
                          padding: '0 5px',
                          borderRadius: 4,
                          color: TB.color.textMuted,
                          boxShadow: 'inset 0 0 0 1px ' + TB.color.borderStrong,
                        },
                      },
                      t('humanTag'),
                    )
                  : null,
                showStatus
                  ? react.createElement(
                      'span',
                      {
                        style: {
                          marginLeft: 'auto',
                          flex: 'none',
                          fontSize: 11,
                          fontWeight: 600,
                          color: status === 'blocked' ? TB.color.dangerText : status === 'verifying' ? TB.color.warnText : TB.color.brandText,
                        },
                      },
                      stepStatusLabel(status, t),
                    )
                  : null,
              ),
              sub
                ? react.createElement('div', { style: { margin: '3px 0 2px 18px', fontSize: 11.5, lineHeight: 1.5, color: sub.color } }, sub.text)
                : null,
            ),
          );
        }),
      );
    }

    // ---- popover: current-task card + grouped rows -------------------------

    /**
     * Current-session task card (popover top). Shows type · stage, title,
     * progress, the step checklist (compact by default) and the two actions:
     * push to chat (primary) and clear binding.
     */
    function CurrentTaskCard(props) {
      const { task, t, busy, onDeactivate, stepsOpen, onToggleSteps } = props;
      const [notice, setNotice] = react.useState(null);
      react.useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), 2600);
        return () => clearTimeout(timer);
      }, [notice]);
      const steps = Array.isArray(task.steps) ? task.steps : [];
      const total = task.totalSteps || 0;
      const running = isRunning(task);
      return react.createElement(
        'div',
        {
          'data-current-card': 'true',
          style: {
            margin: '0 10px',
            padding: '14px 14px 12px',
            borderRadius: TB.R.card,
            background: TB.color.well,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          },
        },
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: TB.color.textMuted } },
          react.createElement(
            'span',
            { style: { display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: running ? TB.color.brandText : TB.color.textSecondary } },
            react.createElement(Dot, { color: phaseDotColor(task.phase), live: running, hollow: isPlanning(task) }),
            running ? t('phaseInProgress') : isPlanning(task) ? t('phasePlanning') : t('phaseCompleted'),
          ),
          react.createElement('span', null, [taskTypeLabel(task.workType, t), task.stage ? stageDisplayName(task.stage) : ''].filter(Boolean).join(' · ')),
          react.createElement('span', { style: { flex: 1 } }),
          react.createElement(AnomalyFlag, { task, t }),
        ),
        react.createElement(
          'div',
          { title: task.slug, style: { fontSize: 14.5, fontWeight: 600, lineHeight: 1.35, color: TB.color.text } },
          task.title,
        ),
        total > 0
          ? react.createElement(
              'div',
              { style: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 11.5, color: TB.color.textSecondary } },
              react.createElement(ProgressBar, { pct: taskPct(task), done: isDone(task), style: { flex: 1 } }),
              react.createElement('span', { style: { fontVariantNumeric: 'tabular-nums' } }, (task.completedSteps || 0) + '/' + total + ' ' + t('stepsUnit')),
            )
          : null,
        steps.length > 0
          ? react.createElement(
              'div',
              {
                className: 'tw-scroll',
                style: {
                  padding: '8px 12px',
                  margin: '0 -4px',
                  borderRadius: 10,
                  background: TB.color.surfaceRaised,
                  boxShadow: TB.S.inset,
                  maxHeight: 260,
                  overflowY: 'auto',
                },
              },
              react.createElement(StepList, { steps, t, compact: !stepsOpen }),
              steps.length > 3
                ? react.createElement(
                    'button',
                    {
                      type: 'button',
                      onClick: onToggleSteps,
                      'aria-expanded': !!stepsOpen,
                      className: 'tw-ghost tw-focus',
                      style: {
                        margin: '2px 0 0 20px',
                        padding: '2px 6px',
                        border: 'none',
                        borderRadius: 6,
                        background: 'transparent',
                        font: 'inherit',
                        fontSize: 11.5,
                        color: TB.color.textMuted,
                        cursor: 'pointer',
                      },
                    },
                    stepsOpen ? t('stepsCollapse') : t('stepsExpandAll').replace('{n}', String(steps.length)),
                  )
                : null,
            )
          : null,
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 } },
          react.createElement(TextButton, {
            kind: 'primary',
            icon: 'sparkles',
            label: t('sendToChat'),
            disabled: busy,
            onClick: () => setNotice(injectToComposer(pushPromptFor(task)) ? 'ok' : 'fail'),
          }),
          react.createElement(TextButton, {
            kind: 'quiet',
            icon: 'stop',
            label: t('unbind'),
            title: t('deactivate'),
            ariaLabel: t('deactivate') + ': ' + task.title,
            disabled: busy,
            onClick: (event) => {
              if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
              onDeactivate();
            },
          }),
          notice
            ? react.createElement(
                'span',
                { role: 'status', style: { marginLeft: 'auto', fontSize: 11, color: notice === 'ok' ? TB.color.textSecondary : TB.color.warnText } },
                notice === 'ok' ? t('sendToChatSuccess') : t('sendToChatFailed'),
              )
            : null,
        ),
      );
    }

    /**
     * Two-line popover row: title; then `type · stage · x/y · anomaly`. The
     * row is an outer layout box + a select button + one ▶ action (revealed on
     * hover / selection / focus), so the action never nests inside a button.
     */
    function KanbanTaskItem(props) {
      const { task, t, selected, busy, onSelect, onActivate } = props;
      const total = task.totalSteps || 0;
      const meta = [taskTypeLabel(task.workType, t), task.stage ? stageDisplayName(task.stage) : '']
        .concat(total > 0 ? [(task.completedSteps || 0) + '/' + total] : [])
        .filter(Boolean)
        .join(' · ');
      return react.createElement(
        'div',
        {
          className: 'tw-row',
          role: 'listitem',
          'data-selected': selected ? 'true' : 'false',
          'data-slug': task.slug,
          style: {
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            boxSizing: 'border-box',
            borderRadius: TB.R.row,
            background: 'transparent',
          },
        },
        react.createElement(
          'button',
          {
            type: 'button',
            tabIndex: -1,
            onClick: () => onSelect(task.slug),
            title: task.title + ' (' + task.slug + ')',
            'aria-current': selected ? 'true' : undefined,
            style: {
              flex: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'stretch',
              gap: 1,
              padding: '7px 4px 7px 10px',
              margin: 0,
              textAlign: 'left',
              font: 'inherit',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            },
          },
          react.createElement(
            'span',
            {
              style: {
                fontSize: 13,
                fontWeight: 500,
                lineHeight: '18px',
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
            { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, lineHeight: '16px', color: TB.color.textMuted, fontVariantNumeric: 'tabular-nums' } },
            react.createElement('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, meta),
            react.createElement(AnomalyFlag, { task, t }),
          ),
        ),
        react.createElement(
          'button',
          {
            type: 'button',
            disabled: busy,
            title: t('activate'),
            'aria-label': t('activate') + ': ' + task.title,
            className: 'tw-go tw-focus',
            onClick: (event) => {
              if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
              onSelect(task.slug);
              onActivate(task.slug);
            },
            style: {
              flex: 'none',
              width: 28,
              height: 28,
              marginRight: 6,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              borderRadius: 7,
              background: 'transparent',
              border: 'none',
              color: TB.color.brand,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            },
          },
          renderIcon('play', { size: 12, color: TB.color.brand, strokeWidth: 2 }),
        ),
      );
    }

    /**
     * Popover body: current-task card (or a pick-one prompt), then the other
     * open tasks grouped running / planning. Archived tasks are only counted
     * here (the footer opens the full board). ↑/↓ moves the selection across
     * the grouped rows; Enter binds the selected row (only when the list well
     * itself has focus, so Enter on a focused button keeps its own meaning).
     */
    function KanbanBoard(props) {
      const { board, t, selected, onSelect, busy, onActivate, onDeactivate, filter, stepsOpen, onToggleSteps } = props;
      const tasksAll = Array.isArray(board.tasks) ? board.tasks : [];
      const tasks = !filter || filter === 'all' ? tasksAll : tasksAll.filter((task) => task.workType === filter);
      const activeSlug = board.currentTask || null;
      const current = tasksAll.find((task) => task.slug === activeSlug && !isDone(task)) || null;
      const others = tasks.filter((task) => !isDone(task) && task.slug !== activeSlug);
      const running = others.filter(isRunning);
      const planning = others.filter((task) => !isRunning(task));
      const navigable = [...running, ...planning].map((task) => task.slug);

      const onKeyDown = (e) => {
        if (!e || navigable.length === 0) return;
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const i = navigable.indexOf(selected);
          const next = i < 0 ? 0 : e.key === 'ArrowDown' ? Math.min(navigable.length - 1, i + 1) : Math.max(0, i - 1);
          const slug = navigable[next];
          onSelect(slug);
          const host = e.currentTarget;
          const el = host && host.querySelector ? host.querySelector('[data-slug="' + slug + '"]') : null;
          if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
          if (e.target !== e.currentTarget) return;
          if (!busy && selected && navigable.includes(selected)) {
            e.preventDefault();
            onActivate(selected);
          }
        }
      };

      const group = (label, items) =>
        items.length === 0
          ? null
          : react.createElement(
              'div',
              { key: label, style: { display: 'flex', flexDirection: 'column' } },
              react.createElement(SectionLabel, { label, count: items.length, style: { padding: '10px 10px 4px' } }),
              items.map((task) =>
                react.createElement(KanbanTaskItem, {
                  key: task.slug,
                  task,
                  t,
                  selected: selected === task.slug,
                  busy,
                  onSelect,
                  onActivate,
                }),
              ),
            );

      return react.createElement(
        'div',
        { className: 'tw-scroll', style: KANBAN_BODY_STYLE },
        current
          ? react.createElement(CurrentTaskCard, { task: current, t, busy, onDeactivate, stepsOpen, onToggleSteps })
          : react.createElement(
              'div',
              {
                style: {
                  margin: '0 10px',
                  padding: '16px 14px',
                  borderRadius: TB.R.card,
                  background: TB.color.well,
                  fontSize: 12.5,
                  color: TB.color.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                },
              },
              react.createElement(Dot, { color: TB.color.textMuted, hollow: true }),
              t('noCurrentTask'),
            ),
        navigable.length === 0
          ? react.createElement('div', { style: { padding: '18px 20px 8px', fontSize: 12, color: TB.color.textMuted } }, t('noActiveTasks'))
          : react.createElement(
              'div',
              {
                className: 'tw-list',
                tabIndex: 0,
                role: 'list',
                'aria-label': t('kanbanTitle'),
                onKeyDown,
                style: { display: 'flex', flexDirection: 'column', padding: '2px 6px 6px' },
              },
              group(t('colInProgress'), running),
              group(t('colPlanning'), planning),
            ),
      );
    }

    const KANBAN_POPOVER_STYLE = {
      position: 'absolute',
      top: 'calc(100% + 6px)',
      right: 0,
      zIndex: 1000,
      width: 400,
      maxWidth: 'calc(100vw - 32px)',
      maxHeight: 'min(640px, calc(100vh - 60px))',
      display: 'flex',
      flexDirection: 'column',
      background: TB.color.surfaceRaised,
      color: TB.color.text,
      borderRadius: TB.R.popover,
      boxShadow: TB.S.popover,
      textAlign: 'left',
      overflow: 'hidden',
    };

    const KANBAN_HEADER_STYLE = {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '12px 10px 8px 16px',
      flex: 'none',
    };

    const KANBAN_BODY_STYLE = {
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      flex: 1,
      minHeight: 0,
    };

    const KANBAN_FOOTER_STYLE = {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px 10px 10px',
      borderTop: '1px solid ' + TB.color.border,
      fontSize: 11.5,
      color: TB.color.textMuted,
      flex: 'none',
    };

    const KANBAN_MODAL_OVERLAY_STYLE = {
      position: 'fixed',
      inset: 0,
      zIndex: 2000,
      background: 'rgba(8, 10, 14, 0.42)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    };

    const KANBAN_MODAL_STYLE = {
      width: 'min(1280px, calc(100vw - 48px))',
      height: 'min(820px, calc(100vh - 48px))',
      display: 'flex',
      flexDirection: 'column',
      background: TB.color.surfaceRaised,
      color: TB.color.text,
      borderRadius: TB.R.modal,
      boxShadow: TB.S.modal,
      overflow: 'hidden',
    };

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

    /**
     * Expanded-board details pane: meta line, title, slug, primary action by
     * state, stage segments (from board.tracks), full step checklist and
     * artifacts (opened as native file tokens).
     */
    function KanbanDetails(props) {
      const { task, t, active, busy, onActivate, onDeactivate, tracks, onOpenArtifact } = props;
      // One-shot notice: 'ok' | 'fail' | 'open-fail' | null, auto-clears.
      const [notice, setNotice] = react.useState(null);
      react.useEffect(() => {
        if (!notice) return undefined;
        const timer = setTimeout(() => setNotice(null), 2600);
        return () => clearTimeout(timer);
      }, [notice]);
      const push = (text) => setNotice(injectToComposer(text) ? 'ok' : 'fail');

      const pane = {
        flex: 'none',
        width: 360,
        minWidth: 300,
        borderLeft: '1px solid ' + TB.color.border,
        padding: '20px 20px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflowY: 'auto',
        background: TB.color.surfaceRaised,
      };
      if (!task) {
        return react.createElement(
          'aside',
          { style: { ...pane, alignItems: 'center', justifyContent: 'center' } },
          react.createElement(EmptyState, { icon: 'fileText', text: t('selectTaskHint') }),
        );
      }
      const track = (task.workType && tracks && tracks[task.workType] && tracks[task.workType].stages) || null;
      const currentIndex = track ? track.indexOf(task.stage) : -1;
      const archived = isDone(task);
      const total = task.totalSteps || 0;
      const artifacts = Array.isArray(task.artifacts)
        ? task.artifacts.filter((n) => /\.(md|ya?ml|json)$/.test(n || '')).slice(0, 8)
        : [];
      const phaseLabel = archived ? t('phaseCompleted') : isPlanning(task) ? t('phasePlanning') : t('phaseInProgress');

      const actions = archived
        ? react.createElement('span', { style: { fontSize: 12, color: TB.color.textMuted } }, t('archivedReadonly'))
        : active
          ? react.createElement(
              react.Fragment,
              null,
              react.createElement(TextButton, { kind: 'primary', icon: 'sparkles', label: busy ? t('busy') : t('sendToChat'), disabled: busy, onClick: () => push(pushPromptFor(task)) }),
              react.createElement(TextButton, { kind: 'quiet', label: t('unbind'), title: t('deactivate'), disabled: busy, onClick: onDeactivate }),
            )
          : react.createElement(TextButton, { kind: 'primary', icon: 'play', label: busy ? t('busy') : t('activateCta'), disabled: busy, onClick: onActivate });

      return react.createElement(
        'aside',
        { className: 'tw-scroll', style: pane, 'aria-label': t('detailsTitle') },
        react.createElement(
          'div',
          null,
          react.createElement(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: TB.color.textMuted, marginBottom: 8 } },
            react.createElement('span', null, taskTypeLabel(task.workType, t) + ' · ' + phaseLabel),
            active ? react.createElement('span', { style: { color: TB.color.brandText, fontWeight: 600 } }, '· ' + t('currentSession')) : null,
          ),
          react.createElement('div', { style: { fontSize: 16, fontWeight: 600, lineHeight: 1.35, color: TB.color.text } }, task.title),
          react.createElement('div', { style: { marginTop: 4, font: '11.5px ' + TB.font.mono, color: TB.color.textMuted, wordBreak: 'break-all' } }, task.slug),
        ),
        react.createElement(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
          actions,
          notice
            ? react.createElement(
                'span',
                { role: 'status', style: { fontSize: 11, color: notice === 'ok' ? TB.color.textSecondary : TB.color.warnText } },
                notice === 'ok' ? t('sendToChatSuccess') : notice === 'open-fail' ? t('openFailed') : t('sendToChatFailed'),
              )
            : null,
        ),
        track && track.length > 0
          ? react.createElement(
              'div',
              null,
              react.createElement(SectionLabel, { label: t('pipelineTitle'), style: { marginBottom: 8 } }),
              react.createElement(
                'div',
                { style: { display: 'flex', gap: 3 } },
                track.map((stg, i) =>
                  react.createElement('span', {
                    key: stg,
                    'aria-hidden': 'true',
                    style: {
                      flex: 1,
                      height: 4,
                      borderRadius: TB.R.pill,
                      background: archived || (currentIndex >= 0 && i < currentIndex) ? TB.color.brand : i === currentIndex ? TB.color.brandHalf : TB.color.track,
                    },
                  }),
                ),
              ),
              react.createElement(
                'div',
                { style: { display: 'flex', marginTop: 6 } },
                track.map((stg, i) =>
                  react.createElement(
                    'span',
                    {
                      key: stg,
                      title: stageDisplayName(stg) + ' (' + stg + ')',
                      style: {
                        flex: 1,
                        textAlign: i === 0 ? 'left' : i === track.length - 1 ? 'right' : 'center',
                        fontSize: 11,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: i === currentIndex && !archived ? 600 : 400,
                        color: i === currentIndex && !archived ? TB.color.text : TB.color.textMuted,
                      },
                    },
                    stageDisplayName(stg),
                  ),
                ),
              ),
            )
          : null,
        react.createElement(
          'div',
          null,
          react.createElement(
            SectionLabel,
            { label: t('stepsTitle'), style: { marginBottom: 8 } },
            total > 0
              ? react.createElement('span', { style: { fontWeight: 500, fontVariantNumeric: 'tabular-nums' } }, (task.completedSteps || 0) + '/' + total)
              : null,
            total > 0 ? react.createElement(ProgressBar, { pct: taskPct(task), done: archived, style: { flex: 1, marginLeft: 4 } }) : null,
          ),
          react.createElement(StepList, { steps: task.steps, t }),
        ),
        react.createElement(
          'div',
          null,
          react.createElement(SectionLabel, { label: t('metaArtifacts'), style: { marginBottom: 4 } }),
          artifacts.length === 0
            ? react.createElement('div', { style: { fontSize: 12, color: TB.color.textMuted, padding: '4px 0' } }, t('noArtifacts'))
            : artifacts.map((name) =>
                react.createElement(
                  'button',
                  {
                    key: name,
                    type: 'button',
                    className: 'tw-art tw-focus',
                    title: t('open') + ' ' + artifactToken(task, name),
                    onClick: () => {
                      const token = artifactToken(task, name);
                      const opened = onOpenArtifact ? onOpenArtifact(token) : false;
                      // Notice only on failure: a successful native open is visible already.
                      setNotice(opened ? null : 'open-fail');
                    },
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: 'calc(100% + 16px)',
                      margin: '0 -8px',
                      padding: '7px 8px',
                      border: 'none',
                      borderRadius: TB.R.ctrl,
                      background: 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      font: '12px ' + TB.font.mono,
                      color: TB.color.textSecondary,
                    },
                  },
                  renderIcon('fileText', { size: 14, color: TB.color.textMuted }),
                  react.createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, name),
                  react.createElement('span', { className: 'tw-ext', style: { display: 'inline-flex' } }, renderIcon('externalLink', { size: 12, color: TB.color.textMuted })),
                ),
              ),
        ),
      );
    }

    /**
     * Expanded board: type tabs (with counts), live title/slug search, grouped
     * table (running / planning / completed) and the details pane. Rows select
     * only; binding happens from the details pane.
     */
    function KanbanExpandedModal(props) {
      const { board, t, sessionId, selected, onSelect, busy, onActivate, onDeactivate, filter, onFilterChange, onClose } = props;
      const [query, setQuery] = react.useState('');

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

      const frame = (children) =>
        react.createElement(
          'div',
          {
            style: KANBAN_MODAL_OVERLAY_STYLE,
            className: 'tw-overlay',
            onMouseDown: (e) => {
              if (e.target === e.currentTarget) onClose();
            },
          },
          react.createElement(
            'div',
            { className: 'tw-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('kanbanTitle'), style: KANBAN_MODAL_STYLE },
            children,
          ),
        );

      if (!board) return frame(react.createElement(SkeletonRows, null));

      const tasksAll = Array.isArray(board.tasks) ? board.tasks : [];
      const tracks = board.tracks || null;
      const activeSlug = board.currentTask || null;
      const q = query.trim().toLowerCase();
      const matchesQuery = (task) => !q || (task.title || '').toLowerCase().includes(q) || String(task.slug).toLowerCase().includes(q);
      const searched = tasksAll.filter(matchesQuery);
      const tasks = searched.filter((task) => !filter || filter === 'all' || task.workType === filter);
      const selectedTask = tasksAll.find((task) => task.slug === selected) || null;
      const groups = [
        [t('colInProgress'), tasks.filter((task) => !isDone(task) && isRunning(task))],
        [t('colPlanning'), tasks.filter((task) => !isDone(task) && !isRunning(task))],
        [t('colArchive'), tasks.filter(isDone)],
      ];

      const count = (wt) => searched.filter((task) => wt === 'all' || task.workType === wt).length;
      const tab = (value, label) =>
        react.createElement(
          'button',
          {
            key: value,
            type: 'button',
            'aria-pressed': (filter || 'all') === value,
            className: 'tw-tab tw-focus',
            onClick: () => onFilterChange(value),
            style: {
              height: 28,
              padding: '0 10px',
              margin: 0,
              border: 'none',
              borderRadius: 7,
              cursor: 'pointer',
              font: 'inherit',
              fontSize: 12.5,
              fontWeight: (filter || 'all') === value ? 600 : 500,
              color: (filter || 'all') === value ? TB.color.text : TB.color.textMuted,
              background: (filter || 'all') === value ? TB.color.hover : 'transparent',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            },
          },
          label,
          react.createElement('span', { style: { fontWeight: 500, color: TB.color.textMuted, fontVariantNumeric: 'tabular-nums' } }, String(count(value))),
        );

      const row = (task) => {
        const isSelected = selected === task.slug;
        const isActive = activeSlug === task.slug;
        const total = task.totalSteps || 0;
        const done = isDone(task);
        return react.createElement(
          'button',
          {
            key: task.slug,
            type: 'button',
            onClick: () => onSelect(task.slug),
            title: task.title + ' (' + task.slug + ')',
            className: 'tw-tr tw-focus',
            'data-selected': isSelected ? 'true' : 'false',
            'aria-pressed': isSelected,
            style: {
              display: 'grid',
              gridTemplateColumns: '14px minmax(0, 1fr) 56px 56px 120px 64px',
              alignItems: 'center',
              gap: 12,
              width: '100%',
              padding: '9px 10px',
              margin: 0,
              border: 'none',
              borderRadius: TB.R.row,
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
              background: isSelected ? TB.color.brandTint : 'transparent',
            },
          },
          react.createElement(Dot, { color: isActive ? TB.color.brand : phaseDotColor(done ? 'completed' : task.phase), live: isActive, hollow: !isActive && isPlanning(task) }),
          react.createElement(
            'span',
            { style: { minWidth: 0 } },
            react.createElement(
              'span',
              { style: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 } },
              react.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: TB.color.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, task.title),
              isActive ? react.createElement('span', { style: { flex: 'none', fontSize: 11, fontWeight: 600, color: TB.color.brandText } }, t('currentTag')) : null,
            ),
            react.createElement('span', { style: { display: 'block', marginTop: 1, font: '11px ' + TB.font.mono, color: TB.color.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, task.slug),
          ),
          react.createElement('span', { style: { fontSize: 12, color: TB.color.textSecondary } }, taskTypeLabel(task.workType, t)),
          react.createElement('span', { style: { fontSize: 12, color: TB.color.textSecondary } }, task.stage ? stageDisplayName(task.stage) : '—'),
          react.createElement(ProgressBar, { pct: taskPct(task), done }),
          react.createElement(
            'span',
            { style: { display: 'flex', justifyContent: 'flex-end', fontSize: 12, color: TB.color.textMuted, fontVariantNumeric: 'tabular-nums' } },
            !done && (task.hasBlocked === true || task.hasPendingVerification === true)
              ? react.createElement(AnomalyFlag, { task, t })
              : total > 0
                ? (task.completedSteps || 0) + '/' + total
                : '—',
          ),
        );
      };

      return frame([
        react.createElement(
          'div',
          {
            key: 'bar',
            style: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px 12px 20px', borderBottom: '1px solid ' + TB.color.border, flexWrap: 'wrap' },
          },
          react.createElement('strong', { style: { fontSize: 15, fontWeight: 600, color: TB.color.text } }, t('boardTitleShort')),
          react.createElement(
            'div',
            { role: 'group', 'aria-label': t('filterAll'), style: { display: 'flex', gap: 2 } },
            tab('all', t('filterAll')),
            tab('feat', t('filterFeat')),
            tab('issue', t('filterIssue')),
            tab('refactor', t('filterRefactor')),
          ),
          react.createElement(
            'label',
            { style: { marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center' } },
            react.createElement('span', { style: { position: 'absolute', left: 9, display: 'flex', pointerEvents: 'none' } }, renderIcon('search', { size: 14, color: TB.color.textMuted })),
            react.createElement('input', {
              id: 'trellis-kanban-search-input',
              type: 'search',
              className: 'tw-input',
              placeholder: t('searchPlaceholder'),
              'aria-label': t('searchPlaceholder'),
              value: query,
              onChange: (e) => setQuery(e.target.value),
              style: {
                width: 240,
                maxWidth: '40vw',
                height: 30,
                padding: '0 44px 0 30px',
                border: 'none',
                borderRadius: TB.R.ctrl,
                background: TB.color.well,
                color: TB.color.text,
                font: 'inherit',
                fontSize: 12.5,
                outline: 'none',
                boxSizing: 'border-box',
              },
            }),
            react.createElement('span', { style: { position: 'absolute', right: 8, pointerEvents: 'none' } }, react.createElement(Kbd, null, '⌘K')),
          ),
          react.createElement(IconButton, { icon: 'close', label: t('closeLabel'), onClick: onClose }),
        ),
        react.createElement(
          'div',
          { key: 'body', style: { flex: 1, display: 'flex', minHeight: 0 } },
          react.createElement(
            'div',
            { className: 'tw-scroll', role: 'list', style: { flex: 1, minWidth: 0, overflowY: 'auto', padding: '8px 12px 16px' } },
            tasks.length === 0
              ? react.createElement(EmptyState, { icon: 'search', text: t('noTasks') })
              : groups
                  .filter(([, items]) => items.length > 0)
                  .map(([label, items]) =>
                    react.createElement(
                      'div',
                      { key: label },
                      react.createElement(SectionLabel, { label, count: items.length, style: { padding: '14px 10px 6px' } }),
                      items.map(row),
                    ),
                  ),
          ),
          react.createElement(KanbanDetails, {
            task: selectedTask,
            t,
            active: !!(selectedTask && selectedTask.slug === activeSlug),
            busy,
            onActivate: () => selectedTask && onActivate(selectedTask.slug),
            onDeactivate,
            tracks,
            onOpenArtifact: (token) => openArtifactFile(clientCtx, sessionId, token),
          }),
        ),
      ]);
    }

    /**
     * The session-header chip: `● stage title ⌄`. Clicking opens the popover
     * (current-task card + grouped open tasks); the expand icon opens the full
     * board. Binding only ever touches THIS session's pointer file.
     */
    function TaskChip(props) {
      const { sessionId, t } = props;
      const [state, setState] = react.useState({ loading: true, summary: null, failed: false });
      const [open, setOpen] = react.useState(false);
      const [board, setBoard] = react.useState(null);
      const [boardFailed, setBoardFailed] = react.useState(false);
      const [selected, setSelected] = react.useState(null);
      const [busy, setBusy] = react.useState(false);
      // Type filter, shared by the popover (implicit 'all') and the expanded board.
      const [filter, setFilter] = react.useState('all');
      const [stepsOpen, setStepsOpen] = react.useState(false);
      const [expandedBoard, setExpandedBoard] = react.useState(false);
      const rootRef = react.useRef(null);
      // One-shot "open the board when the in-flight summary fetch lands": a
      // click on an unknown-state chip refreshes, and opens the popover if the
      // project turns out to be Trellis-matched, so one click never looks dead.
      const pendingOpenRef = react.useRef(false);
      react.useEffect(() => ensureStyles(), []);

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
            const value = json && json.ok ? json.value : null;
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

      // Hooks before any conditional return (rules of hooks).
      const closeExpanded = react.useCallback(() => setExpandedBoard(false), []);
      const openExpanded = react.useCallback(() => {
        // Expanding always re-fetches so the full view never shows stale data;
        // the modal's null-board guard renders a skeleton while it lands.
        setOpen(false);
        loadBoard();
        setExpandedBoard(true);
      }, [loadBoard]);

      // Workspace not managed by Trellis: render nothing.
      if (!loading && summary && summary.kind === 'no-match') return null;

      // Interactive for ANY Trellis-matched project, with or without an active
      // task: the popover is the entry point to pick and bind a task.
      const interactive = !!(summary && (summary.kind === 'task' || summary.kind === 'no-task'));

      // Chip readout: `● stage title ⌄` (type omitted on purpose — design v2).
      let title = t('chipTitle');
      let dot = react.createElement(Dot, { color: TB.color.textMuted, hollow: true, size: 7 });
      let body = null;
      if (failed) {
        title = t('chipFailed');
        dot = react.createElement(Dot, { color: TB.color.danger, size: 7 });
        body = react.createElement('span', { style: { color: TB.color.dangerText } }, t('chipRetry'));
      } else if (loading && !summary) {
        dot = react.createElement('span', { className: 'tw-skeleton', style: { width: 7, height: 7, borderRadius: '50%', background: TB.color.well, flex: 'none' } });
        body = react.createElement('span', { className: 'tw-skeleton', 'aria-hidden': 'true', style: { width: 96, height: 8, borderRadius: 4, background: TB.color.well } });
      } else if (summary && summary.kind === 'no-task') {
        title = t('chipNoTask');
        body = react.createElement('span', null, t('chipPick'));
      } else if (summary && summary.kind === 'no-summary') {
        title = t('chipNoSummary');
        body = react.createElement('span', null, t('chipRefresh'));
      } else if (summary && summary.kind === 'task') {
        const running = summary.phase === 'in_progress' || summary.phase === 'in_progress-inline';
        dot = react.createElement(Dot, { color: chipPhaseColor(summary.phase), live: running, size: 7, hollow: !running && summary.phase !== 'completed' });
        title = [summary.title, chipTypeLabel(summary, t)].filter(Boolean).join(' — ');
        body = react.createElement(
          react.Fragment,
          null,
          summary.stage ? react.createElement('span', { style: { color: TB.color.textMuted } }, stageDisplayName(summary.stage)) : null,
          summary.title
            ? react.createElement('span', { style: { maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', color: TB.color.text } }, summary.title)
            : null,
        );
      }

      const chipOpen = interactive && (open || expandedBoard);
      const chip = react.createElement(
        'button',
        {
          type: 'button',
          title,
          'aria-label': title,
          'aria-haspopup': interactive ? 'dialog' : undefined,
          'aria-expanded': interactive ? chipOpen : undefined,
          'data-open': chipOpen ? 'true' : 'false',
          className: 'tw-chip tw-focus',
          onClick: () => {
            // While the expanded modal is open the chip closes IT instead of
            // toggling the popover, so the two surfaces never stack.
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
            gap: 8,
            height: 28,
            padding: '0 8px 0 10px',
            margin: 0,
            font: 'inherit',
            fontSize: 12,
            fontWeight: 500,
            lineHeight: '16px',
            color: TB.color.textSecondary,
            background: 'transparent',
            border: 'none',
            borderRadius: TB.R.pill,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          },
        },
        dot,
        body,
        interactive
          ? react.createElement('span', { className: 'tw-chevron', style: { display: 'inline-flex', flex: 'none' } }, renderIcon('chevronDown', { size: 12, color: TB.color.textMuted, strokeWidth: 2 }))
          : null,
      );

      const tasksForCount = board && Array.isArray(board.tasks) ? board.tasks : [];
      const archivedCount = tasksForCount.filter(isDone).length;

      const popover =
        interactive && open
          ? react.createElement(
              'div',
              { style: KANBAN_POPOVER_STYLE, className: 'tw-pop', role: 'dialog', 'aria-label': t('kanbanTitle') },
              react.createElement(
                'div',
                { style: KANBAN_HEADER_STYLE },
                react.createElement(SectionLabel, { label: t('currentSessionTask'), style: { flex: 1 } }),
                react.createElement(IconButton, { icon: 'maximize', label: t('expandBoard'), onClick: openExpanded }),
              ),
              boardFailed
                ? react.createElement(EmptyState, {
                    icon: 'alertTriangle',
                    tone: 'danger',
                    text: t('boardFailedText'),
                    actionLabel: t('chipRetry'),
                    onAction: () => {
                      setBoard(null);
                      setBoardFailed(false);
                      loadBoard();
                    },
                  })
                : !board
                  ? react.createElement(SkeletonRows, null)
                  : react.createElement(KanbanBoard, {
                      board,
                      t,
                      selected,
                      onSelect: setSelected,
                      busy,
                      onActivate: bind,
                      onDeactivate: () => bind(null),
                      filter: 'all',
                      stepsOpen,
                      onToggleSteps: () => setStepsOpen((v) => !v),
                    }),
              board
                ? react.createElement(
                    'div',
                    { style: KANBAN_FOOTER_STYLE },
                    react.createElement(
                      'button',
                      {
                        type: 'button',
                        onClick: openExpanded,
                        className: 'tw-ghost tw-focus',
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          height: 24,
                          padding: '0 6px',
                          border: 'none',
                          borderRadius: 6,
                          background: 'transparent',
                          font: 'inherit',
                          fontSize: 11.5,
                          color: TB.color.textMuted,
                          cursor: 'pointer',
                        },
                      },
                      t('archivedCount').replace('{n}', String(archivedCount)),
                      renderIcon('chevronRight', { size: 12, color: TB.color.textMuted }),
                    ),
                    react.createElement('span', { style: { flex: 1 } }),
                    react.createElement(Kbd, null, '↑↓'),
                    react.createElement('span', null, t('hintSelect')),
                    react.createElement(Kbd, null, '↵'),
                    react.createElement('span', null, t('hintBind')),
                  )
                : null,
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
          })
        : null;

      return react.createElement(
        'div',
        { ref: rootRef, style: { position: 'relative', display: 'inline-flex', alignItems: 'center' } },
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

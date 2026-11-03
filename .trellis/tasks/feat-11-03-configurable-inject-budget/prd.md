# Feature PRD

## 背景

`.trellis/doc.json` 的正文注入已经上线两期（feat-11-02 自定义文档清单、feat-11-03 预算截断注入 + 可视化配置），但**注入预算仍是写死的常量**：

```js
// lib/spec.js
export const MAX_DOC_FILE_BYTES = 8 * 1024 // 单文件 8KB
export const MAX_DOC_TOTAL_BYTES = 32 * 1024 // 合计 32KB
```

由此产生三个现实问题：

1. **不同项目需求差异大**：规范文档多的仓库（多包/多分层）在 32KB 合计预算下大部分文件只能拿到路径标记，注入等于没起作用；小项目又觉得 8KB/文件太多、白烧上下文。
2. **用户无法调，只能改代码**：`planDocBudget()` 直接读模块常量，`renderDocBodies` 的提示词头硬编码「单文件上限 8KB，正文合计上限 32KB」，「项目文档」视图的进度条同源。想调预算必须改源码重新发布。
3. **没有安全边界可依**：如果预算做成纯自由输入，一次误填（例如 100MB）会把每一轮请求的上下文吃掉，成本与稳定性都失控。

因此需要：**注入预算可由用户自定义** —— 插件设置表单给全局默认，「项目文档」视图可就地改本项目预算，项目 `.trellis/doc.json` 持久化该覆盖，同时保留不可越过的安全硬顶。

## 范围

### In Scope

- **单位统一为 KB**：设置字段、视图输入框、`doc.json` 覆盖值都是 KB 整数，与现有 UI 文案（「8KB / 32KB」「将截断至 8KB」）一致；内部按 `KB × 1024` 换算成字节参与 `planDocBudget`，不改变截断算法。
- **全局默认（设置表单）**：新增两个 volatile 数字字段，参与 Plugins 页设置表单的读写、重置与校验：
  - `docFileBudgetKB`，默认 `8`：单文件正文上限（KB）。
  - `docTotalBudgetKB`，默认 `32`：全部正文合计上限（KB）。
- **逐项目覆盖的可视化编辑（「项目文档」视图，新增）**：视图里新增「注入预算」区块，两个 KB 数字输入框（单文件 / 合计）：
  - **留空 = 继承设置页默认**（保存时不写该键）；只填一项即可单独覆盖。
  - 就地校验：必须是正整数且不超过硬顶；非法时该行标红并禁用「保存」，不发起写盘。
  - 改动即触发既有 `preview`（防抖），进度条与「将截断至 NKB」按**草稿预算**实时反映效果。
  - 保存写入 `.trellis/doc.json` 的 `budgets`；两项都留空时**移除**该字段。
  - 每行提示当前回退来源（本项目 `doc.json` / 设置页默认）。
- **逐项目覆盖（`.trellis/doc.json` 契约）**：可选顶层字段 `budgets`，形如 `{ "budgets": { "fileKB": 16, "totalKB": 64 } }`；手写同样生效（视图只是它的编辑器）。
- **优先级**：`doc.json` 的 `budgets` > 设置表单的全局默认 > 内置默认（8 / 32）；两项**各自独立**判定。
- **安全硬顶与下限**：单文件 ≤ `128`（KB）、合计 ≤ `512`（KB）；下限 `1`（KB）。运行时遇到有限正数超界值**夹紧**到边界（不报错、不阻断注入）。
- **手写非法值按「未设置」处理**：`0`、负数、非数字、非有限数一律不生效，回落到下一级来源（`doc.json` 非法 → 用设置默认；设置非法 → 用内置默认 8 / 32）；不影响 `files` 的既有校验，也不使整份配置失效。
- **预算生效范围**：`planDocBudget()` 接受预算参数，`renderDocBodies` 的提示词头动态输出真实生效值（不再硬编码 8KB/32KB），`evaluateDocConfig` / `readDocConfigSnapshot` 返回的 `budget.{fileMax,totalMax}` 为本次生效字节值。
- **一致性**：设置页、视图输入框、`doc.json`、提示词实际注入、视图预览五处的预算数字必须来自同一份解析结果，不允许「设置说 64KB，提示词头还写 32KB」。
- 中英文案与 README（中/英）同步：设置字段说明、视图预算区块、`budgets` 契约、优先级、KB 单位与硬顶边界。

### Out of Scope

- 不改 `files` 白名单语义、`root` 元数据语义、`MIN_DOC_SLICE_BYTES`（512B 最小切片）与截断行边界算法。
- 不做按文件粒度的独立预算、不做按目录/通配符预算、不做按会话或按模型切换预算。
- 不做预算使用统计、告警、历史曲线。
- 不提供「无上限」开关（硬顶始终存在）。
- 不做 KB 到字节的非整数换算（不接受 1.5KB 这类输入）。
- 不把预算写进任务（`task.json`）或按任务切换。

## 验收标准

- [ ] **AC1 设置字段**：Plugins 设置页出现「单文件注入预算（KB）」与「正文合计预算（KB）」两个数字字段，可编辑、可重置；默认值分别显示 8 / 32；保存后下一次 `system-prompt/assemble` 立即使用新值（无需重启）。
- [ ] **AC2 设置生效**：把单文件预算改成 16、合计改成 64 后，同一份 `doc.json` 的注入正文变长（原先被截断到 8KB 的文件变为完整或截断到 16KB），提示词头显示「单文件上限 16KB，正文合计上限 64KB」。
- [ ] **AC3 项目覆盖（手写）**：`.trellis/doc.json` 写 `budgets: { fileKB: 4 }` 时该项目按 4KB 单文件 + 设置页的合计值注入；写 `totalKB` 时同理；未写 `budgets` 的项目行为与此前完全一致。
- [ ] **AC4 视图可编辑**：「项目文档」视图出现「注入预算」两个 KB 输入框；已配置项目显示 `doc.json` 里的值，未配置项目显示占位提示（如「默认 8」）；修改后不点保存也能在进度条/「将截断至 NKB」上看到效果；保存后 `.trellis/doc.json` 出现对应 `budgets` 键，且下一次注入按新预算执行。
- [ ] **AC5 视图校验与留空**：输入 `0`、负数、`abc`、`129`（超单文件硬顶）时该行就地报错且「保存」禁用，不写盘；两项都留空保存后 `budgets` 字段从文件中移除，行为回到设置页默认。
- [ ] **AC6 边界夹紧与回退（运行时兜底）**：手写 `fileKB: 10240` 时实际生效 128KB，`totalKB: 10240` 时生效 512KB；手写 `0` / 负数 / 非数字不崩，按未设置回退到设置默认；设置字段被写成非法值时回退内置 8 / 32。
- [ ] **AC7 五处一致**：同一时刻设置页展示值、视图输入框、`doc.json` 覆盖值、提示词头文案、视图进度条 `usedBytes / totalMax` 相互一致；`evaluateDocConfig` / `readDocConfigSnapshot` 返回的 `budget.fileMax/totalMax` 等于真实注入使用的字节值，预览的「将截断 / 仅保留路径」判定与真实注入一致（含 512B 最小切片边界）。
- [ ] **AC8 缓存正确**：改设置或保存项目预算后，5 秒 TTL 缓存不得让旧预算继续生效。
- [ ] **AC9 兼容**：不写新字段的老配置（插件设置与 `doc.json` 均不写）注入输出与现在逐字节一致；老 `doc.json` 在视图里保存后 `files`/`root` 语义不变；`node --test` 全量通过。
- [ ] **AC10 文档**：README 中英与 `.trellis/spec` 相关约定同步：两个设置字段、视图预算区块、`budgets` 契约与优先级、KB 单位与硬顶边界。

## 约束与风险

- **单一实现**：预算解析与夹紧必须是 `lib/spec.js` 里的一处纯函数，设置页、视图预览、保存、提示词渲染都调它；禁止在 client 端复制一份夹紧逻辑（视图只做「正整数 + ≤硬顶」的就地拦截，权威夹紧在服务端）。
- **写入口安全**：视图保存走既有 `POST API_PREFIX/doc-config`（trust-fence + 会话 cwd → allowlist + sandbox policy + 只写固定相对路径），新增的 `budgets` 只是同一份 `doc.json` 里的一个字段，不得新增第二条写路径。
- **缓存**：`specIndexCache`（`lib/index.js`，root → 渲染文本，TTL 5s + LRU 8）当前只按 root 缓存；预算变化必须失配，否则出现「改了设置 5 秒内没反应」。
- **提示词体积**：预算调大直接放大每轮请求的 prompt 字节数（装配每请求执行一次），硬顶就是防止这条路径被误用；提示词头必须回显真实生效值。
- **单位边界**：KB 是输入单位、字节是计算单位，换算只在一处做；`MIN_DOC_SLICE_BYTES`（512B）与截断行边界仍按字节判断，1KB 下限保证预算永远大于最小切片。
- **settings 投影**：`lib/client.js` 的 `TrellisConfigController` 字段清单、`emptyFormState`、`projection`、表单渲染四处必须同步新增，漏一处该字段就不显示（历史踩坑）。
- **volatile 解包**：新增字段必须标记 `.volatile()` 才能被 Web 表单编辑，消费端经 `effectiveConfig.get()` 读取。
- **`doc.json` 兼容**：`saveProjectDocConfig` 现有 `{ ...existing, ... }` 会保留未知顶层字段；新增的 `budgets` 写/删逻辑必须显式实现并有测试，避免「视图保存后覆盖被抹掉」或「留空仍残留旧值」。
- **测试面广**：`planDocBudget` 与路由载荷变化会牵动 `test/spec.test.js`、`test/doc-config.test.js`、`test/doc-config-route.test.js`、`test/settings*.test.js`、`test/client-doc-config.test.js`、`test/assemble.test.js`，需同步更新而非改断言凑绿。
- **回滚**：预算解析集中在 `lib/spec.js` 一处 + 一个设置字段对 + 视图两个输入框，回滚只需回退单 commit；`doc.json` 新增字段为可选，旧文件无需迁移。

## 相关代码 / 文档

- `lib/spec.js`：`MAX_DOC_FILE_BYTES`、`MAX_DOC_TOTAL_BYTES`、`MIN_DOC_SLICE_BYTES`、`planDocBudget`、`renderDocBodies`、`evaluateDocConfig`、`readDocConfigSnapshot`、`saveProjectDocConfig`、`loadProjectDocConfig`
- `lib/meta.js`：`configShape()`（新增两个 volatile 数字字段）
- `lib/index.js`：`resolveSpecIndex` / `specIndexCache`、`system-prompt/assemble` 处理器、`POST API_PREFIX/doc-config` 路由（draft 增加 `budgets`）
- `lib/client.js`：`TrellisConfigController`（字段注册 + `emptyFormState` + `projection` + 表单渲染）、`DocConfigView`（新增预算编辑区块 + 预算条动态化）、中英 locale 字典
- `test/spec.test.js`、`test/doc-config.test.js`、`test/doc-config-route.test.js`、`test/settings.test.js`、`test/settings-projection.test.js`、`test/client-doc-config.test.js`、`test/assemble.test.js`
- `README.md` / `README_EN.md`、`.trellis/spec/trellis-workflow/**`（若有预算相关约定）

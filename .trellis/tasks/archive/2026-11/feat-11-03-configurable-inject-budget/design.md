# Feature Design

status: approved
execution_lane: standard

## 目标与非目标

### 目标（Goals）

- 注入预算（单文件 / 合计）不再写死：**设置页给全局默认（KB），「项目文档」视图可就地编辑本项目预算并写进 `.trellis/doc.json`**，优先级 `doc.json` > 设置 > 内置 8/32，两项各自独立。
- 预算解析与夹紧收敛到 `lib/spec.js` 的**一个纯函数**，提示词渲染、路由预览、视图预算条与输入框全部消费同一结果。
- 保留安全硬顶（单文件 128KB、合计 512KB）与下限 1KB；手写非法值逐级回退、绝不 throw。

### 非目标（Non-goals）

- 不改 `files` / `root` 语义、`MIN_DOC_SLICE_BYTES`（512B）与行边界截断算法。
- 不做按文件/目录/会话/模型的差异化预算，不做用量统计与告警，不做「无上限」开关，不接受非整数 KB。
- 不新增第二条写盘路径：视图保存仍走既有 `POST /trellis-workflow/api/doc-config`。

## 需求拆解与实现方案

### 涉及模块与边界

| 文件 | 变化 |
|---|---|
| `lib/spec.js` | 常量拆成 `DEFAULT_DOC_BUDGET` / `MAX_*_KB` / `MIN_DOC_BUDGET_KB`；新增纯函数 `resolveDocBudget()` 与 `parseBudgetDraft()`（草稿校验）；`planDocBudget(entries, budget)`、`renderDocBodies`、`evaluateDocConfig`、`readDocConfigSnapshot`、`saveProjectDocConfig`、`resolveSpecIndexInstruction` 接受预算；`loadProjectDocConfig` 解析并透传 `budgets`；提示词头与截断标注动态 KB |
| `lib/meta.js` | `configShape()` 新增 `docFileBudgetKB`、`docTotalBudgetKB`（`.volatile()`，默认 8 / 32） |
| `lib/index.js` | assemble 与 `resolveSpecIndex` 传预算、缓存键含预算；doc-config 路由接受/回传 `budgets` |
| `lib/client.js` | 设置卡片两个数字字段；`DocConfigView` 新增「注入预算」两个 KB 输入框 + 就地校验 + 动态进度条/截断文案；中英 locale |
| `test/*` | 见「验证计划」 |
| `README*.md`、`.trellis/spec/**`（若有） | 字段、`budgets` 契约、优先级、KB 单位与硬顶 |

### 预算解析：唯一实现（`lib/spec.js`）

```js
export const DEFAULT_DOC_FILE_BUDGET_KB = 8
export const DEFAULT_DOC_TOTAL_BUDGET_KB = 32
export const MAX_DOC_FILE_BUDGET_KB = 128
export const MAX_DOC_TOTAL_BUDGET_KB = 512
export const MIN_DOC_BUDGET_KB = 1

/** 内置默认预算（字节），供内部默认参数使用。 */
export const DEFAULT_DOC_BUDGET = Object.freeze({
  fileBytes: DEFAULT_DOC_FILE_BUDGET_KB * 1024,
  totalBytes: DEFAULT_DOC_TOTAL_BUDGET_KB * 1024,
})

const isPosNum = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0
const toBytes = (kb, maxKB) => Math.min(maxKB, Math.max(MIN_DOC_BUDGET_KB, Math.floor(kb))) * 1024

/**
 * 把「设置页默认」与「doc.json 覆盖」合成本次生效的字节预算。
 * 逐项独立：覆盖非法 → 用设置值；设置非法 → 用内置默认；有限正数超界 → 夹紧到硬顶。
 * @param {{ fileKB?: unknown, totalKB?: unknown }} [settings]
 * @param {{ fileKB?: unknown, totalKB?: unknown }} [override]
 * @returns {{ fileBytes: number, totalBytes: number }}
 */
export function resolveDocBudget(settings, override) {
  const s = settings && typeof settings === 'object' ? settings : {}
  const o = override && typeof override === 'object' && !Array.isArray(override) ? override : {}
  const fileKB = isPosNum(o.fileKB) ? o.fileKB : isPosNum(s.fileKB) ? s.fileKB : undefined
  const totalKB = isPosNum(o.totalKB) ? o.totalKB : isPosNum(s.totalKB) ? s.totalKB : undefined
  return {
    fileBytes: toBytes(fileKB ?? DEFAULT_DOC_FILE_BUDGET_KB, MAX_DOC_FILE_BUDGET_KB),
    totalBytes: toBytes(totalKB ?? DEFAULT_DOC_TOTAL_BUDGET_KB, MAX_DOC_TOTAL_BUDGET_KB),
  }
}
```

- **单位换算只在这里**（KB → 字节），下游全部按字节；`MIN_DOC_SLICE_BYTES` 与行边界判断不变。
- `Math.floor` 保证整数 KB；`0 / 负数 / NaN / 字符串 / Infinity` 一律视为未设置。
- 常量处置：删除旧导出 `MAX_DOC_FILE_BYTES` / `MAX_DOC_TOTAL_BYTES`（仅本仓库自用），换为 `DEFAULT_DOC_BUDGET` 与 `MAX_*_KB`，测试同步改名。

### 草稿校验（视图专用，单一实现）

```js
/**
 * 视图草稿里的 budgets 校验：空 = 继承（不写盘），值必须是 ≤ 硬顶的正整数。
 * @param {{ fileKB?: unknown, totalKB?: unknown }} | null | undefined draftBudgets
 * @returns {{ ok: true, budgets: { fileKB?: number, totalKB?: number } }
 *         | { ok: false, errors: { file?: 'bad-number' | 'too-large', total?: ... } }}
 */
export function parseBudgetDraft(draftBudgets)
```

- 输入来源是**字符串**（输入框），所以接受 `''`（空 = 继承）、数字串与数字；`''`/`null`/`undefined` → 该键省略。
- 规则：`^[0-9]+$` 且 `>= 1`；`> MAX_*_KB` → `too-large`；其它 → `bad-number`。
- 与 `resolveDocBudget` 的分工：`parseBudgetDraft` 只服务「用户输入 → 保存」，只报错不夹紧；`resolveDocBudget` 服务「配置 → 生效」，只夹紧不报错。

### 数据流

```text
设置页 docFileBudgetKB / docTotalBudgetKB（settings 服务，volatile）
        │ effectiveConfig.get()
        ├──────────────────────────────► doc-config 路由 read/preview/save（settingsBudget）
        │                                        │
        ▼                                        ▼
system-prompt/assemble ──► resolveSpecIndex(..., settingsBudget)   evaluateDocConfig(draft, settingsBudget)
        │   缓存键 = root + '\0' + 'fileKB:totalKB'                 │  resolveDocBudget(settingsBudget, draft.budgets)
        ▼                                                          ▼
resolveSpecIndexInstruction(..., { budget })               value.budget = { fileMax, totalMax, usedBytes }
        │  loadProjectDocConfig → { files, budgets }                │
        ▼                                                          ▼
resolveDocBudget(budget, config.budgets) ──► renderDocBodies ──► planDocBudget
        │                                                          │
        └─► 提示词头「单文件上限 NKB，正文合计上限 MKB」        └─► 视图进度条 + 「将截断至 NKB」+ 输入框回显
```

### 契约变更

**1）插件配置（`lib/meta.js`）**

```js
docFileBudgetKB: z.number().default(8).volatile(),   // 单文件正文上限（KB）
docTotalBudgetKB: z.number().default(32).volatile(), // 全部正文合计上限（KB）
```

**2）`.trellis/doc.json`（可选顶层字段，视图会写它）**

```jsonc
{
  "files": ["docs/a.md", "docs/b.md"],
  "root": ".trellis/spec",                     // 仍为 Skill 元数据，不参与注入
  "budgets": { "fileKB": 16, "totalKB": 64 }   // 可选；可只写一项；两项都空则删除该字段
}
```

**3）`POST API_PREFIX/doc-config`（draft 增加 `budgets`）**

```jsonc
// 请求（preview / save，read 不变）
{ "sessionId": "…", "action": "preview",
  "root": ".trellis/spec" | null,
  "files": ["…"],
  "budgets": { "fileKB": "16", "totalKB": "" } | null }   // 字符串或数字；空串 = 继承

// 成功响应 value 增加两个字段
{ "ok": true, "value": {
  "state": "configured", "root": "…",
  "files": [{ "path": "…", "bytes": 1234, "status": "full|truncated|over-budget|unreadable" }],
  "budgets": { "fileKB": 16, "totalKB": 64 } | null,   // 磁盘上生效的覆盖（原始 KB）
  "budgetDefaults": { "fileKB": 8, "totalKB": 32 },    // 设置页默认，供占位与上限提示
  "budget": { "fileMax": 16384, "totalMax": 65536, "usedBytes": 0 },
  "legacy": null } }

// 校验失败（新增 budgetErrors，形状与 rootError/details 同风格）
{ "ok": false, "error": "invalid", "rootError": null, "listError": null,
  "budgetErrors": { "file": "too-large" | "bad-number" | null, "total": … | null },
  "details": [] }
```

- 载荷类型不符（`budgets` 既非对象也非 `null`）→ 400 `bad request`，与现有 `root` 的严格形状检查一致。
- 状态码与安全语义不变（403 trust-fence/allowlist、404 会话、400 校验、500 写失败、sandbox → 403）；只回传项目相对路径。

**4）`lib/spec.js` 导出签名（内部 API）**

```js
resolveDocBudget(settings?, override?) -> { fileBytes, totalBytes }
parseBudgetDraft(draftBudgets) -> { ok, budgets } | { ok:false, errors }
planDocBudget(entries, budget = DEFAULT_DOC_BUDGET) -> { usedBytes, entries }   // 形状不变
renderDocBodies(fs, projectRoot, files, { signal, budget = DEFAULT_DOC_BUDGET })
evaluateDocConfig(fs, projectRoot, draft, { signal, budget })        // budget = 设置级 { fileKB, totalKB }
readDocConfigSnapshot(fs, projectRoot, { configPath, signal, budget })
saveProjectDocConfig(fs, projectRoot, draft, { configPath, signal, sandboxPolicy, budget })
resolveSpecIndexInstruction(fs, projectRoot, { configPath, signal, budget })
```

- `planDocBudget` 省略 `budget` 时行为与今天**逐字节一致**（旧用例不改断言也能过）。
- `renderDocBodies` 截断分支判据由 `entry.limit < MAX_DOC_FILE_BYTES` 改为 `entry.limit < budget.fileBytes`；文案 KB 由 `formatKB(bytes)`（整数原样、否则一位小数）生成。
- `evaluateDocConfig` / `saveProjectDocConfig` 的预算来源是**草稿**（`parseBudgetDraft(draft.budgets)`）：通过则 `resolveDocBudget(settingsBudget, parsed.budgets)`；不通过则返回 `budgetErrors`，不写盘。
- `readDocConfigSnapshot` 的 `budgets` 返回磁盘原始 KB（视为展示值，非法值按 `null` 归一），`budget` 返回生效字节。

**写盘逻辑**（`saveProjectDocConfig`）：

```js
const payload = { ...existing, files: evaluation.value.files.map(f => f.path) }
if (root) payload.root = root; else delete payload.root
const budgets = evaluation.value.budgets            // { fileKB?, totalKB? }
if (budgets && (budgets.fileKB || budgets.totalKB)) payload.budgets = budgets
else delete payload.budgets                          // 两项留空 = 移除覆盖
```

### 关键技术选型与取舍

1. **输入用 KB、计算用字节**（用户决定）：设置页、视图输入框、`doc.json` 都是易读的 8/32/64，换算集中在 `resolveDocBudget`。代价：不支持 1.5KB（非目标，512B 最小切片本就在字节层）。
2. **一个优先级解析函数 + 一个草稿校验函数，职责分开**：`resolveDocBudget`（只夹紧不报错，供运行时）与 `parseBudgetDraft`（只报错不夹紧，供 UI 保存）不共用分支逻辑，避免「夹紧值被静默写盘」这类困惑；两者都用同一组 KB 常量。
3. **手写非法值只降级不报错**：与 `lib/spec.js` 全模块 fail-open 风格一致；`files` 的严格校验保持不变（强诊断只针对注入范围）。
4. **缓存键带预算，而不是监听设置变更**：`specIndexCache` 是 5s TTL 的 per-root 文本缓存，键里拼 `fileKB:totalKB`（设置级）即可；视图保存后仍 `specIndexCache.delete(root)`。手改 `doc.json` 的滞后与今天手改 `files` 一致（≤5s），接受。
5. **视图编辑复用既有 preview/save 通道**：草稿里多两个字段，服务端同一份 `evaluateDocConfig` 给出「文件状态 + 预算生效值 + 预算错误」，客户端不复制校验与预算算法；保存后立即 `specIndexCache.delete(root)`。
6. **输入框用字符串草稿，不即时转数字**：`''` 有「继承」语义，数字输入框只接 `inputmode=numeric` 的文本，服务端 `parseBudgetDraft` 权威校验；客户端只做「非数字/超硬顶」的即时提示（与其它行的就地提示一致），不阻断最终判定。

### 客户端

**设置卡片（`TrellisConfigController`）** — 四处同步新增 `docFileBudgetKB` / `docTotalBudgetKB`：

- `emptyFormState()` 两项 `empty`；`settle()` 加 `primitives.settingsNumberField(...)`；`projection()` 暴露；卡片渲染两个 `SettingsValueField`（`numeric: true`，id `trellis-config-doc-file-budget` / `trellis-config-doc-total-budget`）。
- locale：`docFileBudget`、`docFileBudgetHint`、`docTotalBudget`、`docTotalBudgetHint`。

**「项目文档」视图（`DocConfigView`）** — 在 files 清单与 root 行之间插入「注入预算」区块：

- 两个数字输入框：单文件（KB）/ 合计（KB）；`placeholder` 用 `value.budgetDefaults`（如「默认 8」）。
- 草稿状态扩展为 `{ root, files, budgets: { fileKb: string, totalKb: string } }`，初始化自 `value.budgets`（缺失则空串）；`discard` 同步恢复。
- 输入变化 → 更新草稿 + 触发既有 400ms 防抖 `preview`；`budgetErrors` 命中时该行标红并 disable 「保存」（与 root/files 行同样的处理方式）。
- 硬顶提示：输入框下方小字「单文件 ≤128KB、合计 ≤512KB；留空继承设置默认」。
- 进度条与「将截断至 NKB」改为读 `budget.fileMax/totalMax`（`docKb()` 复用），去掉 locale 里硬编码的 8KB/32KB（`injectSpecIndexHint`、`docIntro`、`docStatusTruncated`）。

## 验证计划

1. `node --test test/spec.test.js` — `resolveDocBudget` 优先级（覆盖 > 设置 > 默认）、逐项独立、夹紧（10MB → 128KB/512KB）、非法回退（0/负/字符串/NaN/Infinity）；`planDocBudget` 默认参数下与旧断言逐字节一致；自定义预算下 `limit/injectedBytes/status` 正确；提示词头显示 16KB/64KB；`entry.limit < fileBytes` 的截断文案分支。
2. `node --test test/doc-config.test.js` — `parseBudgetDraft` 边界（`''` 继承、`'0'`、`'abc'`、`'129'`、`'128'`、数字输入）；`evaluateDocConfig` 带草稿预算时 `value.budget` 用草稿值、`budgetErrors` 阻止保存；`readDocConfigSnapshot` 的 `budgets`/`budgetDefaults`/`budget` 三者正确；`saveProjectDocConfig` 写/删 `budgets`（只写一项、两项都空删字段、未知顶层字段仍保留）。
3. `node --test test/doc-config-route.test.js` — read/preview 返回新字段；save 写盘后 `files`+`budgets` 都在；`budgets` 载荷类型非法 → 400；保存后 assemble 立即读到新预算（缓存失效）。
4. `node --test test/settings.test.js test/settings-projection.test.js` — schema 默认 8/32、volatile 可写、投影字段齐全。
5. `node --test test/client.test.js test/client-doc-config.test.js` — 设置卡片渲染两个数字字段与 `edit(...)` 调用；视图预算两个输入框渲染、改值触发 preview 请求体含 `budgets`、`too-large` 时标红且保存禁用、留空保存请求体 `budgets` 为 `{fileKB:'',totalKB:''}`、进度条随 `fileMax/totalMax` 变化。
6. `node --test` 全量回归。
7. 人工验收：设置页 8/32 → 16/64，视图进度条变 64KB、提示词头显示 16KB/64KB；在视图把单文件改成 4 并保存 → `.trellis/doc.json` 出现 `budgets.fileKB: 4`，注入正文按 4KB 截断；清空两项保存 → `budgets` 从文件消失且回到 16/64。

## 风险与回滚

1. **预览/注入漂移** → 唯一 `resolveDocBudget` + 同一份草稿喂 `evaluateDocConfig`；测试用「同一配置分别过 evaluate 与 renderDocBodies」锁定。
2. **视图保存抹掉或残留 `budgets`** → 写/删逻辑显式实现 + 三条测试（只写一项、两项都空、只清一项）；`{ ...existing }` 保留未知字段。
3. **改设置 5 秒内不生效** → 缓存键含预算值（结构性排除）+ 路由级 assemble 测试。
4. **prompt 体积被调大** → 硬顶 + 提示词头回显生效值；README 写明装配每请求执行一次的成本含义。
5. **旧测试大面积失败** → `planDocBudget` 的 `budget` 有默认值；只有 import `MAX_DOC_*_BYTES` 的用例需改名，属签名迁移而非行为变更。
6. **回滚**：单 commit 覆盖 `lib/spec.js` + `lib/meta.js` + `lib/index.js` + `lib/client.js` + 测试 + README；`doc.json` 的 `budgets` 为可选字段，回滚后旧代码忽略之，无数据迁移。

## 人审检查点

- [ ] 需求拆解完整，实现方案清晰
- [ ] 设计已获用户确认（status=approved）后再进入实现

# Feature Design — 规划期只读保护：注入显式系统提示词

status: approved   # draft | approved
execution_lane: standard   # quick | standard

## 目标与非目标

目标：在 `enforceReadonlyPlanning: true` 且命中 allowlist 的会话中，当授权状态为 `undecided`（no_task 未跳过）或 `planning` 时，向装配后的系统提示**追加一段显式只读指令文本**，让模型明确知晓"当前只读、方案获批前禁止改码"，而不再只依赖工具面裁剪。

非目标：不改 denylist 裁剪集与语义；不改面包屑注入；不新增配置项；不做 i18n；不替代文件沙箱硬边界。

## 方案

### 边界

- `lib/readonly.js`：新增 2 个纯函数 + 1 个常量，不动现有裁剪函数。
- `lib/index.js:1009-1043`：`system-prompt/assemble` 处理器内做一行级组合调整。
- `test/readonly.test.js`：新增单测覆盖；不动其他测试文件。
- 不触碰 `lib/state.js` / `lib/breadcrumb.js` / `lib/task.js`。

### 数据流

```text
system-prompt/assemble 触发
  └─ next() → assembled { tools[], sections[] }
  └─ 门控：enforceReadonlyPlanning=true 且 cwd 命中 allowlist？否 → 原样返回
  └─ resolveProjectState → st.phase / st.skipState
  └─ applyReadonlyPolicy(tools, phase, skip)     → 裁剪工具（现状不变）
  └─ applyReadonlySections(sections, phase, skip) → 裁剪 tool:<name> 段（现状不变）
  └─ appendReadonlyInstruction(裁剪后sections, phase, skip)
        ├─ authorizationOf ∈ {undecided, planning}
        │    ├─ text = readonlyInstructionFor(authorization)
        │    └─ 返回 [...去重后的原sections, { name: 'trellis:readonly', text }]
        └─ authorized / 非数组 → null（不注入）
  └─ 任一非 null → 替换 assembled 对应字段；否则原样返回
```

### 契约变更

**`lib/readonly.js` 新增导出（纯函数，无 fs/无配置）：**

1. `export const READONLY_SECTION = 'trellis:readonly'`
   - 新增 section 的固定 `name`，满足 harness 装配校验（非空唯一 + 字符串 text）。
2. `export function readonlyInstructionFor(authorization)` → `string | null`
   - `'undecided'` → 中文指令（见下"指令文本"）。
   - `'planning'` → 中文指令（见下"指令文本"）。
   - `'authorized'` / 未知值 → `null`。
3. `export function appendReadonlyInstruction(sections, phase, skipState = false)` → `Array | null`
   - `sections` 非数组 → `null`（与 `applyReadonlyPolicy` 的容错约定一致）。
   - `authorizationOf(phase, skipState)` 为 `'authorized'` → `null`。
   - 否则：先过滤掉已存在的同名 section（防重复名触发装配校验），再追加 `{ name: READONLY_SECTION, text }`，返回新数组。
   - 语义与 `applyReadonlyPolicy` 对称：`no_task(false)`→注入 undecided 文本；`planning/planning-inline(false)`→注入 planning 文本；`no_task(true)`/`in_progress`/`completed`→`null`。

**`lib/index.js` 处理器组合（原 1033-1042 行区域）：**

```js
const tools = applyReadonlyPolicy(assembled.tools, st.phase, st.skipState)
const trimmedSections = applyReadonlySections(assembled.sections, st.phase, st.skipState)
const sections = appendReadonlyInstruction(trimmedSections ?? assembled.sections, st.phase, st.skipState)
if (tools || sections) {
  return { ...assembled, ...(tools ? { tools } :), ...(sections ? { sections } : {}) }
}
return assembled
```

说明：`applyReadonlySections` 在无裁剪时返回 `null`（保持现状），此时以 `assembled.sections` 原数组为注入基底；授权状态为 `undecided`/`planning` 时裁剪与注入必然同现，`authorized` 时两者皆 `null`，行为与现状完全一致。

**指令文本（中文，风格对齐 `lib/state.js` 的 FALLBACK_BREADCRUMBS）：**

- `undecided`：
  `Trellis 只读保护：当前无活跃任务，工作区处于只读状态。禁止修改任何源码或项目文件；请先分类本轮需求并询问用户是否需要创建 Trellis 任务，仅在用户明确同意后才能创建任务进入规划。`
- `planning`：
  `Trellis 只读保护：当前处于规划阶段，方案获批前工作区只读，禁止修改任何源码或项目文件。请先产出计划（prd/design 等）供用户确认；仅当用户批准进入实施阶段后，才可开始编写代码。`

### 取舍

- **追加到 sections 尾部而非插队**：persona 仍是模型读到的第一段，只读指令作为"执行规约"性质的段放在工具段之后，信息层级合理；harness 不要求 section 有序字段（装配时已按注册 order 排好，waterfall 后仅按数组顺序渲染）。
- **重复名去重采用"过滤后追加"而非"就地替换"**：保证装配后至多一个 `trellis:readonly`，规避 invariant 的 duplicate-name 抛错；即使未来宿主或其他插件注册同名段，也能稳定收敛为一份。
- **注入逻辑放 readonly.js 而非内联在 index.js**：与裁剪函数同模块、纯函数可单测，index.js 只做组合。
- **complete section 宿主场景不特殊处理**：装配末尾若存在 complete section，harness 只保留它、丢弃我们追加的段——接受（PRD 已声明）。

## 验证计划

对应 PRD 验收标准，全部为自动化单测（`node --test`）：

1. `test/readonly.test.js` 新增用例：
   - `readonlyInstructionFor`：`'undecided'`/`'planning'` 返回非空字符串且含"只读"语义关键词；`'authorized'` 与未知值返回 `null`。
   - `appendReadonlyInstruction` 注入矩阵：
     - `no_task(false)` → 返回数组含 `trellis:readonly`，文本为 undecided 文案；
     - `planning(false)` / `planning-inline(false)` → 含 `trellis:readonly`，文本为 planning 文案；
     - `no_task(true)` / `in_progress` / `completed` → `null`；
   - 非数组入参 → `null`；入参含既有 `trellis:readonly` 时结果仅一份（去重）；
   - 组合场景：`applyReadonlySections(FULL_SECTIONS, 'planning', false)` 结果再 `appendReadonlyInstruction`，断言保留 persona / `tool:read` / `tool:web_search`、不含 `tool:write`、末尾含 `trellis:readonly`。
2. 验证命令：`node --test`（工作区根执行），全量通过。
3. 回归确认：现有 readonly.test.js 全部用例不改动仍通过；index.test.js 等其余测试不受影响。

## 风险与回滚

1. **section 名冲突**：若宿主部署了同名 `trellis:readonly` 段，去重逻辑保证收敛为一份；若宿主段在 complete 语义下，指令段可能被整体丢弃（harness 既定行为，不视为缺陷）。
2. **文案与阶段漂移**：指令文本硬编码在 readonly.js，若未来阶段文案（state.js FALLBACK_BREADCRUMBS）调整，需同步——风险低，属文档级维护。
3. **软约束边界**：模型仍可用保留工具（pwsh 等）尝试写盘；只读保护是提示级约束，硬边界在文件沙箱。不回滚项。

回滚策略：`git revert` 该实现提交即恢复为纯裁剪行为；注入由 `enforceReadonlyPlanning` 与 allowlist 双重门控，关闭开关即完全无副作用（含不裁剪）。

## 人审检查点

- [x] 设计已获用户确认（status=approved）后再进入实现

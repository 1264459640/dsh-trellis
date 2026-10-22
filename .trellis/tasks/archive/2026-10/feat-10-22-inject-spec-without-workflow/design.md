# Feature Design: 免 workflow.md 下的 Spec 动态索引与阶段感知注入

status: approved   # draft | approved
execution_lane: standard   # quick | standard

## 目标与非目标
### 目标（Goals）
1. **轻量 Spec 发现与解析**：在不依赖 `workflow.md` 的前提下，安全、轻量地探测并列出 `.trellis/spec/` 下的分层规范文件。
2. **全局 Spec 索引常驻（system-prompt/assemble）**：若项目包含规范，在系统提示词装配时注入 `trellis:spec-index` section，使 Agent 在首轮与后续轮次拥有全局工程规范视野。
3. **阶段感知指引升级（agent/pre-step）**：升级内置默认面包屑 `FALLBACK_BREADCRUMBS` 与活跃步骤提示 `formatStepPrompt`，在 planning（方案对齐）和 in_progress（实现前对照检查清单）时主动督促遵循 Spec。
4. **全套自动化测试覆盖**：覆盖无 Spec、单 Spec、多分层 Spec、异常路径降级、section 幂等过滤及面包屑格式化等场景。

### 非目标（Non-goals）
1. **不生成或还原 `workflow.md`**：保持项目工作区纯净，不恢复被废弃的 `workflow.md`。
2. **不全量灌入 Spec 文本正文**：只注入结构化的相对路径列表与前置阅读约束，避免 Context Window 爆炸。
3. **不侵入只读保护与 Denylist 规则**：保持原有的工具裁剪机制独立运行。

## 需求拆解与实现方案
### 涉及模块与边界
1. **`lib/spec.js`（新增）**：
   - 暴露 `listProjectSpecs(fs, specDir)`：扫描 `.trellis/spec/` 下所有 `.md` 文件（如 `guides/index.md`, `<package>/<layer>/index.md`），返回排序后的相对路径数组。
   - 暴露 `formatSpecIndexInstruction(specPaths)`：生成紧凑纯净的 Markdown 指令段落；无 Spec 时返回 `null`。
2. **`lib/readonly.js`（修改）**：
   - 暴露常量 `SPEC_INDEX_SECTION = 'trellis:spec-index'`。
   - 增加 `appendSpecInstruction(sections, specInstruction)`：对齐已有的 `appendReadonlyInstruction` 纯函数风格，确保 section 唯一且不改变原数组。
3. **`lib/state.js`（修改）**：
   - 升级 `FALLBACK_BREADCRUMBS`：在 `planning` / `planning-inline` / `in_progress` / `in_progress-inline` 中加入对 `.trellis/spec/` 的显式阅读引导。
4. **`lib/breadcrumb.js`（修改）**：
   - 优化 `formatStepPrompt`：当 `step.spec` 存在时强化检查清单提示；没有时在执行规约中给出全局规范提示。
5. **`lib/index.js`（修改）**：
   - 在 `system-prompt/assemble` 钩子中，从 `trellisPaths(root).specDir` 读取 specs 并组装到 sections。
6. **`test/spec.test.js`（新增）**：
   - 验证 Spec 扫描、格式化、section 挂载、幂等去重与容错降级。

### 核心数据流与逻辑拆解
```text
Agent Prompt Assembly
  │
  ├─> 1. system-prompt/assemble (DSH 事件)
  │     │
  │     ├─> matchAllowlist(cwd) -> 命中项目 root
  │     ├─> resolveProjectState(fs, root) -> 获取当前 phase
  │     ├─> applyReadonlyPolicy & applyReadonlySections & appendReadonlyInstruction
  │     │
  │     └─> [新增] listProjectSpecs(fs, p.specDir)
  │           ├─> 存在 .trellis/spec/*.md ?
  │           │     ├─ 是: formatSpecIndexInstruction(specPaths)
  │           │     │       └─> appendSpecInstruction(sections, text)
  │           │     └─ 否: 返回 null，不注入 spec section
  │           └─> 返回组装好的 tools & sections
  │
  └─> 2. agent/pre-step (DSH 每轮每步事件)
        │
        ├─> resolveProjectState -> composeBreadcrumb(phase)
        │     └─> 消费升级后的内置 FALLBACK_BREADCRUMBS (含 Spec 阶段指引)
        │
        └─> formatStepPrompt(stepInfo)
              └─> 消费增强后的 step.spec 与 Pre-dev 检查清单指引
```

### 契约变更
- **系统提示词 Section**：
  - 新增段名：`trellis:spec-index`
  - 仅在目标项目存在 `.trellis/spec/` 且包含 `.md` 文件时注入。
  - 文本格式稳定为规范路径列表与执行约束，无额外副作用。

### 关键技术选型与取舍
- **按需列举路径 VS 灌入全文**：
  - 放弃全量读取正文注入：大项目 Spec 可能达到数万字符，若全量塞入系统提示词会严重消耗上下文配额并干扰模型专注度。
  - 选择注入 Spec 索引路径并附带强约束说明：告知模型存在哪些权威规范，引导模型在规划方案与编码前主动调用 `read` 工具研读对应规范，符合 Harness 的按需阅读架构（Tool-augmented Reading）。
- **纯函数设计与 Fail-Open**：
  - 所有文件探测与格式化均采用异常捕获与 fail-open 策略，即使文件读取受阻或目录不存在，也不会影响 Agent 正常运转。

## 验证计划
- **自动化测试**：
  1. `test/spec.test.js`：
     - 测试 `listProjectSpecs` 正常读取 `.trellis/spec/` 下的文件列表；
     - 测试不存在 `.trellis/spec/` 时返回空数组，不抛异常；
     - 测试 `formatSpecIndexInstruction` 生成标准中文指引；无文件时返回 `null`；
     - 测试 `appendSpecInstruction` 幂等性、去重与非变异性；
     - 测试 `system-prompt/assemble` 端到端集成，验证 `trellis:spec-index` section 真实输出。
  2. 全量回归：
     - 运行 `node --test`，确保原有的 166 个测试与新增测试全部 100% 跑绿。

## 风险与回滚
- **风险点**：
  - 某些项目没有 `.trellis/spec/`：已设计为静默返回 `null`，完全无额外开销与影响；
  - 递归扫描深层目录卡顿：通过限制在 `.trellis/spec/` 局部目录内搜索，且工程规范文档一般仅在几篇到几十篇以内，毫秒级完成。
- **回滚策略**：
  - 本次改动纯增量，若有异常可快速 git revert 单个 commit。

## 人审检查点
- [ ] 需求拆解完整，实现方案清晰
- [ ] 设计已获用户确认（status=approved）后再进入实现

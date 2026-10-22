# Code Review · feat-10-22-inject-spec-without-workflow

审查方式：主会话派发的**独立子代理**（findings-first，未参与实现），实际阅读全部改动源码与 4 个测试文件，实跑 `npm test`，并用真实临时目录 / 真实 cordis 上下文做探针复核。

## 结论

- 初审：`blocking: 0 / major: 3 / minor: 9 / nit: 4`
- 修复后复核：**blocking: 0 / major: 0**（3 条 major 全部修复并补测试），minor/nit 中可执行的均已处理，剩余 2 条作为已知取舍记录在下文。

## Major（全部已修复）

### M1 白名单用例是假绿灯 → 已改为可失败用例
- 初审问题：`mountAssembler` 把 `allowlist` 写成 `[cwd]`，"白名单外"用例的 cwd 与白名单唯一项完全相同，删掉 `if (!root) return assembled` 守卫它依然会绿。
- 修复：`mountAssembler({ cwd, allowlist = [cwd] })` 解耦两者；用例改为「项目 A 真实带 spec，会话 cwd 是另一个真实目录 B，`allowlist: [A]`」，并断言 sections 与 tools 均与基线深相等。守卫若被删除，该用例必红。

### M2 相对路径无根锚点，子目录会话 read 必打空 → 已加根锚点
- 初审问题：`matchAllowlist` 是祖先匹配（subtree），会话 cwd 可能是 monorepo 子目录；纯 `.trellis/spec/...` 相对路径没有说明相对谁。
- 修复：`formatSpecIndexInstruction(specPaths, { root })` 在首行写入「路径相对项目根 <root>」；`lib/index.js` 的 `resolveSpecIndex` 把已解析的 root 传入。新增用例 `the injected index is anchored to the project root, not to the session cwd`（cwd 为子目录 + 祖先白名单命中）。

### M3 每次装配无条件 walk 目录（热路径 I/O）→ 已加 TTL memo + signal + 收窄上限
- 初审问题：改动前 `enforceReadonlyPlanning: false` 时该处理器一次 fs 都不碰；改动后 `system-prompt/assemble`（按**请求**触发）每次都走整棵 spec 树，无 memo、无 signal。
- 修复：
  - `resolveSpecIndex()` 以 project root 为键做 5s TTL memo（`SPEC_INDEX_CACHE_CAP = 8`，LRU 淘汰），稳态零 fs 调用；
  - `context.signal` 透传到 `fs.resolve/stat/listDir`，walk 每轮 `signal?.throwIfAborted()`；
  - `DEFAULT_MAX_DIRS` 48 → 24，`maxEntries` 32 → 40，并改为「先收全有界树、再排名、再截断」。

## Minor（已处理）

| # | 问题 | 处理 |
|---|---|---|
| 1 | 新增常驻注入无配置开关，README/设置面板未同步 | 新增 `injectSpecIndex`（`z.boolean().default(true).volatile()`），`lib/client.js` 中英 label/hint + BooleanRow + projection 全部接入；README/README_EN 配置表与结构清单同步 `lib/spec.js` |
| 2 | 注释称「不再读写 workflow.md」，代码仍在读 | 注释改为「不再创建或注入；项目级 `[workflow-state:*]` 覆盖块仍然 READ」 |
| 3 | `signal` 解构后未使用，注释是假承诺 | 已真正透传并在循环内检查，补 abort 用例 |
| 4 | 截断静默、无 index.md 优先 | `compareSpecPaths` 改为 index.md 优先 → 深度 → 字典序；正文固定一句「本清单可能只是前缀，可用 glob 确认」，不再让模型误以为索引即全集 |
| 5 | `step.spec` 语义错位；对 blocked/verifying 是过时指令 | 规范前置行改为**时序感知**：`blocked` → 规范落点、`verifying` → 规范核对、`pending/in_progress` → 规范前置（`step.spec` 只升级措辞，不再当判据）。补三态用例 |
| 6 | 同一约束一轮重复三遍 | 面包屑去掉重复的冲突处理长句与硬编码 `<package>/<layer>` 路径，改为引用 `trellis:spec-index`；冲突细则只保留在 section |
| 7 | 边界断言强度不足 | `maxEntries` 断言具体条目（index.md 优先）；新增 `maxDirs`（证明限的是 walk 而非输出）、abort、符号链接越界三条用例 |
| 8 | 两条测不到东西的单测 | 改为断言 harness 装配不变量（name 非空 + text 为 string）并遍历 `no_task / planning / planning-inline / in_progress / completed` 五态，断言两个 section 各恰好一份 |
| 9 | 「无 spec 时零改动」未比工具面 | 补 `assert.deepEqual(out.tools, base.tools)`；新增 `injectSpecIndex: false` 用例与 memo 用例（计数 fs 证明第二次装配零 fs 调用） |

## Nit（已处理 4 / 保留 0）

- `if (withSpec) sections = ...` → 压成 `?? sections`，与同文件 `applyReadonlySections(...) ?? assembled.sections` 风格一致。✅
- `assemble.test.js` 的 `readText` 无意义三元 → 返回真实文件内容。✅
- `SPEC_INDEX_SECTION` / `appendSpecInstruction` 放在 `readonly.js` 与模块定位冲突 → 移入 `lib/spec.js`，测试随之迁移。✅
- 中文硬编码 vs 英文面包屑的跨语言口径 → 已在 `formatSpecIndexInstruction` 上方补 `Chinese by design, mirroring READONLY_SECTION`。✅

## 已知取舍（不改）

1. **`no-trellis` 不抑制系统提示词段**：`injectSpecIndex` / `enforceReadonlyPlanning` 是会话级 section，`agent/pre-step` 的 `shouldSkip` 只作用于当轮面包屑。已在 README 配置表显式写明「请用各自开关关闭」，而不是假装关键词能关掉它。
2. **spec 索引正文为中文硬编码**：沿用 `readonlyInstructionFor` 的既有 PRD 决策（无 i18n），已在代码注释声明成因。

---

## Check 阶段验证（trellis-check 全量终审）

| 检查维度 | 结果 |
|---|---|
| 1. 类型检查 | 仓库无 `type-check` 脚本（CI 只跑 `npm test`）；JSDoc 类型标注已随新模块补齐，`node --check` 全部文件语法通过 |
| 2. 代码风格 | 仓库无 lint 脚本；改动沿用既有模块风格（纯模块 + 无副作用 + 中文注释口径），行尾统一为仓库基线 CRLF |
| 3. 测试有效性 | 断言均对准**外部接缝**：section 是否出现在装配结果、渲染文本内容、fs 调用计数、排序结果、工具面深相等——不依赖内部字段名或实现细节；含负例（无 spec / 白名单外 / 开关关闭 / abort / 越界越权） |
| 4. 单元 / 集成测试 | `npm test` → **197 pass / 0 fail** |
| 5. PRD 验收 | 5 条验收标准逐条核对通过（见下） |
| 6. 模块规范门禁 | 已对照 `.trellis/spec/trellis-workflow/task-engine/index.md`：新增 section 满足 harness 不变量（name 非空唯一 + string text）；未破坏 denylist 裁剪与只读语义；并把本任务的**新约定 7** 与两条**已知坑**回写进该 spec |

### PRD 验收逐条

- [x] 存在 `.trellis/spec/` → `system-prompt/assemble` 的 sections 含 `trellis:spec-index`，列出规范相对路径 + 前置阅读约束。
- [x] 不存在或为空 → 不注入该段，且 `tools` 与基线深相等（零 token 浪费、零工具面变化）。
- [x] `FALLBACK_BREADCRUMBS` 在 `planning` / `planning-inline` / `in_progress` / `in_progress-inline` 含明确 Spec 指引；`no_task` / `completed` 不注入噪音。
- [x] `formatStepPrompt` 正确呈现规范约束（时序感知三态）。
- [x] 全量自动化测试绿灯，无回归。

### 交付证据

- `npm test`：197 pass / 0 fail（本任务新增/改写：`test/spec.test.js` 15 条、`test/assemble.test.js` 7 条、`test/readonly.test.js` 23 条、`test/native-steps.test.js` 的 spec 相关 6 条、`test/settings-projection.test.js` 字段集）。
- 真实仓库探针：`listProjectSpecs('.trellis/spec')` → `['trellis-workflow/task-engine/index.md', 'trellis-workflow/web-ui/index.md']`；渲染正文（含根锚点）≈ 300 字符。
- 热路径：第二次装配的 fs 调用计数与第一次完全相等（memo 生效，稳态 0 次）。
- `npm pack --dry-run`：`lib/spec.js` 随包发布。

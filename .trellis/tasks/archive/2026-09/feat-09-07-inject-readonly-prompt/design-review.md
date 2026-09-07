# Feature Design Review

status: passed   # missing | passed | blocking

## 审查范围

- 方案文档：`.trellis/tasks/feat-09-07-inject-readonly-prompt/prd.md`、`.trellis/tasks/feat-09-07-inject-readonly-prompt/design.md`
- 只读策略模块：`lib/readonly.js`（`authorizationOf` / `trimToolsFor` / `applyReadonlyPolicy` / `applyReadonlySections` 的 denylist 语义与「null 表示不处理」约定）
- 装配处理器：`lib/index.js:1020-1043`（`system-prompt/assemble`）与 `resolveProjectState`（108-185，返回 `phase` / `skipState`）
- section 契约：`node_modules/.pnpm/@deepseek-ai+dsh-system-pro_ae19c1446da8797d55176bf5f8e2b0ad/node_modules/@deepseek-ai/dsh-system-prompt/lib/invariant.js`（name 非空唯一、text 必须为字符串）及同包 `lib/index.js` 的 `assemble()`（waterfall 顺序、complete section 语义）
- 文案与测试参照：`lib/state.js` FALLBACK_BREADCRUMBS（99-111）、`README.md`、`test/readonly.test.js`（现有矩阵与 `node:test` 风格）、`package.json`（`test: node --test`）

核对确认（与设计结论一致）：

- invariant 插件以 `prepend: true` 注册、在 waterfall 内先执行并校验**最终**装配结果：新增段会被校验，`trellis:readonly` 非空、不与 `harness:identity` / `deployment:persona` / `tool:*` 冲突、text 为字符串常量，校验通过。
- complete section 语义确认：`assemble()` 末尾若存在 complete section，`sections` 会被整体替换为 `[completeSection]`，追加段被丢弃——PRD 约束与 design 取舍描述准确，且校验先于该替换发生，不会误报。
- authorized 零差异确认：`authorized` 时 `applyReadonlyPolicy` / `applyReadonlySections` / `appendReadonlyInstruction` 均返回 null，处理器原样返回 `assembled`，与现状逐字节一致。
- `trimmedSections ?? assembled.sections` 基底选择正确：`undecided`/`planning` 时 `applyReadonlySections` 必返回新数组（非 null），注入基底恒为裁剪后数组；非数组容错（返回 null）与 `applyReadonlyPolicy` 约定对称。
- 处理器组合（`tools || sections` 判断、spread 替换）与现有 1033-1042 行结构一致，仅新增一行 `appendReadonlyInstruction` 组合调用，无行为回归路径。

## 发现

| 级别 | 问题 | 建议 |
|------|------|------|
| minor | 设计称指令文本「风格对齐 lib/state.js 的 FALLBACK_BREADCRUMBS / 与现有面包屑文案语言一致」，但 `state.js:99-111` 的 FALLBACK_BREADCRUMBS 为英文；本仓库无 workflow.md，实际模型可见面包屑为英文（本会话运行时上下文即为英文 fallback）。在无 workflow.md 的项目里，系统提示将出现「英文提示词 + 唯一中文 section」混排——「与面包屑语言一致」的论据不成立（「与 README 一致」半句成立，README 为中文）。 | 中文指令是 PRD 明确决策，可保留；但应修正 design 的风格依据表述，或明确记录混排为有意为之。若在意提示词语言统一，可考虑指令文本与 FALLBACK_BREADCRUMBS 同为英文（项目 workflow.md 为中文时再切中文），属产品决策而非本特性必须。 |
| minor | planning 指令文本存在内部张力：「禁止修改任何源码或项目文件」与「请先产出计划（prd/design 等）」并列。规划产物（prd.md/design.md）本身是项目文件，且 write/edit 已被裁剪、只能经 `trellis_artifact_update` 写入；照字面理解的模型可能因「禁止修改项目文件」而拒绝产出规划文档，削弱特性目的。 | 措辞区分源码/业务文件与规划产物通道，例如：「禁止修改任何源码或业务文件；规划产物请通过 Trellis 任务工具（trellis_artifact_update）写入」。 |
| minor | 验证计划只覆盖纯函数；PRD AC1-AC3 的验收对象是「装配后的系统提示」，而 `test/index.test.js` 目前没有任何 assemble 处理器级覆盖，处理器新组合胶水未被直接断言（仅组合场景用例间接贴近）。 | 在 `readonly.test.js` 内按处理器实际顺序串起 applyReadonlyPolicy → applyReadonlySections → appendReadonlyInstruction 做一次全链断言（含 authorized 零差异路径），不必动 index.test.js。 |
| nit | 去重承诺略超强：design 称「即使未来宿主或其他插件注册同名段，也能稳定收敛为一份」。这对装配期已注册的 section、或早于本处理器运行的 handler 成立；对在本处理器之后追加同名段的 handler 无法收敛，可能触发 invariant duplicate-name 抛错。当前无此类插件，属理论风险。 | 将措辞收敛为「对装配期已存在（或早于本处理器）的同名段生效」。 |
| nit | `appendReadonlyInstruction` 测试矩阵未显式覆盖未知 phase 值（应 → null，由 `authorizationOf` 传递保证）与 `planning + skipState=true`（与 `planning(false)` 结果相同）。 | 各补一行断言，成本极低。 |

## 结论

- [x] 通过，可进入实现
- [ ] 阻塞，需改 design
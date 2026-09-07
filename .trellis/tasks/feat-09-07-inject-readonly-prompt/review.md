# Feature Code Review

status: passed   # missing | passed | blocking

## Diff 范围
- lib/readonly.js、lib/index.js（system-prompt/assemble）、test/readonly.test.js
- git diff 确认仅这 3 个文件（+167/-3），与 design.md 边界一致（未触碰 state.js / breadcrumb.js / task.js / 其他测试文件）

## 发现
| 级别 | 问题 | 文件 | 建议 |
|------|------|------|------|
| nit | `appendReadonlyInstruction` 注入矩阵未显式断言 `planning + skipState=true`（design-review nit #2 曾要求补一行）。`authorizationOf` 只对 `no_task` 分支读 skipState，`planning+true` 与 `planning+false` 按构造等价，且 `authorizationOf` 用例已覆盖 skip 语义，属测试冗余缺行而非逻辑缺口。 | test/readonly.test.js | 可选：`appendReadonlyInstruction(base, 'planning', true)` 补一行断言与 planning(false) 相同，成本极低。 |
| nit | `appendReadonlyInstruction` 去重过滤 `!(s && s.name === READONLY_SECTION)` 保留 null 条目，而 `applyReadonlySections` 丢弃 null 条目，防御行为不对称。真实装配下 invariant 要求 section 非 null（`section.name.length` 直接访问），且组合链中 append 的入参必为裁剪后数组（null 已被上层滤除），不可达。 | lib/readonly.js | 可选：为一致性改为 `!(s && ...)` 过滤 null，或留注释说明不对称是有意（不可达路径）。非阻塞。 |
| minor（已解决，仅记录） | design-review minor #1 的中英文混排问题按指示不作为 blocker；实现已在 `readonlyInstructionFor` JSDoc 中显式记录"Chinese by design（PRD 决策，无 i18n），即使英文 fallback 面包屑并排出现"，处理得当。 | lib/readonly.js | 无需动作。 |
| minor（已解决，仅记录） | design-review minor #2 的文案张力已在实现中修复：planning 文本改为"禁止修改任何**源码或业务文件**"，并显式追加"规划产物请通过 Trellis 任务工具（trellis_artifact_update）写入"，区分了写通道。 | lib/readonly.js | 无需动作。 |

## 验证证据
- `trellis-check`：逐条比对 prd.md 验收标准 AC1-AC6 与 design.md 契约（三导出、处理器组合、指令文本语义、去重、authorized 零差异），全部满足；比对 `.trellis/spec/trellis-workflow/task-engine/index.md` 质量约定（三态授权、denylist 语义、`trellis_artifact_update` 唯一写通道、阶段感知相位），无违规。审查期间只读，未修改任何业务代码。
- `node --check`：`lib/readonly.js`、`lib/index.js`、`test/readonly.test.js` 均通过。
- 测试执行：`node test/readonly.test.js` 直接执行 → 23/23 通过（新增 8 组用例：readonlyInstructionFor 文本/空值、append 注入矩阵/去重/不可变/容错、全链组合、authorized 零差异）。`node --test` 全量因沙箱 spawn EPERM 受限（已知边界），改为逐文件直接执行：board 6、client 3、git 6、index 26、native-steps 20、readonly 23、state 7，合计 91/91 通过，0 失败。
- 契约核对：`@deepseek-ai/dsh-system-prompt/lib/invariant.js` `validateAssembly` 要求 name 非空唯一 + text 为字符串；`trellis:readonly` 非空、去重后至多一份、text 为字符串常量，且 invariant 以 `prepend: true` 校验最终装配结果（含本 handler 追加的段），校验通过。complete section 语义（装配末尾整体替换）与 PRD/design 描述一致，接受。
- 组合逻辑核对：`trimmedSections ?? assembled.sections` 基底选择正确——undecided/planning 时 `applyReadonlySections` 必返回新数组（trim 集非空），注入基底恒为裁剪后数组；authorized/非数组时返回 null 回退原数组且 `appendReadonlyInstruction` 亦返回 null，处理器 `tools || sections` 全 null 时原样返回 `assembled`，与现状零差异。
- 代码风格：纯函数模块（无 fs/无配置）、JSDoc 齐全、命名与既有 `applyReadonlyPolicy`/`authorizationOf` 体系一致、`??`/条件展开与 design.md 示例逐字一致、LF→CRLF 警告为 git 换行符提示非问题。

## 结论
- [x] 通过（含 `trellis-check` 与任务要求的验证）
- [ ] 需修复后重审

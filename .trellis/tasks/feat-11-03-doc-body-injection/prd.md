# Feature PRD

## 背景

`.trellis/doc.json` 的 `files` 目前只把**文件路径 + 先读约束**注入 `trellis:spec-index` 段，正文要模型自己 `read`。多文档场景下模型容易只读一部分、或干脆跳过，规范约束力弱。用户明确要求：**注入正文，而不是路径**。

同时必须正视成本：system prompt 每个模型请求都会重发。FordProject 现有 8 个文件共 70KB（`GLOSSARY.md` 单文件 36KB），一轮带工具的任务通常有 10~30 次请求，全量注入每轮要多花 0.7~2MB 输入。

## 目标

1. `doc.json` 的 `files` 正文直接进入 system prompt，模型无需先 read 就能看到规范内容。
2. 成本有硬上限：总量 32KB、单文件 8KB，按 `files` 顺序优先；超出部分截断并显式标注、保留路径供补读。

## 已确认决策

1. **只对 `doc.json` 的 `files` 生效**；没有 `doc.json` 时旧的 `.trellis/spec/**` 扫描仍只注入索引，行为不变（保住 AC1 兼容）。
2. **预算**：总量 ≤ 32KB（UTF-8 字节），单文件 ≤ 8KB；以 `files` 顺序为优先级。
3. **截断必须显式**：截断处写清楚"已截断 + 完整内容 read 该路径"，禁止静默截断。
4. section 名保持 `trellis:spec-index`，不改现有装配契约。
5. 不新增设置项/配置字段，预算为代码常量。
6. 单文件失败不拖垮整体：读取失败的文件单独标注，其余照常；全部失败回退为纯路径清单。

## 核心需求

- 渲染：每个文件输出 `## <项目根相对路径>` 标题 + 正文；段首给总体说明（路径锚点 + 预算说明）。
- 预算：按行边界截断，避免切坏多字节字符/表格行。
- 顺序与去重：沿用现有 `files` 归一化与去重逻辑。
- 兜底：`fs` 读取异常、文件消失等一律 fail-open，不影响整轮对话。

## 验收标准

- [ ] **AC1 正文注入**：`files` 中小于 8KB 的文件，正文原样出现在 system prompt 的 `trellis:spec-index` 段，带路径标题。
- [ ] **AC2 单文件截断**：超过 8KB 的文件只取前 8KB（按行边界），并带"已截断，完整内容请 read `<path>`"标记。
- [ ] **AC3 总量预算**：累计达到 32KB 后，剩余文件不再注入正文，只保留路径 + "超出注入预算"标记。
- [ ] **AC4 顺序与去重**：输出顺序等于 `files` 配置顺序；重复路径只出现一次。
- [ ] **AC5 失败隔离**：单个文件读取失败时该文件标注"读取失败，请手动 read"，其它文件正常注入；全部失败回退为纯路径清单。
- [ ] **AC6 无配置兼容**：没有 `doc.json` 的项目，注入内容与现在完全一致（`.trellis/spec` 索引，不含正文）。
- [ ] **AC7 热路径有界**：TTL 内重复装配不重复读取文件（沿用现有 5s memo）。
- [ ] **AC8 文档一致**：README 中英、设置项提示文案、`.trellis/spec` 约定同步改为"注入正文（预算截断）"。
- [ ] **AC9 回归**：`node --test` 全绿；FordProject 真实配置能渲染出 8 个文件的正文段。

## Non-goals

- 不把 `.trellis/spec/**` 正文也注入（旧扫描维持索引模式，避免影响所有历史项目）。
- 不新增配置项、UI 开关或环境变量（预算写死为常量）。
- 不做摘要、向量检索、按阶段挑选文件、增量 diff 注入。
- 不改变 `doc.json` 的 `root` 语义（仍只是 Skill 元数据）。
- 不改 `trellis:spec-index` 的 section 名与装配位置。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| token 成本上升 | 每请求多 ~1.2 万 token（32KB），多请求任务放大 | 双预算 + 5s TTL 缓存 + 明确截断标记 |
| 截断被误当全文 | 模型给出不完整结论 | 强制标注"已截断/超出预算"并保留路径 |
| 规范与实现脱节 | 后续 Agent 按旧约定改回去 | AC8 把文档同步纳入验收 |

## 相关代码 / 文档

- `lib/spec.js`：`readProjectDocConfig`、`formatDocFilesInstruction`、`appendSpecInstruction`
- `lib/index.js`：`resolveSpecIndex`（5s memo）与 `system-prompt/assemble`
- `lib/client.js`：`injectSpecIndexHint` 文案
- `README.md` / `README_EN.md`：配置说明
- `.trellis/spec/trellis-workflow/task-engine/index.md`：约定 7 与 doc.json 段
- `test/spec.test.js`、`test/doc-config.test.js`、`test/assemble.test.js`

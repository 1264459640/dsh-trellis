# 技术设计：doc.json 注入改为正文（预算截断）

## 1. 模块边界

只动 `doc.json` 这一条分支，旧 `.trellis/spec` 扫描与只读裁剪不碰。

| 位置 | 变化 |
|---|---|
| `lib/spec.js` | 新增 `renderDocBodies()`；`resolveSpecIndexInstruction()` 的 `files` 分支改为渲染正文；保留 `formatDocFilesInstruction()` 作为全失败兜底 |
| `lib/index.js` | 不改装配逻辑：`resolveSpecIndex` 的 5s memo 天然覆盖正文读取 |
| `lib/client.js` | 只改 `injectSpecIndexHint` 中英文案 |
| `README.md` / `README_EN.md` | 更新注入语义说明 |
| `.trellis/spec/.../task-engine/index.md` | 更新约定 7 与 doc.json 条目 |

对外契约：`SPEC_INDEX_SECTION` 名称不变；`readProjectDocConfig()` 返回结构不变（仍是 `{kind:'files', files: string[]}`），避免波及现有测试与调用方。

## 2. 数据流

```
system-prompt/assemble
  └─ resolveSpecIndex(fs, root, signal)        // 5s TTL memo，key=root
       └─ resolveSpecIndexInstruction(...)
            ├─ readProjectDocConfig()          // 读 + 校验 doc.json（现状不变）
            ├─ kind==='invalid' → 固定诊断（现状）
            ├─ kind==='files'   → renderDocBodies(fs, root, files)
            └─ kind==='absent'  → 旧 .trellis/spec 索引（现状不变）
```

`renderDocBodies` 对每个路径：`fs.resolve` → `fs.readText` → 预算裁剪 → 拼接；任何异常只影响该文件。

## 3. 渲染契约

段首：

```
Trellis 项目文档正文（来自 .trellis/doc.json 的 files；路径相对项目根 <root>；单文件上限 8KB，正文合计上限 32KB）：
```

每个文件：

```
## 文件：<path>
<正文>
```

（`文件：` 前缀用来和正文自带的 `#`/`##` 标题区分，避免 32KB 拼接后分不清文件边界。）

三种非正常标记（都要带路径，保证可补读）：

- 单文件超限：`（正文已截断，仅注入前 8KB；完整内容请 read <path>）`
- 超出总预算：`（超出注入预算，未注入正文；完整内容请 read <path>）`
- 读取失败：`（读取失败，未注入正文；请手动 read <path>）`

段尾：

```
使用要求：以上为注入时的正文副本，标注"已截断/超出预算/读取失败"的文件必须先 read 对应路径再下结论；文档与本轮需求冲突时先向用户说明并确认。
```

## 4. 预算算法

常量（`lib/spec.js`）：

```js
const MAX_DOC_FILE_BYTES = 8 * 1024
const MAX_DOC_TOTAL_BYTES = 32 * 1024
```

按 `files` 顺序遍历，`used` 累计已用字节：

1. 读文本，`size = Buffer.byteLength(text, 'utf8')`。
2. `allow = Math.min(MAX_DOC_FILE_BYTES, MAX_DOC_TOTAL_BYTES - used)`；`allow <= 0` → 只写路径 + 超预算标记，`continue`。
3. `size <= allow` → 正文全量写入，`used += size`。
4. 否则按 `allow` 字节截断，**回退到最后一个换行**（找不到换行才硬切），去掉末尾 `U+FFFD`；写入内容 + 截断标记；`used += Buffer.byteLength(cut)`。

按行回退是为了不切坏表格、代码块和多字节字符；字节口径与磁盘 `size` 一致，便于解释预算。

## 5. 失败与兜底

- 单文件 `resolve`/`stat`/`readText` 抛错 → 该文件写"读取失败"标记，继续下一个。
- 所有文件都失败（或 `fs.readText` 不可用）→ 回退调用现有 `formatDocFilesInstruction()`，保持纯路径清单（不产生空 section）。
- `signal` 已 abort → 直接抛/返回保持不变，由装配层处理。

## 6. 测试计划

`test/spec.test.js`（新增，fake fs 驱动 `renderDocBodies`）：

1. 小文件正文原样出现，顺序 = files 顺序。
2. 9KB 文件被截到 8KB，含"已截断"标记，且不切断多字节字符。
3. 5×8KB 文件：累计到 32KB 后，后续文件只有路径 + "超出注入预算"。
4. 单文件读取失败：该文件有"读取失败"标记，其它文件正文完整。
5. 全部读取失败：回退为纯路径清单（无正文、无空段）。

`test/assemble.test.js`：doc.json 场景下 `trellis:spec-index` 文本包含正文；无 doc.json 场景保持索引（现有断言不变）。

## 7. 验证命令

```bash
node --test test/spec.test.js test/doc-config.test.js test/assemble.test.js
node --test
```

真实配置校验：以 FordProject 的 `doc.json` 为输入跑一次渲染，确认 8 个文件按序出现，`GLOSSARY.md`（36KB）被截到 8KB 并带标记。

## 8. 风险与回滚

- 成本：32KB ≈ 1.2 万 token/请求；已有 5s memo，且只在 section 装配时读。若仍嫌重，后续可在常量层下调（不改契约）。
- 语义：截断是唯一新增的"部分内容"状态，必须由标记显式表达，避免模型当全文用。
- 回滚：单 commit 回退 `lib/spec.js` + 文案即可，无数据迁移、无配置迁移。

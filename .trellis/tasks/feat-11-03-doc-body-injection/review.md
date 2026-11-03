# Review — doc.json 注入改为正文（预算截断）

## 1. 检查命令与输出

| 检查项 | 命令 | 结果 |
|---|---|---|
| 语法/模块加载 | `node --check lib/spec.js` 等 4 个文件 | 4/4 OK；`renderDocBodies`/`MAX_DOC_FILE_BYTES`/`MAX_DOC_TOTAL_BYTES` 导出正常 |
| 定向测试 | `node --test test/spec.test.js test/doc-config.test.js test/assemble.test.js` | 53/53 pass |
| 全量测试 | `node --test` | 262/262 pass，0 fail |
| 空白检查 | `git diff --check` | exit 0 |
| 真实配置校验 | FordProject `.trellis/doc.json`（8 文件 / 70KB）→ `renderDocBodies` | 8/8 按序渲染；GLOSSARY、ADR 截到 8KB；末位文件超预算降级为路径标记 |

## 2. PRD 验收对照

- **AC1 正文注入**：`renderDocBodies injects configured bodies in order under the project root` + assemble 用例断言 `# B body` 出现在 section；真实配置 8 个文件正文均进入渲染结果。✅
- **AC2 单文件截断**：`clamps one file to the per-file budget on a line boundary` 断言 ≤ 8KB、无 `U+FFFD`、落点为换行；真实配置 GLOSSARY 带「正文已截断，仅注入前 8KB」。✅
- **AC3 总量预算**：`stops at the total budget and marks the rest path-only` 断言第 5 个文件为路径标记；真实配置末位文件为「超出注入预算」。✅
- **AC4 顺序与去重**：`valid files keep order with exact duplicates removed` 断言 `## 文件：docs/b.md` 只出现一次且排在 a 之前。✅
- **AC5 失败隔离**：`isolates a read failure to its own file` 断言 bad 有读取失败标记、good 正文完整；`falls back to the path-only whitelist when every read fails` 断言全失败回退。✅
- **AC6 无配置兼容**：`no doc.json keeps the legacy .trellis/spec scan` 保持通过，未改旧分支。✅
- **AC7 热路径有界**：`a configured files whitelist is memoized` 断言第二次装配 fs 调用数不变。✅
- **AC8 文档一致**：README 中英、`client.js` 中英 hint、`task-engine/index.md` 约定 7 与文档入口条目均已更新；仅剩两处「不注入正文」明确指向旧 `.trellis/spec` 分支。✅
- **AC9 回归 + 真实配置**：262/262 + FordProject 渲染校验通过。✅

## 3. 测试有效性审查

新增用例均打在模块接缝上：输入是 `files` + 预算常量，输出是最终注入文本与标记，不依赖内部调用顺序或私有字段。截断用例断言字节上限与换行边界（业务不变量），不是照抄实现细节。

## 4. 规范门禁

- 遵循 `task-engine/index.md` 约定 7：段名 `trellis:spec-index` 不变、装配期注入、失败 fail-open、热路径 memo。
- 遵循「项目文档入口」：`files` 仍是唯一注入白名单，`root` 未参与拼接或过滤。
- 未引入新配置项或新 section 名；旧 `.trellis/spec` 分支零改动。

## 5. 结论

全部检查项绿灯，验收标准 9/9 满足。可进入提交阶段。

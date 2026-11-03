# Feature Code Review

status: passed

## Diff 范围

- 固定点：`HEAD`，审查未提交改动。
- 范围：`lib/`（spec/index/resolve/breadcrumb/state/client/meta）、`skills/`（bootstrap、before-dev、check、update-spec、feat、refactor、templates）、两份 README、项目规范与测试。
- 新增测试：`test/doc-config.test.js`、`test/skill-contract.test.js`。
- 版本：`package.json` 提升到 `0.4.8`，保证既有项目的 Skill 升级能够收到 bootstrap/update-spec 修改。

## 发现

| 级别 | 问题 | 文件 | 处理 |
|------|------|------|------|
| blocking | `files` 清单渲染无上限，大清单可能每轮注入约 1.5KB | `lib/spec.js` | 已增加 40 文件上限与显式截断提示，补 45 文件测试 |
| blocking | 请求 abort 被当成配置错误并缓存 5 秒 | `lib/spec.js` | abort 现在返回无注入，不再生成诊断；补 aborted signal 测试 |
| blocking | Windows 无 symlink 权限时越界测试零断言通过（假绿灯） | `test/doc-config.test.js` | 失败分支改用 fake `contains` 强制验证拒绝路径 |
| major | `doc.json` 存在但 stat/resolve 抛错时会静默回退旧 Spec | `lib/spec.js` | 配置路径解析/stat 失败判为 invalid；仅配置不存在或 abort 才走 legacy |
| major | 既有项目版本仍为 0.4.7，Skill 自动升级不会落盘 | `package.json` | 提升到 0.4.8 |
| minor | 配置路径常量重复（`path.join` vs `trellisPaths`） | `lib/spec.js` | 统一使用 `trellisPaths().docConfig/specDir` |
| minor | Windows 大小写不同的同一路径会重复注入 | `lib/spec.js` | win32 去重键转小写，补回归测试 |
| minor | `formatDocConfigErrorInstruction` 是常量包壳，测试为同义反复 | `lib/spec.js`、测试 | 删除包装函数，直接使用固定诊断常量 |
| minor | 初始化分支丢失原有 Spec 骨架细节 | `skills/trellis-spec-bootstrap/SKILL.md` | 恢复分层表格、`guides/conventions` 与推荐目录树 |
| minor | 运行时提示/设置文案/stale comments 仍只提旧目录 | `lib/breadcrumb.js`、`lib/state.js`、`lib/client.js`、`lib/index.js` | 统一为 files 优先、无配置回落旧 Spec |
| note | 去重基于规范化相对路径，不解析 in-root symlink 的真实路径 | `lib/spec.js` | 非阻塞边界；文件仍会通过 `fs.contains` 的越界校验，后续如出现别名需求再引入 realpath 去重 |

## 验证证据

- `node --test`：**254 tests / 254 pass / 0 fail**。
- `git diff --check`：clean。
- `test/doc-config.test.js`：无配置兼容、默认/多文件清单、顺序去重、root 不参与注入、BOM、空/类型错误、绝对/穿越路径、非 Markdown、缺失文件、symlink 越界、abort、stat 失败、40 文件上限。
- `test/assemble.test.js`：自定义 files 独占、子目录项目根锚定、无效配置诊断且不回退、配置路径 TTL 内零 fs。
- `test/skill-contract.test.js`：bootstrap 两分支、before-dev/check/update-spec 的 files 契约、模板不再只认旧目录。
- 独立行为验证：
  - 迁移 fixture：仅写入 `.trellis/doc.json`，root=docs，files 含跨 root 的 `GLOSSARY.md`，未改 Docs/未建旧 Spec。
  - 初始化 fixture：基于真实源码仅建 Core/Ui 最小骨架，doc.json 的 files 与 3 个实际文件一致。
  - update-spec 归属不明：未写任何文件，按 ADR/Domain/Architecture 给出一个具体问题。

## 结论

- [x] 通过（独立审查问题已修复，trellis-check 全量验证通过）
- [ ] 需修复后重审

未提交、未归档；`git status` 中还有与本任务无关的既有未跟踪 `assets/`、其他任务目录，提交时不得 `git add -A`。

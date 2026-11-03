# Feature Design

status: approved
execution_lane: standard

## 目标与非目标

### 目标

- `files` 作为唯一运行时注入清单：多个项目根相对 Markdown 文件，按顺序注入并去重。
- `root` 仅作为 Skill 元数据：默认 `.trellis/spec`，供 bootstrap/update-spec 发现与沉淀文档。
- 无配置项目保留旧 `.trellis/spec` 全树扫描；显式配置采用文件白名单。
- 扩展现有 `trellis-spec-bootstrap` 覆盖迁移与初始化，并同步开发、检查、规范沉淀工作流。

### 非目标

- 不让 root 参与 files 拼接，不支持多个 root、目录注入、显式配置后的递归扫描或正文注入。
- 不新增 Skill，不修改 `SKILL_DIRS`。
- 不修改 FordProject 的业务文档，不增加全局设置字段或新 section。

## 配置契约

文件：`<projectRoot>/.trellis/doc.json`。

初始化：

```json
{
  "root": ".trellis/spec",
  "files": [
    ".trellis/spec/guides/index.md",
    ".trellis/spec/trellis-workflow/task-engine/index.md"
  ]
}
```

迁移：

```json
{
  "root": "docs",
  "files": [
    "GLOSSARY.md",
    "docs/agents/domain.md",
    "docs/quality/unity-validation.md"
  ]
}
```

运行时规则：

1. 配置不存在：扫描 `.trellis/spec/`，沿用旧渲染。
2. 配置存在：files 必须为非空字符串数组，每项为项目根相对 Markdown 完整路径。
3. 只注入 files，按配置顺序展示，归一化后去重；目录和未配置文档不出现。
4. 拒绝空 files、非数组/非字符串、绝对路径、盘符、NUL、`..` 穿越、非 Markdown、目标缺失及 symlink/junction 越界。
5. 任一 files 项无效则整组无效：不加载部分文件，不回退旧扫描。

Skill root 规则：

1. root 缺省为 `.trellis/spec`；初始化显式写出。
2. root 作为 Skill 的默认发现与沉淀起点，不参与运行时注入。
3. root 不与 files 拼接，也不限制 files 必须位于 root 内。
4. Skill 使用 root 前校验其为项目根内目录；无效时停止写入并说明，不影响有效 files 的读取。
5. root 只提供默认归属，不自动判断 ADR/Domain/Quality 分类。

## 注入模块

保持 `trellis:spec-index`、`injectSpecIndex` 与 `appendSpecInstruction` 不变。

`lib/spec.js` 新增一个渲染入口：

```text
projectRoot + signal
  → 无配置 → listProjectSpecs + formatSpecIndexInstruction
  → 有效 files → 校验文件 + formatDocFilesInstruction
  → 无效 files 配置 → formatDocConfigErrorInstruction
```

- `formatDocFilesInstruction(files, { root: projectRoot })` 输出文件完整相对路径、项目根锚点、按需阅读与冲突确认约束。
- `formatDocConfigErrorInstruction()` 返回固定短文本：配置无效、未回退旧 Spec、可通过 bootstrap 修复；不含异常、绝对路径或正文。
- `lib/index.js::resolveSpecIndex` 只等待 `string | null`，复用 5 秒 TTL + LRU。
- 运行时无需 stat root，改变 root 不改变注入文本。

## Bootstrap 两分支

共同前置：读取现有配置，展示候选，已有配置不静默覆盖，写入后读回验证。

**迁移分支**：

1. 有界查找候选：Agent 导航、Docs 首页、ADR、Domain、Quality 或用户指定文件；跳过依赖、生成与归档目录。
2. 确认一个主 root 和多个 files；含导航文件时先检查链接覆盖，不机械默认 `docs/README.md`。
3. root 写主文档体系根；files 写完整项目根相对路径，可包含 root 外文件。
4. 只写 `.trellis/doc.json`，不改 Docs 正文。

**初始化分支**：

1. 保留现有最小 Spec 骨架流程。
2. 写 `root: ".trellis/spec"`，files 记录实际创建且需要注入的 Markdown 文件。
3. 已有配置先报告并征得确认；已有 Docs 且用户希望复用时进入迁移分支。

## 工作流消费者

- before-dev/check：无配置读旧分层 Spec；显式配置按任务相关性读取 files，有导航先读导航。
- update-spec：root 仅作默认沉淀起点；更新已有文件正文无需改配置；新建需注入文档时必须把完整相对路径加入 files；root 无效则停止写入；归属不明询问用户。
- feat/refactor/模板：统一改为“项目配置的规范文件与质量门”。

## 验证计划

```sh
node --test test/spec.test.js test/doc-config.test.js test/assemble.test.js test/native-steps.test.js
node --test
git diff --check
```

覆盖：

- 无配置兼容、默认清单、多文件顺序/去重、root 不参与注入。
- 空 files、损坏 JSON、错误类型、绝对/穿越、非 Markdown、缺失、symlink 越界、固定诊断。
- 多文件独占、项目根锚定、任一文件失效不回落旧 Spec、TTL 内零 fs。
- bootstrap/Skill 升级落盘与迁移/初始化行为。

## 风险与回滚

- files 漏维护：新文档不会注入；由 bootstrap 初始化清单、update-spec 同步和行为测试控制。
- root 被误当注入根：以“改变 root 不改变输出”测试防回归。
- 缓存滞后：最多 5 秒，TTL 后重新解析。
- 回滚：恢复旧 files 或删除配置；代码按提交 `git revert`，无数据迁移。

## 人审检查点

- [x] files 是唯一注入清单，root 仅供 Skill 使用。
- [x] 无配置保留旧扫描；显式配置采用文件白名单。
- [x] 不新增 Skill，bootstrap 支持 root + 多文件迁移与初始化。
- [x] 用户已批准设计。

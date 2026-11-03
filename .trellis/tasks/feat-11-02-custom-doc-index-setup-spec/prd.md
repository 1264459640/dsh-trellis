# Feature PRD

## 背景

Trellis 当前把项目工程文档入口硬编码为 `.trellis/spec/`，多个工作流 Skill 也直接引用其中的分层文档。对于已有 Docs 体系的项目，只改导航或只改注入都会留下第二条上下文路径。

本任务修改 dsh-trellis 的通用文档配置与相关工作流：通过 `.trellis/doc.json` 声明一组项目根相对 Markdown 文件路径，并保留一个供 Skill 使用的文档根目录元数据；现有 `trellis-spec-bootstrap` 增加迁移分支；开发前、检查与规范沉淀共同尊重配置。不修改 FordProject 的业务文档。

## 已确认决策

1. `files` 是**注入契约**：非空字符串数组，每项都是项目根相对的 Markdown 文件完整路径，支持多个并保持顺序、归一化后去重。
2. `root` 是 **Skill 元数据**：默认 `.trellis/spec`，为 bootstrap、update-spec 等提供文档发现与沉淀的默认根目录。
3. `root` 不参与 files 的路径拼接，不作为第二个注入入口，也不限制 files 必须位于 root 内；运行时注入只看 files。
4. 无 `.trellis/doc.json` 时保留旧 `.trellis/spec/` 全树扫描；显式配置后只注入 files 白名单。
5. 初始化项目显式写入默认 root 和实际创建的 Spec 文件；迁移项目写入主文档根与用户确认的多个 Docs 文件。
6. 不新增独立 Skill；在现有 `trellis-spec-bootstrap` 中增加迁移分支。
7. 只注入文件路径与阅读约束，不注入正文。
8. files 配置无效时不回退旧 Spec，但注入短诊断；root 在 Skill 实际使用前单独校验，不影响有效 files 的运行时注入。
9. 新增需要注入的文档时，规范沉淀流程必须同步维护 files。

## 范围

### In Scope

- 读取 `.trellis/doc.json`，支持多个项目根相对 Markdown 文件。
- 无配置时保留旧扫描；显式配置时按 files 顺序注入文件并去重。
- 校验每个注入文件的项目根 containment、存在性、Markdown 类型和路径安全。
- files 配置无效时不扫描旧 Spec，通过同一 section 注入短诊断。
- root 仅用于 Skill 的候选文档发现、默认沉淀位置与导航；Skill 使用前校验其项目根 containment 和目录有效性。
- 修改 `trellis-spec-bootstrap`：
  - **迁移分支**：确认主文档根与一个或多个权威文档，写 root/files，不搬运或改写正文。
  - **初始化分支**：保留最小 Spec 骨架，写默认 root 和实际创建文件的完整相对路径。
- 同步 `trellis-before-dev`、`trellis-check`、`trellis-update-spec`、`trellis-feat`、`trellis-refactor` 与相关模板：
  - 无配置模式维持旧行为；
  - 显式配置模式从 files 读取相关规范；
  - Skill 可将 root 作为默认发现/沉淀起点，但归属不明时必须询问；
  - 新增需注入文档时同步更新 files。
- 复用现有 Skill 版本升级机制，不调整 `SKILL_DIRS`。
- 补充单元测试、真实 assembly 测试、Skill 行为验证和中英文文档。

### Out of Scope

- 不让 root 参与注入路径拼接，不支持多个 root、目录注入、显式配置后的递归扫描或正文注入。
- 不新增 `setup-spec` 或其他独立 Skill。
- 不迁移、精简或重写 FordProject 的业务文档。
- 不增加全局插件路径设置或 Web 设置字段。
- 不自动总结、合并或校验文档中的业务规则，不建立复杂文档映射表。
- 不重写历史任务、归档任务或其上下文清单。

## 验收标准

- [ ] **AC1 无配置兼容**：不存在 `.trellis/doc.json` 时，注入内容与原 `.trellis/spec/` 扫描结果一致。
- [ ] **AC2 初始化清单**：默认 root 为 `.trellis/spec`，files 列出实际规范文件时，只注入这些文件；未列出的其他 Markdown 不进入清单。
- [ ] **AC3 多文件独占且 root 不干扰**：自定义多个项目根相对文件时，section 按配置顺序只包含这些文件，不包含目录、其他旧 Spec 或正文；重复项只出现一次，改变 root 不改变 files 的解析或输出。
- [ ] **AC4 子目录可用**：会话 cwd 位于项目子目录时，所有 files 仍按 allowlist 命中的项目根解析和展示。
- [ ] **AC5 files 错误可诊断且不降级**：配置损坏、files 缺失/类型错误/为空、任一路径越界、目标不存在或不是 Markdown 文件时不扫描旧 Spec；同一 section 给出短修复提示，对话不中断。
- [ ] **AC6 root 独立校验**：root 缺失时 Skill 默认 `.trellis/spec`；root 越界或不是目录时，相关 Skill 在写入前停止并说明，不影响有效 files 的运行时注入。
- [ ] **AC7 热路径有界**：连续装配在现有 TTL 内不重复读取配置或扫描文件；配置变更最迟在 TTL 后生效。
- [ ] **AC8 迁移分支**：bootstrap 支持确认主 root 和多个权威文档并写入完整相对路径；只改配置，不修改 Docs 正文。
- [ ] **AC9 初始化分支**：bootstrap 写默认 root 和实际创建的规范文件清单；已有配置和文档不被静默覆盖。
- [ ] **AC10 工作流一致**：before-dev/check 使用 files；update-spec 可将 root 作为默认沉淀起点，新增需注入文档同步 files，归属不明时询问；feat/refactor/模板不再把旧目录描述为唯一质量门。
- [ ] **AC11 分发与回归**：修改后的既有 Skill 可随版本升级分发，无新增注册项；相关单测、assembly、行为验证与完整 `node --test` 全部通过。

## 约束与风险

- files 是显式白名单：未列入的文档不会被注入，新增规范文档必须同步维护清单。
- 任一 files 项无效时整份文件清单无效，避免只加载部分规则；root 的问题由实际使用它的 Skill 报告，避免无关地切断读取链。
- 配置读取复用现有短 TTL memo；files 解析与安全集中在 `lib/spec.js`，调用方只消费文本或 null。
- root 只提供默认文档归属，不足以自动判断 ADR/Domain/Quality 等具体分类，update-spec 仍需沿导航或询问用户。

## 相关代码/文档

- `lib/spec.js`、`lib/index.js`、`lib/resolve.js`：files 发现、渲染、缓存与装配。
- `skills/trellis-spec-bootstrap/SKILL.md`：迁移、初始化及 root 校验。
- `skills/trellis-before-dev/SKILL.md`、`skills/trellis-check/SKILL.md`、`skills/trellis-update-spec/SKILL.md`：读取与沉淀一致性。
- `skills/trellis-feat/SKILL.md`、`skills/trellis-refactor/SKILL.md`、`skills/_templates/`：移除旧目录唯一性表述。
- `test/spec.test.js`、`test/assemble.test.js`、`test/native-steps.test.js`：发现、装配、memo 与 Skill 升级回归。
- `README.md`、`README_EN.md`：配置与工作流说明。

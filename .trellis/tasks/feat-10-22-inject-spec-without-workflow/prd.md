# Feature PRD: 免 workflow.md 下的 Spec 动态索引与阶段感知注入

## 背景
- 本插件（dsh-trellis）不再向目标项目的 `.trellis/` 注入和维护 `workflow.md`，以保持轻量免配置并减少对工作区的非必要改动。
- 移除了 `workflow.md` 后，原有依靠 `workflow.md` 触发提示词和提供 Spec 指引的通路出现缺口：系统在开工和会话进行过程中，模型无法及时感知到项目中是否存在 `.trellis/spec/` 工程规范，也不会在规划（planning）或实施（in_progress）阶段被及时提醒阅读 Spec，导致编写代码时容易遗漏架构边界和质量门禁。
- 需要在不依赖、不注入 `workflow.md` 的前提下，建立高信噪比、自动感知的 Spec 注入机制。

## 范围
### In Scope
1. **Spec 目录扫描与索引解析**：
   - 解析目标项目的 `.trellis/spec/` 目录，轻量扫描规范入口（如 `guides/`、`<package>/<layer>/index.md` 等文档）。
2. **系统提示词常驻 Spec 索引注入**：
   - 在 `system-prompt/assemble` 钩子中，当目标项目包含 Spec 文档时，注入紧凑的 `trellis:spec-index` section，使模型在一开始就具备项目规范视野。
3. **阶段感知与步骤级 Spec 督促**：
   - 升级内置面包屑 `FALLBACK_BREADCRUMBS`，在规划阶段（`planning`）明确引导核对 Spec，在实施阶段（`in_progress`）提醒先研读 Spec 再编写代码。
   - 增强当前活跃步骤（`formatStepPrompt`）的提示词生成，当步骤声明了 `step.spec` 或涉及工程核心时，强化前置检查清单的阅读要求。
4. **单元测试与集成测试覆盖**：
   - 编写针对 Spec 扫描、格式化、section 注入及无 Spec 场景降级的完备测试用例。

### Out of Scope
- 不重新生成或修改目标项目的 `.trellis/workflow.md` 文件。
- 不引入重度的 AST 代码路径匹配器或全量文档正文盲目灌入（避免 Context 膨胀与 token 浪费）。
- 不破坏现有的规划期只读保护逻辑（`enforceReadonlyPlanning`）与 Denylist 工具过滤策略。

## 验收标准
- [ ] 当项目存在 `.trellis/spec/` 且包含规范文件时，`system-prompt/assemble` 生成的 sections 中包含 `trellis:spec-index`，内容列出 Spec 文件相对路径列表及前置阅读约束。
- [ ] 当项目不存在 `.trellis/spec/` 目录或目录为空时，不注入 `trellis:spec-index`，不增加无意义的 token 开销。
- [ ] 内置的 `FALLBACK_BREADCRUMBS` 包含明确的 Spec 阶段阅读指引，中英文环境清晰友好。
- [ ] `lib/breadcrumb.js` 的 `formatStepPrompt` 能正确呈现 Spec 约束与 Pre-dev 检查要求。
- [ ] `node --test` 自动化测试套件全部通过，无回归破坏。

## 约束与风险
- **Context 预算控制**：严禁全量无脑注入 Spec 全文；仅注入紧凑的 Spec 文件路径清单与强约束说明，正文引导模型按需按需 `read`。
- **无状态与只读纯函数**：Spec 扫描必须安全轻量，失败时 fail-open（静默降级，不阻断系统启动或对话）。
- **DSH Lossless JSON 约束**：注入的消息与 sections 严禁出现 `undefined` 字段。

## 相关代码/文档
- `lib/index.js`（`system-prompt/assemble` 与 `agent/pre-step` 挂载点）
- `lib/readonly.js`（sections 过滤与组装）
- `lib/state.js`（`FALLBACK_BREADCRUMBS` 定义）
- `lib/breadcrumb.js`（`formatStepPrompt` 格式化）
- `lib/resolve.js`（`trellisPaths` 中的 `specDir`）

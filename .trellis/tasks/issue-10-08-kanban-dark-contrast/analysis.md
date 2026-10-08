# 根因与最小修复方案

## 根因
看板将真实宿主文字 token 与不存在的背景 token、硬编码浅色配色混用。深色主题下文字正确变浅，但主背景回退到白色，选中底色和阶段圆圈也仍为浅色。旧 UI harness 只渲染浅色 fallback，现有 client 测试仅检查结构/编译，因此漏检。

## 修复设计（待用户批准）
1. 保持 TB 统一样式入口，将 surface 从不存在的 bg-layer-0 改为真实宿主 bg-base 或 raised surface token；对浮层/卡片及文字显式建立配色关系，避免继承外部按钮文字色。
2. 选中行、类型徽章、中性计数 chip、成功进度轨道使用宿主语义变量或基于主题表面的混色；颜色映射均保留 fallback，不新增主题监听器、不用 OS 主题覆盖宿主设置。
3. 非当前阶段圆圈改用 TB 表面色，不再固定白底配主题文字；固定深色 CTA 的白字保持成对，不盲目全局替换白色。
4. 在 test/ 下新增主题回归：真实 light/dark token 子集或固定可审计 fixture；验证主标题、选中标题、阶段数字、类型徽章和中性 chip 的配色。测试从当前客户端 bundle 获取渲染结果，避免使用陈旧 client.harness 副本。
5. 在具备浏览器工具的条件下验证紧凑、泳道、列表、详情及明暗切换；无法直接访问现有 GUI 时明确隔离渲染测试与真实安装验收的区别。

## 验收标准
- 不再引用 --dsw-alias-bg-layer-0。
- 深色主题主背景和选中背景不再回退浅色；主要文字/徽章及阶段数字对比度至少 4.5:1（普通文本）。
- 浅色主题同样通过可读性测试，布局和任务交互不变。
- client 编译、全量 node:test、git diff --check 通过。
- 记录验证边界，不启动替代服务器冒充现有 GUI、不自动发布或重启用户桌面应用。

## 预期改动
- lib/client.js
- test/client.test.js 或独立主题测试与 fixture
- .trellis/spec/trellis-workflow/web-ui/index.md（新增主题 token 约定）
- 本任务 report/analysis/fix-note 等产物。

## 宿主契约证据
- @deepseek-ai/dsh-client-ui-theme@0.2.0-rc.2/lib/client.js：design_platform_css_default 在 body 与 body[data-ds-dark-theme] 定义实际 token。
- docs/ref/dsh-0.2.0-rc.2-audit.md 第 105、154 行记录 bg-layer-0 不存在。

用户已通过“批准实施”明确批准本方案，随后于 2026-10-08 明确反馈“验收通过”，授权更新版本号、CHANGELOG、打 tag 并用 gh 推送。修复与验证已完成，发布目标为 0.3.7 / v0.3.7；实施结果与验证证据见 fix-note.md。归档尚未单独授权。

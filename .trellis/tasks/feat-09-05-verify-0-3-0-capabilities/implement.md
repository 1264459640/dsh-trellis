# 实现备忘录 — 0.3.0 新能力验证 + 设置面板修复

## 有序清单

1. **改 lib/client.js TrellisSettingsTab**：
   - zh/en locale 各加 `enforceReadonlyPlanning` 标签（如「规划期只读保护
     （enforceReadonlyPlanning）」+ hint：命中白名单且任务处于规划阶段时，
     剪裁 write/edit 工具面）;
   - 在 inline 复选框之后（或之前）追加一个同构 checkbox：
     `checked: !!(value && value.enforceReadonlyPlanning)`，
     `onChange: (e) => write('enforceReadonlyPlanning', e.target.checked)`。
2. **同步到 profile 安装副本**：将工作区 lib/client.js 复制覆盖
   `<home>\profiles\web\node_modules\@banana-peeljj12\dsh-trellis\lib\client.js`
   （注意保持 LF 或与副本一致；最好用 pnpm 重装/junction 方式，避免裸拷贝）。
   备选：`node scripts/install.mjs` 走 junction 链路。
3. **发布生效**：刷新 GUI 页面（/plugins 静态 serve 新文件）；若 harness
   缓存 bundle 则重启实例（需用户操作，会短暂断开会话）。
4. **GUI 验证（AC1）**：设置页出现复选框，勾选 → 等 saved 提示 →
   检查 settings.yaml 持久化 true。
5. **工具面验证（AC2/AC3）**：开启后，在本 planning 会话下一轮观察自身
   write/edit 是否消失、trellis_artifact_update 是否保留；关闭后恢复。
6. **防御性反例验证（AC4-AC7）**：steps 门禁、布尔类型、artifact 白名单/
   slug 穿越、步骤注入，逐项走查并记录证据到 review.md。
7. **收尾**：test/ 单测（新增或补充）、lint/类型检查、check.md 验收报告。

## 验证命令

- 单测：`npm test`（node --test）
- 类型：`npm run typecheck`（若存在；否则 node --check lib/client.js）
- 发布：`node scripts/install.mjs --dry-run` 预览 → `--profile web` 应用

## 风险点 / 回滚点

- **风险**：client bundle 缓存 —— 页面刷新不生效时需重启实例，验证前
  知会用户；重启会打断当前会话。
- **回滚点**：client.js 的改动是独立小 diff（locale + 一个 checkbox），
  git revert 即可；settings.yaml 的开关删除即回默认。
- **陷阱**：不要动宿主侧裁剪逻辑（已就绪，动它反而引入回归）。

## 后续（start 之前）

- 需用户批准本规划摘要；批准后进入 impl 阶段执行清单。
- 执行时若发现 steps/artifact 等其它新能力缺陷，就地记录、按 issue 流程
  另开任务，不在本任务扩大实现面。
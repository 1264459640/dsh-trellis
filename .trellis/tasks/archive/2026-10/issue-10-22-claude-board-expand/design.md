# Technical Design：脱离宿主座位的 expanded modal

## 已批准范围与实现

只改客户端modal挂载、测试与规范，不改服务端API、任务状态机、绑定、看板视觉结构。

- `lib/client.js`：可选获取宿主 `react-dom.createPortal`；`renderExpandedModal(node)` 在有portal且有document.body时渲染到body，否则返回原node。
- `TaskChip`：chip和popover继续属于rootRef；仅expandedModal经过helper。React管理portal生命周期，不手工搬动节点、不创建第二个React root。
- overlay：保留fixed/inset/zIndex2000，补boxSizing:border-box、isolation:isolate、pointerEvents:auto。
- null board守卫、展开恒刷新、搜索、筛选、Esc/遮罩/关闭和详情逻辑不变。

## 运行时契约（实施时已核实）

安装宿主Web frontend `staticModules` 提供react-dom，是与React同源的平台seed；不需要新npm依赖，也不是需要dsh.client.inject的插件包。ModuleLoader.makeRequire先查seed，缺失时同步throw。try/catch可安全支持最小carrier。

因此无需候选portal API/额外manifest注入路径。fallback只防崩溃，不声称缺少portal的carrier也修复了祖先transform定位。

## 根因与生命周期

Claude实际样式把header actions设为fixed并添加transform:translateY(-50%)；这会创建fixed containing block。body portal脱离该祖先；popover仍锚定原座位并使用rootRef outside-click。

host当前ConversationSessionHeader以 `!hideChrome && Fragment(...)` 条件渲染header utilities，不是仅CSS隐藏；blank切换移除座位子树，React随之清理portal。会话范围slot重挂载契约沿用既有规范。

## 测试落点

- `test/client-portal.test.js`：12项portal/fallback、真实TaskChip/header/hero调用点、popover锚定、loading与遮罩关闭。
- `test/helpers/client-theme.js`：可注入DOM、react-dom及hooks，现有theme回归继续复用原bundle。
- `scripts/verify-modal-browser.mjs`：opt-in真实React/Chromium。加载当前完整bundle，stub state/board；复现Claude实际关键header transform规则。
- light/dark × header/hero × 正常/contain/overflow/transform祖先，共8个viewport/居中/命中场景。
- 搜索、Ctrl+K、Esc、遮罩和关闭按钮，同DOM主题切换、展开状态unmount清理。

## 验证命令

```powershell
node --check lib/client.js
node --check scripts/verify-modal-browser.mjs
node --test
# 需复用已安装浏览器工具；不作为默认test的强依赖
$env:DSH_BROWSER_TEST_TOOLS='<playwright/esbuild/react/react-dom 所在 package.json>'
$env:DSH_BROWSER_EXECUTABLE='<Chromium executable>'
node scripts/verify-modal-browser.mjs
git diff --check
```

## 风险、回滚与部署边界

- 主题token全局body继承；真实浏览器已验证light/dark及同DOM切换，无需复制主题状态。
- z-index2000高于实际Claude chrome层30，无需极大魔法数；不试图覆盖宿主所有原生top-layer。
- portal不可用仍inline，明确保留该carrier的布局局限。
- 回滚仅撤销client的可选portal获取/helper/调用和overlay附加样式；不影响数据和API。
- 安装插件符号链接已指向当前仓库；但host缓存启动时client bundle，无开发watcher，不能承诺现有GUI热更新。当前GUI需认证且其他会话运行，不擅自重启；需用户重新加载插件/应用后完成目视验收。

## 非目标

不手工append/remove React DOM，不做全局overlay manager，不迁移popover，不改主题或board数据协议，不新增npm运行依赖。
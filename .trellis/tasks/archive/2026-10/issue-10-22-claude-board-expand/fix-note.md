# Issue Fix Note

## 状态

代码修复和自动化验证完成。**2026-10-22 用户明确回复“验收通过，归档”**，当前 GUI 人工验收通过并授权归档；人工步骤已记录 verifiedBy=human。仅提交本任务文件，不影响仓库里其他任务的未提交文件。

## 根因

Claude 插件会给已有对话的 header actions 设置 `transform:translateY(-50%)!important`，它创建 fixed containing block。旧实现把 expanded modal 放在 TaskChip/header 内，使其 fixed overlay 相对头部小容器定位，结果挤到右上且 modal 被压窄。新对话走 input dock，未受该头部规则影响。详见 `analysis.md` 的实际主题规则与红绿对照证据。

## 改动摘要

- `lib/client.js`：可选读取宿主平台 seed `react-dom.createPortal`，仅 expanded modal 经 `renderExpandedModal` 挂到 document.body。popover 保持锚定 rootRef；overlay 补 boxSizing/isolation/pointerEvents，z-index 保持2000。任务数据、刷新、搜索筛选、详情和绑定协议不变。
- `test/helpers/client-theme.js`：测试桩允许注入 portal/DOM/hook，并导出相关真实组件供测试使用。
- `test/client-portal.test.js`：12项回归，包括 portal目标、无module/无函数/无DOM/无body fallback、closed不建portal、header与hero真实调用点、popover保留锚定、null board和遮罩关闭。
- `scripts/verify-modal-browser.mjs`：opt-in真实Chromium回归，加载当前client bundle及真实React/ReactDOM，模拟已确认的Claude header transform；不启动替代服务器、不修改现有GUI。
- `.trellis/spec/trellis-workflow/web-ui/index.md`：记录fixed祖先陷阱、平台seed契约、fallback边界和浏览器验证约定。

## 验证

### 1. 复现到修复的同命令红绿对照

```powershell
$env:DSH_BROWSER_TEST_TOOLS='<包含 playwright/esbuild/react/react-dom 的 package.json 路径>'
$env:DSH_BROWSER_EXECUTABLE='<Chromium/Edge 可执行文件路径>'
node scripts/verify-modal-browser.mjs
```

本机工具复用 `E:/Project/FordProject/docs/architecture/package.json` 下已有包和已安装Edge，未新增项目安装依赖。

- 修复前：overlay=(1608,6,101,48)，modal=(1632,-359.5,53,779)，atBody=false，topHit=false；viewport起点断言失败。
- 修复后：overlay=(0,0,1733,827)，modal=(226.5,24,1280,779)，atBody=true，topHit=true；全部通过。
- light/dark × header/hero × 正常/contain裁切祖先共8个几何场景通过。
- 搜索过滤、Ctrl+K聚焦、Esc、遮罩点击、关闭按钮通过。
- 同一个打开的portal随body token light→dark切换通过；打开状态直接unmount后overlay被清理。
- 页面无未捕获异常。

### 2. 自动化质量门

- `node --check lib/client.js`：通过。
- `node --check scripts/verify-modal-browser.mjs`：通过。
- `node --test`：**164/164通过，0失败、0跳过**。
- 客户端专项48项通过（新增12项portal测试）。测试桩曾因子组件useState落入undefined导致2项失败，已修正桩默认值并重跑全量通过；并非业务代码异常。
- `git diff --check`：通过。
- 本包无独立type-check/lint脚本，未虚报执行。

### 3. 当前GUI与部署边界

- 已确认桌面profile安装的插件符号链接指向当前仓库，源文件修复已就位。
- 当前运行GUI `http://127.0.0.1:51839` 的未认证请求返回 authentication required；未获取或复制用户认证token，未宣称完成该页面实测。
- 未发现从当前实现checkout运行的 `pnpm run dev:web` watcher；不会承诺HMR自动更新。当前宿主在激活时缓存client bundle快照，单独刷新页面未必会读到修改。
- 建议在合适时机重新加载Trellis插件（禁用后启用），再刷新页面；若仍为旧缓存则重启应用。由于其他会话仍运行，本次未擅自重启宿主。

## 人工验收清单

1. 重新加载插件/应用并刷新现有GUI。
2. Claude主题下已有对话打开看板并展开：大看板居中、遮罩覆盖窗口，无右上角裁切。
3. 新对话同样展开，对照无回归。
4. Esc、遮罩、关闭按钮、搜索、筛选与任务详情可用。
5. 用户已于 2026-10-22 确认“验收通过，归档”，以上清单人工验收通过；按三段提交完成代码交付、任务归档与研发日志。

## 兼容性边界与后续债务

- portal不可用的最小carrier继续inline fallback（防崩溃，不保证解决该carrier的祖先定位异常）。当前正式Web shell提供react-dom，因此可用主修复路径。
- 无全局overlay manager、无手工搬DOM、无新增API和依赖安装。
- 自动化隔离浏览器验证不代替用户当前GUI最终验收。
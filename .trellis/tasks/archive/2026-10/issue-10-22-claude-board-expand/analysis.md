# Root Cause Analysis

## 已确认根因

不是 Claude 的配色或任务数据问题，而是展开看板挂在 **带 transform 的头部操作区内**。

实际安装的 Claude 插件 `lib/client.js` 给已有对话的头部操作区使用以下规则（省略无关样式）：

```css
body[data-dsh-claude-style] [data-dsh-header-band~=actions] [data-dsh-header-actions],
body[data-dsh-claude-style] [data-dsh-header-band~=actions] [data-dsh-header-corner] {
  position: fixed !important;
  top: calc(var(--dsh-windows-titlebar-height, 40px) / 2) !important;
  right: var(--dsh-header-band-right) !important;
  transform: translateY(-50%) !important;
  z-index: var(--dsh-claude-layer-chrome) !important;
}
```

transform 创建 fixed containing block。原先 `TaskChip` 把 `KanbanExpandedModal` 放在自己 root 内，因而 modal 的 `position:fixed; inset:0` 相对头部容器而不是 viewport 定位。容器很窄，overlay 缩在右上，modal 被 flex 布局压窄并向上溢出。单纯调高 z-index 不能修复。

新对话使用 `conversation.input.dock`（HeroTaskChip），已有对话使用 `conversation.session.header.utilities`，所以只有已有对话触发这条头部规则，解释了用户反馈的差异。

## 实测反馈环

可执行脚本：`scripts/verify-modal-browser.mjs`。它加载当前完整 client bundle、真实 React/ReactDOM 与真实 Chromium，挂载真实 TaskChip / HeroTaskChip，stub board/state HTTP 响应，并复现上面安装主题的关键规则。脚本不访问或修改用户 GUI、不新起应用服务器。

修复前执行结果（1733×827 viewport）：

```text
source/header overlay={x:1608,y:6,width:101,height:48}
modal={x:1632,y:-359.5,width:53,height:779}
atBody=false, topHit=false
AssertionError: expanded overlay must originate at viewport (0,0)
```

修复后，同一命令结果：

```text
overlay={x:0,y:0,width:1733,height:827}
modal={x:226.5,y:24,width:1280,height:779}
atBody=true, topHit=true
PASS
```

补测祖先 `transform:translateZ(0);overflow:hidden;contain:paint;z-index:1` 仍通过；明暗主题与 header/hero 共8个几何场景通过。

## 排除与修复决策

1. 数据为空/请求失败：不是该几何问题；原有 null board guard 保留，单测继续验证。
2. 单纯 z-index 不够：实际几何已表明 containing block 错位；使用 body portal 脱离祖先。
3. 主题颜色继承：body 全局 tokens 在真实浏览器中 light/dark 及同 DOM 切换正常，不另建主题状态。

## 宿主依赖契约核实

已检查安装宿主：

- Web frontend 的 `staticModules` 提供 `react`、`react-dom` 和 `react-dom/client`。
- `ClientModuleSystem.makeRequire` 先从 seed 查找；模块缺失时同步 throw，可以捕获。
- 因此本次使用宿主提供的 `react-dom.createPortal`，不增加 npm 依赖、不复制 React、不更改 manifest inject。
- 对老旧/最小 carrier，require 失败、createPortal 非函数、document/body 缺失时保持 inline fallback。它只保证不崩溃，**不保证缺少 portal 的 carrier 也能摆脱祖先定位问题**。

## 实现边界

仅 expanded modal 经 `renderExpandedModal` 挂到 body；popover 保持在 rootRef 内。React 管理挂载与卸载，不手工移动 DOM。overlay 补 boxSizing、isolation、pointerEvents，保留 z-index 2000；数据刷新、筛选、搜索、详情、关闭及任务绑定协议不变。

## 验证局限

真实 Chromium fixture 的红绿对照已确认上述机制，不等于用户已打开的 GUI 已加载新 bundle。当前 http://127.0.0.1:51839 对未认证请求返回 authentication required；未读取认证密钥、未操作用户登录会话。用户现有 GUI 的最终目视验收仍需在重新加载插件后完成。
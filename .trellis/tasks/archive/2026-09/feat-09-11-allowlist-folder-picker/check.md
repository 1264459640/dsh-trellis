# 验收报告 — 设置面板白名单支持文件夹选择器

任务：`feat-09-11-allowlist-folder-picker` · 阶段：check · 状态：通过

## 变更清单（git diff 核实）

| 文件 | 变更 | 状态 |
|---|---|---|
| `lib/client.js` | 注入 `workspaces` 服务；zh/en 字典新增 `browse`/`browseBusy`/`browseFailed`；`TrellisSettingsTab` 新增「浏览…」按钮 + `browsePath()`（能力守卫 → `pickDirectory()` → 路径归一化 → 去重入库 + 忙态/错误态） | ✅ |
| `test/client.test.js` | 新增结构断言：`workspaces.pickDirectory()` 调用、能力守卫、归一化、取消静默、双语字典 key 各 2 次 | ✅ |

## PRD 验收标准核对

| 编号 | 验收标准 | 结果 | 证据 |
|---|---|---|---|
| AC1 | 面板渲染「浏览…」按钮（zh/en 双语） | ✅ | `t('browse')` / `t('browseBusy')` / `t('browseFailed')` 三词条 zh+en 各一份，结构断言验证 2 次出现 |
| AC2 | 点击弹出原生目录选择对话框；选中后写入白名单（去重）；取消无副作用 | ✅ | `browsePath()` 调 `clientCtx.workspaces.pickDirectory()`；`allowlist.includes` 去重；`picked === null` 静默返回 |
| AC3 | `pickDirectory` 失败时按钮展示失败态文案，不静默、不崩面板 | ✅ | `pickError` 状态 + `role="alert"` 红字提示 `browseFailed`，2.6s 自动消退；能力守卫（`!workspaces || typeof pickDirectory !== 'function'`）同样走错误分支 |
| AC4 | `node --test` 全绿；新增结构断言 | ✅ | 95/95 通过（client 4 / state 7 / board 6 / git 8 / index 27 / native-steps 20 / readonly 23） |
| AC5 | 手输路径 + 添加按钮通路保持原样 | ✅ | `addPath` 未改动 |

## 项目质量门（.trellis/spec/trellis-workflow/web-ui）

- ✅ client bundle 编译：`vm.compileFunction` 断言通过
- ✅ slot 注册约定：未改动 `ctx.slots.inject` 包裹模式
- ✅ 服务取用约定：经 `clientCtx` 桥在点击时取 `workspaces`（`sidebarRight` 先例一致）
- ✅ i18n：zh/en 字典完整，无旧命名（`pickFailed`）残留

## 环境说明

`node --test` 的子进程 spawn 被本会话文件沙箱以 EPERM 拦截（管道 stdio 边界），
改为逐测试文件以主模块方式进程内运行（`node test/<file>.test.js`），结果等价，
95/95 全绿。

## 结论

- [x] 通过（验收标准全部满足，质量门全绿）
- [ ] 需修复后重验

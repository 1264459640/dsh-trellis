# Feature Code Review

status: passed

## Diff 范围
- `lib/client.js`：注入 `workspaces` 服务；zh/en 字典新增 `browse`/`browseBusy`/`browseFailed`；
  `TrellisSettingsTab` 新增「浏览…」按钮与 `browsePath()`（能力守卫 → `pickDirectory()` →
  归一化 → 去重入库），错误提示 `role="alert"`。
- `test/client.test.js`：新增结构断言（`workspaces.pickDirectory()` 调用、能力守卫、
  归一化正则、取消静默、双语字典 key 各 2 次）。

## 发现
| 级别 | 问题 | 文件 | 建议 |
|------|------|------|------|
| 提示 | `pickDirectory` 返回尾部带 `/` 的路径（如 `D:/Foo/`）时与手输 `D:/Foo` 在 UI 去重层判为不同条目（Host 匹配层无影响，两者均命中）。与既有 `addPath` 的精确字符串去重行为一致，维持现状 | lib/client.js | 可接受，不改 |

## 验证证据
- `trellis-check`：
  - `node test/client.test.js` → 4/4 通过（含新增 folder-picker 断言）
  - `node test/state.test.js` → 7/7 通过
  - `node test/board.test.js` → 6/6 通过
  - `node test/git.test.js` → 8/8 通过
  - `node test/index.test.js` → 27/27 通过
  - `node test/native-steps.test.js` → 20/20 通过
  - `node test/readonly.test.js` → 23/23 通过
  - 合计 95 项测试全绿（`node --test` 子进程 spawn 被沙箱 EPERM 拦截，
    故逐文件以主模块方式进程内运行，结果等价）
- 项目质量门（编译/测试/运行验证，按 `.trellis/spec/`）：
  - `test/client.test.js` 的 `vm.compileFunction` 编译断言通过 → client bundle 语法有效
  - spec `web-ui` 约定：slot 注册经 `ctx.slots.inject` 包裹（未改动）；服务经
    `clientCtx` 桥在点击时取用（`sidebarRight` 先例一致）；i18n zh/en 齐全

## 结论
- [x] 通过（含 `trellis-check` 与任务要求的验证）
- [ ] 需修复后重审

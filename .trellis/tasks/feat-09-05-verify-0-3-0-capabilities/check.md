# 收尾验收报告 — 0.3.0-rc.4 发布（授权状态机 + trellis_task_skip）

## 验收结论

**✅ 通过** — 规划期只读保护重设计已实现、验证、发布为 v0.3.0-rc.4。

## 1. lint / 类型检查 / 测试

| 项 | 命令 | 结果 |
|---|---|---|
| 语法检查 | node --check（lib/index.js, readonly.js, task.js, state.js, client.js） | ✅ 5/5 通过 |
| 单元测试（新） | test/readonly.test.js（node:test） | ✅ 11/11 通过 |
| 全量回归 | node --test（包根） | ✅ **53/53 通过**，无回归 |
| skip 落盘行为断言 | 6 项临时断言（fresh skip / bound 拒绝 / unbind 后 skip / bind 清 skip / clearSkip / missing file） | ✅ 6/6 通过 |
| 工作树 | git status | ✅ 干净，无未提交改动 |

> 注：node:test 在 DSH 文件沙箱受限模式下因 runner spawn 管道 EPERM 无法直接运行
> （已知沙箱边界），故在获得执行权限后于包根运行 `node --test` 完成全量回归；
> CI（.github/workflows/ci.yml）在 ubuntu 上跑 `npm test`。

## 2. 发布资产

| 项 | 值 |
|---|---|
| 版本 | 0.3.0-rc.4（package.json） |
| tgz | dist/banana-peeljj12-dsh-trellis-0.3.0-rc.4.tgz（92759 B） |
| Release | https://github.com/1264459640/dsh-trellis/releases/tag/v0.3.0-rc.4（prerelease，含 tgz 资产，sha256 845c…18190） |
| tag | refs/tags/v0.3.0-rc.4（指向 5ed2bda） |
| 远端 main | 5ed2bda 与本地一致 |
| 发布提交 | 4 个：feat(readonly) + trellis 记录 + bump + gitignore |

## 3. 发布链路说明（回答"为什么 tag 没有生成 release"）

- 单打本地 tag **不会**生成 GitHub Release；release.yml 监听
  `push: tags: ['v*']`，需 tag **推送**到远端才触发。
- 此前 git push 在受限沙箱内因 schannel 无凭据（SEC_E_NO_CREDENTIALS）失败。
- 使用 `gh release create v0.3.0-rc.4 <tgz> --generate-notes --prerelease`
  一步完成：推送 tag + 创建 Release + 上传资产（gh 自带认证，不依赖 git
  schannel）。这是本次发布采用的路径。

## 4. 验收标准对照（check 步骤）

- AC：lint/类型/测试通过 ✅（见上表）
- AC：check.md 验收报告产出 ✅（本文件）
- AC：发布完成 ✅（Release + tag + main 已同步远端）

## 5. 遗留事项

- release.yml 的 `npm publish` 步骤依赖 `secrets.NPM_TOKEN`；本次经 gh 手动
  创建 Release（未走 Actions），npm 发布未执行。若需发布到 npm registry，
  需配置 NPM_TOKEN 后于 Actions 触发或手动 `npm publish`。
- 真机 GUI 复验建议：新对话工具面（read-only）、trellis_task_skip 授权、
  planning 只读，在 rc.4 安装实例上各验一轮（用户已通过方案 B 安装并确认
  行为正确）。
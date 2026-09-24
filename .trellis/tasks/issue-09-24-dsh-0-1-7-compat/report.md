# Issue Report

## 现象
dsh-trellis 在 DSH 0.1.7-rc.1 运行时上面临兼容性断裂：Web 设置面板失效、只读规划强制失效。

## 复现步骤
1. 以 DSH 0.1.7-rc.1 运行（活运行时 checkout `versions/0.1.7-rc.1`）。
2. 加载插件后打开 Web Settings → Plugins → Trellis 标签：面板回退「unavailable」，host 日志警告 `settings namespace unavailable`。
3. 打开 `enforceReadonlyPlanning` 后，规划期工具面裁剪从未生效。

## 期望 vs 实际
- 期望：设置面板可编辑白名单/注入步数等并即时生效；`enforceReadonlyPlanning` 生效。
- 实际：两者都静默失效。

## 影响范围
- host：`lib/settings.js`（`settings.register` 已删）、`lib/index.js`（`system-prompt/assemble` 从 `context.agent` 取 cwd，无此字段）。
- client：`lib/client.js`（`settingsScope.bind({namespace})` 模型已废，命名空间改为 Loader 条目 id）。

## 证据
- `dsh-settings@0.1.7` 的 `SettingsForms`：无 `register()`；`ns = entry.options.id`；live 值 = `entry.fiber.config`；回写 = `settings.update/replace/mutate`。
- 对照 `dsh-settings@0.1.0-rc.6` 的 `SettingsProvider.register(ns, schema, options)`。
- peer 兼容检查（`includePrerelease:true`）判定不挡安装；根因是纯 API 漂移而非版本门槛。

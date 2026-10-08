# Issue #2：暗色模式下看板浅底白字

## 来源与现象
- 来源：https://github.com/1264459640/dsh-trellis/issues/2
- 用户报告版本：@banana-peeljj12/dsh-trellis 0.3.4；当前仓库版本 0.3.6，相关问题仍存在于代码。
- 复现：在 DSH 中开启深色主题，打开 Trellis 紧凑看板或展开大看板；标题和徽章的浅色文字显示在浅色背景上。
- 期望：看板跟随宿主主题，标题、状态徽章、选中任务及阶段数字保持可读；浅色主题不退化。

## 已确认的代码证据
1. lib/client.js 的 TB.color.surface 使用不存在的 --dsw-alias-bg-layer-0，最终始终回退 #FFFFFF。
2. 文字使用有效的 --dsw-alias-label-primary/secondary，会在深色主题切换为浅色，与白色背景冲突。
3. selectBg/selectBgPop、类型徽章底色、中性 chip 和非当前阶段圆圈使用固定浅色；只替换主底色无法完整修复。
4. 宿主 dsh-client-ui-theme@0.2.0-rc.2 定义 --dsw-alias-bg-base、bg-layer-1/2/3，以及 body[data-ds-dark-theme] 的对应暗色值；没有 bg-layer-0。仓库先前兼容性审计也记录了此缺失。

## 范围
仅调整看板主题配色、补充回归测试与防复发规范；不改任务状态机、API、交互布局、发布版本或用户主题偏好。

## 验证状态
已通过只读代码与宿主主题包分析确认原因；尚未进行本轮浏览器复现或修改源码。现有 GUI 直接 HTTP 请求返回 401，不能宣称已验证真实页面。

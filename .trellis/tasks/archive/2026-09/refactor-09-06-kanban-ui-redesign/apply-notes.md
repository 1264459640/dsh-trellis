# Refactor Apply Notes: 看板UI重构（列表与看板解耦及图标化）

## 已应用步骤

### Step 1: 封装自包含内联 SVG 图标集并替换纯文本/Emoji 按钮
- **改动文件**：`lib/client.js`
- **实现细节**：
  - 封装 `renderIcon(name, props)`，提供统一 16x16 / 14x14 / 12x12 规范的矢量图标体系。
  - 替换小看板与大看板头部工具栏的纯汉字按钮为精致的矢量图标按钮。
  - 剥离中英文字典中的原生 Emoji 字符。
- **验证**：`node --check lib/client.js` 静态语法通过。
- **状态**：completed（ai 验证通过）。

### Step 2: 小窗视图解耦为高密度垂直任务列表
- **改动文件**：`lib/client.js`
- **实现细节**：
  - 彻底移除在 400px 内强行并排“规划中/进行中”双列的拥挤布局。
  - 重构为单列流动的 `KanbanTaskItem`：支持完整标题展示、Mono 等宽 slug、工作流左侧彩条强调、当前会话激活呼吸灯、阶段胶囊 Badge 与精炼步骤进度。
  - 顶部 Filter Tabs 集成任务动态数量 Badge。
- **验证**：`node --check lib/client.js` 静态语法通过。
- **状态**：completed（ai 验证通过）。

### Step 3: 大看板泳道容器与工作流联动重构
- **改动文件**：`lib/client.js`
- **实现细节**：
  - 优化工作流 Filter Tabs，支持实时分类计数显示。
  - 工具栏左右平衡布局：左侧为类型筛选器，右侧为内嵌放大镜图标的规整搜索框。
  - 治理多重横向滚动条：消除各行突兀的粗灰色原生滚动条，采用统一容器与微细透明自定义滚动条（`scrollbar-width: thin`）。
  - 空状态列采用优雅的浅虚线微容器，告别干瘪的居中 `(空)` 文本。
  - 升级 `KanbanLaneCard` 现代卡片质感：引入微柔和投影、Hover 微动效与左侧高亮边框。
- **验证**：`node --check lib/client.js` 静态语法通过。
- **状态**：completed（ai 验证通过）。

### Step 4: 详情面板专业工作台化与主次层级升级
- **改动文件**：`lib/client.js`
- **实现细节**：
  - 阶段流转指示器升级为真正的横向步骤连接线（Step Tracker）。
  - 产物列表重构为 IDE 风格的文件列表行：自适应 `.md` / `.yaml` 文件图标，悬浮展示外链跳转图标。
  - 底部操作按钮确立清晰的主次视觉重心：“推进任务”提升为实心品牌色高亮主按钮（Primary Solid Button）；“会话激活/取消”采用次级边框按钮（Secondary Button）。
- **验证**：用户在 Web 页面验收确认。
- **状态**：completed（human 验证通过）。

## 全量验证
- `node --check lib/client.js`：无报错，语法严格符合 ES / CommonJS 规范。
- 无多余依赖，单文件自闭环。

## 最终人审
- [x] 用户确认界面渲染效果与交互无误，可归档

# Feature Design

status: approved
execution_lane: standard

## 目标与非目标

### 目标（Goals）

- 在会话顶部视图栏新增一级「项目文档」视图（与「对话 / 轨迹 / Git」同级），可视化编辑当前项目的 `.trellis/doc.json`。
- 校验与预算**只认 `lib/spec.js` 的既有语义**：任何新逻辑都必须与 `readProjectDocConfig` / `renderDocBodies` 共用同一份实现，杜绝「预览说没事、注入却截断」。

### 非目标（Non-goals）

- 不进主设置页、不进插件配置卡片、不进看板弹窗。
- 不做正文编辑、不做目录/通配符注入、不做撤销历史。
- 不改 `doc.json` 结构与预算常量。

## 需求拆解与实现方案

### 涉及模块与边界

| 文件 | 变化 |
|---|---|
| `lib/spec.js` | 抽出 `planDocBudget()`（唯一预算算法），`renderDocBodies` 改为消费它；新增 `readDocConfigSnapshot()`、`evaluateDocConfig()`、`saveProjectDocConfig()` |
| `lib/index.js` | 新增 `POST /trellis-workflow/api/doc-config`（read / preview / save），保存后失效 `specIndexCache` |
| `lib/client.js` | 注册 `conversation.view` 新条目 + `DocConfigView` 页面组件 + 中英文案 |
| `package.json` | `dsh.client.inject` 增加 `@deepseek-ai/dsh-client-ui-conversation`（座位声明方，保证加载顺序） |
| `test/*` | 预算与保存的纯函数测试、路由测试、客户端渲染与注册测试 |
| `README*.md`、`.trellis/spec/**` | 入口与写接口契约同步 |

### 核心数据流与逻辑拆解

```text
会话顶部视图栏（conversation.view: 对话 / 轨迹 / Git / 项目文档）
  └─ DocConfigView（session 作用域，标准 prop 提供 sessionId + t）
       ├─ 挂载/切换会话：POST {action:'read'}           → readDocConfigSnapshot(磁盘)
       ├─ 编辑：POST {action:'preview'}（防抖 400ms）    → evaluateDocConfig(草稿)，不写盘
       └─ 保存：POST {action:'save'}                    → evaluate → 写 doc.json → read 快照
                                                              │
                                                    specIndexCache.delete(projectRoot)
                                                              │
                                    下一次 system-prompt/assemble 立即读到新配置
```

**唯一预算算法**（重构要点）：

```js
// entries: [{ path, text | null }]  text=null 表示读取失败
planDocBudget(entries) → {
  usedBytes,
  entries: [{ path, bytes, limit, injectedBytes, status, text }]   // status: full|truncated|over-budget|unreadable
}
```

- `renderDocBodies` 读文件后调用它，再按 `status` 拼标记文本 —— 输出与现状逐字节一致（现有 `test/spec.test.js` 断言锁定）。
- `evaluateDocConfig` 用同一函数喂草稿，因此预览的「将截断 / 仅路径」判定与真实注入必然一致（含 512B 最小切片边界）。

### 契约变更

**1）客户端视图注册（新增）**

```js
ctx.slots.inject('conversation.view', () => ctx.slots.register(
  { name: 'conversation.view', id: 'trellis-workflow:docs', order: 20, locale: LOCALE_NS, label: () => t('viewDocs') },
  DocConfigView,
))
```

- 座位是 `list / session` 作用域，注册项只需 `id`（必填）、`order`、`label`；组件由框架传入标准 prop `sessionId` 与绑定到 `locale` 命名空间的 `t`，会话切换按 key 自动重挂载。
- `label` 用 thunk，语言切换时无需重新注册。

**2）HTTP（新增，现有前缀路由内）**

`POST /trellis-workflow/api/doc-config`

```jsonc
// 请求
{ "sessionId": "…", "action": "read" }
{ "sessionId": "…", "action": "preview", "root": ".trellis/spec" | null, "files": ["…"] }
{ "sessionId": "…", "action": "save",    "root": ".trellis/spec" | null, "files": ["…"] }

// 成功
{ "ok": true, "value": {
  "state": "absent" | "configured" | "invalid",
  "root": "…" | null,
  "files": [{ "path": "…", "bytes": 1234, "status": "full|truncated|over-budget|unreadable" }],
  "budget": { "fileMax": 8192, "totalMax": 32768, "usedBytes": 0 },
  "legacy": ["…"] | null          // 仅 state=absent：当前 .trellis/spec 索引到的路径
} }

// 校验失败（preview / save 共用）
{ "ok": false, "error": "invalid", "rootError": "bad-root" | null,
  "details": [{ "index": 0, "path": "…", "reason": "empty|not-markdown|outside|missing|duplicate" }] }
```

- 状态码：403 trust-fence / allowlist；404 会话不存在；400 载荷或校验失败；405 非 POST；500 写失败；sandbox 拒绝 → 403。
- **只返回项目相对路径**，绝不回传项目根或绝对路径。
- 项目根永远来自 `sessions.get(sessionId).header.cwd` → `matchAllowlist`，请求体不可指定。

**3）模块导出（`lib/spec.js`）**

- `planDocBudget(entries)` — 纯函数。
- `readDocConfigSnapshot(fs, projectRoot, { signal })` — 磁盘状态 + 旧索引清单。
- `evaluateDocConfig(fs, projectRoot, { root, files }, { signal })` — 校验 + 预算，返回 `{ ok:true, value } | { ok:false, rootError, details }`。
- `saveProjectDocConfig(fs, projectRoot, { root, files }, { signal, sandboxPolicy })` — 校验通过后写盘。

**写盘格式**：`JSON.stringify({ ...existing, root?, files }, null, 2) + '\n'`，UTF-8 无 BOM；`root` 为空则省略该字段；已有文件中无法识别的顶层字段保留（修复坏配置时整份覆盖）。

### 关键技术选型与取舍

1. **入口 = `conversation.view` 一级视图**（用户指定「加到顶部层级」）
   与「对话 / 轨迹 / Git」同栏，`sessionId` 由框架直接给，天然是项目上下文；不需要看板、不需要新增自定义 slot。代价：`conversation.view` 只为非 blank 会话渲染，新会话首条消息前看不到标签——属宿主行为，接受并记录。
2. **`preview` 作为独立 action，而不是客户端本地算预算**
   预算是服务端语义（UTF-8 字节、行边界、512B 切片）。客户端只提交草稿，服务端用同一函数回答，避免第二份实现；防抖 400ms，文档量小。
3. **文件路径用输入框而不是文件选择器**
   `uiWorkspace` 只有 `pickDirectory`，没有选文件能力；自绘文件树属非目标。未配置态提供「载入当前 `.trellis/spec` 索引」一键填充，覆盖大多数迁移场景。
4. **保存后直接 `specIndexCache.delete(projectRoot)`**
   5s TTL 缓存是热路径必需的，但保存必须立即生效；路由与缓存同处 `lib/index.js`，直接失效即可，不引入版本号或事件。

### 客户端结构（`DocConfigView`）

页面占满视图区，自上而下：

- **页头**：标题「项目文档」+ 副标题 `.trellis/doc.json`、状态胶囊（未配置 / 已配置 / 配置无效 / 未纳管）、预算条（`usedBytes / 32KB`）、主按钮「保存」。
- **说明条**：一句话讲清 `files` 是注入范围、`root` 只是 Skill 元数据。
- **清单**：序号、路径（`title` 全文 + 省略号截断）、字节数、状态徽章（完整 / 将截断 / 仅路径 / 读取失败）、上移 / 下移 / 删除。
- **添加行**：输入框 + 「添加」；客户端只做浅校验（非绝对路径、无 `..`、`.md` 结尾），权威校验由 `preview` 返回。
- **root 行**：输入框 + 说明。
- **空态（absent）**：说明当前走 `.trellis/spec` 扫描（N 个文件，仅索引）+「载入这些文件」+「手动添加」。
- **无效态（invalid）**：警示「当前配置无效，不会注入任何文档」+「新建配置」（清空草稿，保存即覆盖）。
- **未纳管**：项目不在 allowlist 时只读说明，不给保存入口。
- 交互约束：切会话重新拉取；有未保存改动时切换会话/视图给出轻提示；`Escape` 不做全局拦截（交给宿主）。
- 样式只走 `TB.T` / `TB.R` / `TB.color`，不写裸字号与裸圆角。

## 验证计划

1. `node --test test/doc-config.test.js` — `planDocBudget` 边界（8192 / 32768 / 剩余 511 与 512）；`renderDocBodies` 输出不变；`evaluateDocConfig` 六类错误；`saveProjectDocConfig` 写盘格式（缩进、末尾换行、无 BOM、保留未知字段）。
2. `node --test test/doc-config-route.test.js`（新增，mount 级）— trust-fence 403、非 allowlist 403、未知 session 404、read 四态、save 写盘，以及**保存后立即 `ctx.waterfall('system-prompt/assemble', …)` 读到新正文**（证明缓存已失效）。
3. `node --test test/client-doc-config.test.js`（新增，vm 加载真实 bundle）— 断言注册到 `conversation.view`（id/order/label/locale）、四态渲染、增删/排序、preview 请求体、save 请求体、错误行内展示、保存按钮禁用条件。
4. `node --test` 全量回归。
5. 人工验收：真实 GUI 顶部出现「项目文档」标签 → 载入/删除/排序 → 保存 → 下一条消息的 `trellis:spec-index` 段反映新配置。

## 风险与回滚

1. **新增浏览器写入口**：复用 `isTrustedApiRequest` + 会话 cwd → allowlist + `sandboxPolicy` + 只写固定相对路径 `.trellis/doc.json`；错误响应不带绝对路径。
2. **预览与注入不一致**：唯一 `planDocBudget` + 「同输入同输出」断言；测试锁定 `renderDocBodies` 旧输出不变。
3. **缓存导致「保存没生效」**：路由内显式失效，测试用 assemble 瀑布验证。
4. **blank 会话无标签**：宿主不渲染 `conversation.view`；文档写明，不在本期额外补入口。
5. **包加载顺序**：把 `@deepseek-ai/dsh-client-ui-conversation` 加进 `dsh.client.inject`，并用 `slots.inject` 包裹注册。
6. **回滚**：单 commit 覆盖 `lib/spec.js` + `lib/index.js` + `lib/client.js` + `package.json` + 测试；`doc.json` 格式未变，无数据迁移。

## 人审检查点

- [x] 需求拆解完整，实现方案清晰
- [x] 设计已获用户确认（status=approved）后再进入实现

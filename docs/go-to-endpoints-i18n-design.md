# Go To Endpoints — 国际化（i18n）设计说明

**状态：** 已定稿（与产品方确认）  
**日期：** 2026-04-09  
**范围：** 英语（默认）与简体中文；扩展内可配置显示语言。

---

## 1. 目标

- 插件**市场介绍**与**贡献点**中的用户可见文案支持中英（通过 VS Code 标准 `package.nls`）。
- **运行时**通知、进度、Quick Pick、CodeLens、状态栏、对话框等人读文案支持中英。
- **默认语言：** 英文（`displayLanguage` 默认 `en`）。
- **可配置为中文：** 通过扩展设置项切换，**不依赖** VS Code 界面语言。

---

## 2. 语言策略（已确认）

### 2.1 双轨分工

| 类别 | 行为 | 机制 |
|------|------|------|
| **清单（Manifest）** | 随 **VS Code 显示语言** 切换 | `package.json` 中 `%key%` + `package.nls.json` / `package.nls.zh-cn.json` |
| **运行时 UI** | 随扩展配置 **`gotoEndpoints.displayLanguage`** | 自建 `t(key)` + `en.json` / `zh-cn.json`（打包进 `dist/extension.js`） |

**原因：** VS Code 对 `package.nls.*` 的解析与界面语言绑定，无法由扩展设置单独覆盖；运行时则必须满足「VS Code 英文界面 + 扩展中文提示」等场景。

### 2.2 配置项

- **键名：** `gotoEndpoints.displayLanguage`
- **类型：** 枚举：`"en"` | `"zh-cn"`
- **默认：** `"en"`
- **说明（需写入 nls）：** 仅影响通知、进度条、状态栏、CodeLens、搜索框等运行时文案；命令面板中的命令标题、侧栏视图名、设置项说明等仍跟随 VS Code 语言（若已安装对应语言包）。

---

## 3. 应国际化与不应国际化的边界（已确认）

### 3.1 应国际化

- `package.json` 贡献区：`displayName`、`description`、各命令 `title`、视图相关 `title`/`name`/`contextualTitle`、`configuration.title` 及各属性的 `description`。
- 运行时：所有面向用户的 `show*Message`、`withProgress` 的 title/message、Quick Pick 的 placeholder 与说明性文案、状态栏 text/tooltip、CodeLens 操作标题、树节点上的说明性 tooltip。

### 3.2 不应国际化

- 扩展 `name`、`publisher`、**command id**、**配置 key**。
- `console` / 诊断日志（建议固定英文）。
- 类名、方法名、文件路径、HTTP 方法字面、解析用注解名、底层异常的 `error.message` 原文（可对**外层提示句**翻译，技术附录保持原样）。

---

## 4. 运行时实现要点

- **模块位置：** `src/i18n/`（示例：`en.json`、`zh-cn.json`、`bundle.ts` 或 `t.ts`）。
- **API：** `t(key: string, params?: Record<string, string | number>)`；键名建议点分命名（如 `scan.workspace.progressTitle`）。
- **缺 key：** 回退到英文文案；开发构建可对缺 key 打日志便于发现遗漏。
- **配置变更：** `workspace.onDidChangeConfiguration`，当 `gotoEndpoints.displayLanguage` 变化时更新内部 locale，并对 CodeLens、Tree、StatusBar 等执行 `refresh` 或更新展示文本（具体调用点在实现计划中列出）。
- **构建：** 使用 `import` 引入 JSON，由 esbuild 打入单文件 `dist/extension.js`；`tsconfig` 需 `resolveJsonModule` 以满足类型检查。

---

## 5. 清单（package.nls）要点

- 将 `package.json` 中用户可见字符串替换为 `%gotoEndpoints.xxx%` 等形式（命名与 VS Code 惯例一致）。
- 维护 `package.nls.json`（英文）与 `package.nls.zh-cn.json`（简体中文）。
- 确认 `package.nls*.json` 未被 `.vscodeignore` 排除（当前 `src/**` 排除不影响根目录 nls 文件）。

---

## 6. 测试与验收

- 手动：`displayLanguage` 为 `en` / `zh-cn` 各执行：搜索端点、扫描当前文件、扫描工作区、复制 CodeLens、打开树节点；切换配置后状态栏与 CodeLens 应更新（若个别需重载窗口，在实现中注明）。
- 可选：为 `t()` 与回退逻辑编写单元测试。

---

## 7. 文档

- README 可增加简短中英说明：运行时语言由 `gotoEndpoints.displayLanguage` 控制；命令名等清单文案随 VS Code 语言。

---

## 8. 与实现计划的关系

具体文件改动顺序、命令与键名列表见同目录实现计划：`go-to-endpoints-i18n-plan.md`。

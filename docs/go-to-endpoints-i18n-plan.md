# Go To Endpoints — 国际化实现计划

> **For agentic workers:** 可按下方 checkbox 逐项实现；每完成一项勾选并提交（小步提交）。

**Goal:** 为扩展增加英文（默认）与简体中文：清单走 `package.nls`，运行时走 `gotoEndpoints.displayLanguage` + `t()`。

**Architecture:** `package.nls.json` / `package.nls.zh-cn.json` 替换 `package.json` 中的 `%key%`；`src/i18n/en.json` 与 `zh-cn.json` 经 esbuild 打入 `dist/extension.js`，`t()` 读取 `workspace.getConfiguration('gotoEndpoints').displayLanguage`；`onDidChangeConfiguration` 更新 locale 并刷新 CodeLens、树、状态栏。

**Tech Stack:** TypeScript、VS Code Extension API、esbuild bundle、JSON 模块导入。

**设计依据：** `docs/go-to-endpoints-i18n-design.md`

---

## 文件结构（创建 / 修改一览）

| 路径 | 动作 |
|------|------|
| `package.json` | 修改：贡献区字符串改为 `%...%`，新增 `displayLanguage` 配置 |
| `package.nls.json` | 新建 |
| `package.nls.zh-cn.json` | 新建 |
| `tsconfig.json` | 修改：`resolveJsonModule: true` |
| `src/i18n/en.json` | 新建：英文键值表 |
| `src/i18n/zh-cn.json` | 新建：中文键值表 |
| `src/i18n/index.ts` | 新建：`t()`、初始化、配置监听 |
| `src/extension.ts` | 修改：全部用户文案改 `t()`，注册配置刷新 |
| `src/indexer/indexManager.ts` | 修改：用户可见消息改 `t()`（需传入 `t` 或 import 单例） |
| `src/features/searchProvider.ts` | 修改 |
| `src/features/scanCurrentFile.ts` | 修改 |
| `src/features/scanWorkspace.ts` | 修改 |
| `src/features/codeLensProvider.ts` | 修改 |
| `src/features/endpointTreeProvider.ts` | 修改 |
| `src/utils/messageUtils.ts` | 按需修改（若需统一前缀键名） |
| `src/test/i18n.test.ts`（可选） | 新建：测试 `t()` 回退 |
| `README.md` | 可选：中英各一段说明语言设置 |

---

### Task 1: TypeScript 与 i18n 运行时内核

**Files:**
- Modify: `tsconfig.json`
- Create: `src/i18n/en.json`, `src/i18n/zh-cn.json`, `src/i18n/index.ts`

- [ ] **Step 1: 启用 JSON 模块解析**

在 `tsconfig.json` 的 `compilerOptions` 中增加：

```json
"resolveJsonModule": true
```

- [ ] **Step 2: 添加英文与中文文案骨架**

`src/i18n/en.json` 与 `src/i18n/zh-cn.json` 先各放少量占位键（后续 Task 补全），结构为扁平对象，键名用点分风格，例如：

```json
{
  "statusBar.tooltip": "Search endpoints",
  "scan.current.progressTitle": "Scanning current Java file..."
}
```

两文件键集合保持一致。

- [ ] **Step 3: 实现 `src/i18n/index.ts`**

要点：

- `import * as en from './en.json'`、`import * as zhCn from './zh-cn.json'`（类型可用 `as const` 或 `Record<string, string>`）。
- 维护 `let currentLocale: 'en' | 'zh-cn'`。
- `getLocale(): 'en' | 'zh-cn'` 从 `vscode.workspace.getConfiguration('gotoEndpoints').get('displayLanguage', 'en')` 读取，非法值回退 `'en'`。
- `t(key: string, vars?: Record<string, string | number>): string`：从当前 locale 取串，若无则回退 `en`，仍无则返回 `key` 并在 `ExtensionMode.Development` 下 `console.warn`。
- 占位符：支持将 `{name}` 或 `{0}` 替换为 `vars`（实现前统一选一种并在全项目一致，推荐 `{name}` 可读性更好）。
- `initI18n(context: vscode.ExtensionContext, onLocaleChange: () => void): vscode.Disposable`：注册 `onDidChangeConfiguration`，当 `e.affectsConfiguration('gotoEndpoints.displayLanguage')` 时更新 `currentLocale` 并调用 `onLocaleChange()`。

运行：`npm run check-types`，预期：无类型错误。

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json src/i18n/
git commit -m "feat(i18n): add runtime locale module and JSON bundles"
```

---

### Task 2: package.json 与 package.nls

**Files:**
- Modify: `package.json`
- Create: `package.nls.json`, `package.nls.zh-cn.json`

- [ ] **Step 1: 在 `configuration.properties` 中新增**

```json
"gotoEndpoints.displayLanguage": {
  "type": "string",
  "enum": ["en", "zh-cn"],
  "default": "en",
  "description": "%config.displayLanguage.description%",
  "enumDescriptions": [
    "%config.displayLanguage.enum.en%",
    "%config.displayLanguage.enum.zhCn%"
  ]
}
```

（若 VS Code 版本对 `enumDescriptions` 支持有差异，可仅用 `markdownDescription` 一段英文说明；以当前 `engines.vscode` 为准。）

- [ ] **Step 2: 将下列字段改为占位符**

包括但不限于：`displayName`, `description`, `contributes.configuration.title`, 每个 command 的 `title`, `viewsContainers.activitybar[].title`, `views.endpoint-explorer[].name`, `views.endpoint-explorer[].contextualTitle`, 以及现有各 `configuration.properties.*.description`。

为每个唯一英文句分配稳定 key（如 `command.search.title`, `view.explorer.title`, `config.includeGlobs.description`），在 `package.nls.json` 写英文，`package.nls.zh-cn.json` 写简体中文。

- [ ] **Step 3: 验证 vsix 包含 nls**

运行 `npm run package` 后检查生成的 `.vsix`（zip）根目录含 `package.nls.json` 与 `package.nls.zh-cn.json`。

- [ ] **Step 4: Commit**

```bash
git add package.json package.nls.json package.nls.zh-cn.json
git commit -m "feat(i18n): package.nls for manifest and displayLanguage setting"
```

---

### Task 3: extension.ts 接入 t() 与刷新回调

**Files:**
- Modify: `src/extension.ts`

- [ ] **Step 1: 在 `activate` 最早处调用 `initI18n`**

将 `onLocaleChange` 设为刷新：更新 `statusBarItem` 的 `text`/`tooltip`；若已有 `EndpointCodeLensProvider` / `EndpointTreeProvider` 实例，调用其 `refresh` 方法（无则在本 Task 末尾拿到实例后再接，见 Step 2）。

- [ ] **Step 2: 替换所有用户可见字符串**

含：`statusBarItem.tooltip`、`updateStatusBar` 内 `text`、`withProgress` 的 title/message、`showWarningMessage` 及按钮「确定」「取消」、`showInfo` 启动提示等。键写入 `en.json` / `zh-cn.json`。

- [ ] **Step 3: 运行编译**

```bash
npm run compile
```

预期：通过。

- [ ] **Step 4: Commit**

```bash
git add src/extension.ts src/i18n/en.json src/i18n/zh-cn.json
git commit -m "feat(i18n): wire extension activation and status bar to t()"
```

---

### Task 4: indexManager.ts

**Files:**
- Modify: `src/indexer/indexManager.ts`

- [ ] **Step 1: 将 `vscode.window.show*Message` 与 `withProgress` 中人读字符串改为 `t()`**

包括：`Indexing Java endpoints...`、`Finding Java files...`、`No endpoints found...`、`Failed to build...`、`Index is currently being built...`、中文缓存提示等。在 `en.json` / `zh-cn.json` 增加对应键。

注意：`progress.report` 中带数字的句子用 `t('key', { total: totalFiles, ... })`。

- [ ] **Step 2: `npm run compile`**

- [ ] **Step 3: Commit**

```bash
git add src/indexer/indexManager.ts src/i18n/en.json src/i18n/zh-cn.json
git commit -m "feat(i18n): localize indexManager user messages"
```

---

### Task 5: searchProvider、scanCurrentFile、scanWorkspace

**Files:**
- Modify: `src/features/searchProvider.ts`, `src/features/scanCurrentFile.ts`, `src/features/scanWorkspace.ts`

- [ ] **Step 1: 逐文件将消息与 QuickPick placeholder 改为 `t()`**

`searchProvider.ts`：`showInformationMessage` 文案、`quickPick.placeholder`、必要时 `showErrorMessage`。

`scanCurrentFile.ts` / `scanWorkspace.ts`：所有 `showInformationMessage` / `showWarningMessage` / `showErrorMessage`。

补充 `en.json` / `zh-cn.json` 键。

- [ ] **Step 2: `npm run compile`**

- [ ] **Step 3: Commit**

```bash
git add src/features/searchProvider.ts src/features/scanCurrentFile.ts src/features/scanWorkspace.ts src/i18n/
git commit -m "feat(i18n): localize search and scan features"
```

---

### Task 6: codeLensProvider 与 endpointTreeProvider

**Files:**
- Modify: `src/features/codeLensProvider.ts`, `src/features/endpointTreeProvider.ts`

- [ ] **Step 1: CodeLens `title` 字符串 `t()`**

例如「复制 [...]」类文案；若 `EndpointCodeLensProvider` 需响应语言切换，确保类上有 `refresh()` 或对外暴露 `dispose` 后由配置变更触发 `vscode.commands.executeCommand('editor.action.refreshCodeLens')` 或 provider 注册时保存 disposable 并更新内部 locale——与 Task 3 的 `onLocaleChange` 对齐（优先调用已有 refresh API）。

- [ ] **Step 2: 树节点 `tooltip` / `title` 人读部分 `t()`**

`endpointTreeProvider.ts` 中「打开端点定义」等。

- [ ] **Step 3: `npm run compile`**

- [ ] **Step 4: Commit**

```bash
git add src/features/codeLensProvider.ts src/features/endpointTreeProvider.ts src/i18n/
git commit -m "feat(i18n): localize CodeLens and endpoint tree"
```

---

### Task 7: 配置变更时统一刷新

**Files:**
- Modify: `src/extension.ts`（及必要时 `EndpointCodeLensProvider` / `EndpointTreeProvider`）

- [ ] **Step 1: 确认 `onLocaleChange` 执行**

- 更新状态栏（`updateStatusBar` 同计数逻辑，仅文案来自 `t()`）。
- `endpointTreeProvider` 调用 `refresh()`（若无则 `_onDidChangeTreeData.fire()`）。
- CodeLens：`vscode.commands.executeCommand('editor.action.refreshCodeLens')` 或 provider 自带刷新。

- [ ] **Step 2: 手动验证**

切换 `gotoEndpoints.displayLanguage`，状态栏与 CodeLens 应在不重启窗口的情况下更新（树视图标题为 manifest，可能仍为 VS Code 语言，属设计预期）。

- [ ] **Step 3: Commit**

```bash
git add src/extension.ts src/features/endpointTreeProvider.ts
git commit -m "fix(i18n): refresh UI on displayLanguage change"
```

---

### Task 8（可选）: 单元测试与 README

**Files:**
- Create: `src/test/i18n.test.ts`（若测试运行器已配置）
- Modify: `README.md`

- [ ] **Step 1: 为 `t()` 写测试**

Mock `workspace.getConfiguration` 返回 `en` / `zh-cn`，断言同一 key 不同输出；未知 key 回退英文。

- [ ] **Step 2: 运行测试**

```bash
npm test
```

预期：通过。

- [ ] **Step 3: README 增加语言说明**（中英各一小段）

- [ ] **Step 4: Commit**

```bash
git add src/test/i18n.test.ts README.md
git commit -m "docs(i18n): tests and README language note"
```

---

## 计划自检（对照设计文档）

| 设计要求 | 对应 Task |
|----------|-----------|
| `displayLanguage` en/zh-cn 默认 en | Task 2 |
| 清单 nls + 运行时双轨 | Task 1–2 |
| 运行时全覆盖（通知/进度/QuickPick/CodeLens/状态栏/树） | Task 3–7 |
| 日志不翻译 | 实现时不改 `console.log` 人读策略（保持英文） |
| 构建打入单包 | Task 1 import JSON + esbuild |
| 配置变更刷新 UI | Task 7 |

---

## 执行方式说明

计划已保存至 `docs/go-to-endpoints-i18n-plan.md`（路径按仓库约定，未使用 `docs/superpowers/plans/`）。

**可选执行方式：**

1. **分 Task 人工/Agent 逐步做**：按 checkbox 顺序，每 Task 编译通过再提交。  
2. **本会话连续实现**：在同一对话中从 Task 1 依次改代码直至完成。

如需我**在本仓库直接开始改代码**，请回复「开始实现」或指定从某一 Task 开始。

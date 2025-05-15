# Go To Endpoints - VS Code 扩展

一个专为 Java 开发者设计的 VS Code 扩展，可以快速搜索和导航到 Spring Controller 和 Feign 客户端的 API 端点。帮助开发者在大型 Java 项目中高效定位和管理 API 端点。

## 功能特性

- **快速搜索端点**：通过路径或方法名快速查找端点
- **端点树视图**：在侧边栏按层次结构显示所有端点
- **智能搜索排序**：根据匹配度智能排序搜索结果
- **一键导航**：直接跳转到端点定义位置
- **复制端点路径**：在端点方法处显示复制按钮，一键复制完整路径
- **实时索引更新**：文件保存时自动更新索引
- **高效缓存机制**：支持索引缓存，提高重启后加载速度

### 支持的框架

- **Spring MVC**：支持 `@RestController`, `@Controller`, `@RequestMapping`, `@GetMapping`, `@PostMapping` 等注解
- **Feign 客户端**：支持 `@FeignClient` 接口的识别和解析

## 使用方法

### 搜索端点

1. 使用快捷键 `Ctrl+Shift+\`（macOS: `Cmd+Shift+\`）
2. 或从命令面板运行 `Go To Endpoint: Search Endpoints`
3. 在搜索框中输入查询：
   - `/users` - 搜索包含此路径的端点
   - `getUserById` - 搜索包含此方法名的端点

### 端点树视图

1. 点击 VS Code 侧边栏中的端点浏览器图标
2. 或从命令面板运行 `Go To Endpoint: 刷新端点树视图`
3. 浏览按路径层次组织的所有端点
4. 点击端点直接跳转到源代码定义位置

### 复制端点路径

1. 打开包含 Spring Controller 或 Feign 客户端的 Java 文件
2. 找到带有 `@RequestMapping`, `@GetMapping`, `@PostMapping` 等注解的方法
3. 在注解上方会显示一个复制按钮的 CodeLens，点击即可复制完整路径

### 扫描工作区

1. 侧边栏端点浏览器中点击刷新按钮
2. 或从命令面板运行 `Go To Endpoint: 清除缓存并扫描整个工作区`
3. 扫描完成后，所有端点将被更新并显示在端点树视图中

## 安装

1. 从 VS Code 扩展市场安装
2. 或使用 Quick Open（`Ctrl+P`），运行命令：
   ```
   ext install go-to-endpoints
   ```

## 配置选项

在 VS Code 设置中可以自定义以下选项：

- `gotoEndpoints.includeGlobs`：设置要包含在端点索引中的文件的 Glob 模式（默认：`["**/*.java"]`）
- `gotoEndpoints.excludeGlobs`：设置要排除在端点索引外的文件的 Glob 模式（默认：`["**/node_modules/**", "**/target/**", "**/build/**", "**/.*/**", "**/*Test.java"]`）
- `gotoEndpoints.enableCache`：启用缓存以加速索引（默认：`true`）
- `gotoEndpoints.concurrencyLimit`：并发解析文件的数量限制（默认：`50`）
- `gotoEndpoints.autoIndex`：是否在扩展启动时自动索引（默认：`true`）
- `gotoEndpoints.usePrefilter`：是否在解析前预过滤不包含控制器注解的文件（默认：`true`）
- `gotoEndpoints.fileExtensions`：要扫描的文件扩展名（默认：`[".java"]`）
- `gotoEndpoints.enableDecorations`：是否启用 API 端点的行装饰器（默认：`true`）
- `gotoEndpoints.enableCodeLens`：是否启用 API 端点的复制按钮（默认：`true`）
- `gotoEndpoints.notificationTimeout`：通知消息自动关闭的时间（毫秒）（默认：`3000`）

## 键盘快捷键

- `Ctrl+Shift+\`（macOS: `Cmd+Shift+\`）：搜索端点
- `Ctrl+Shift+J`（macOS: `Cmd+Shift+J`）：扫描当前 Java 文件
- `Ctrl+Shift+K`（macOS: `Cmd+Shift+K`）：扫描整个工作区

## 性能优化

- 扩展仅在打开 Java 文件时激活
- 使用文件缓存机制，重启 VS Code 后无需重新扫描未更改的文件
- 支持并发解析，大型项目也能快速建立索引
- 可自定义排除模式，避免扫描不必要的文件

## 注意事项

- 首次打开 Java 项目时，扩展会自动在后台构建端点索引
- 索引过程为异步进行，大型项目可能需要一些时间
- 文件修改后会自动更新索引，无需手动刷新
- 状态栏会显示当前已索引的端点数量
- 扩展仅处理本地文件系统中的 Java 文件，不支持远程开发环境

## 更新日志

请查看 [CHANGELOG.md](CHANGELOG.md) 文件了解版本更新历史。

## 反馈与贡献

如发现问题或有功能建议，请在 GitHub 仓库提交 Issue。
欢迎提交 Pull Request 贡献代码。

## 许可证

MIT

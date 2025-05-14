# Go To Endpoints - VSCode Extension

一个用于快速搜索和导航到Java Controller和Feign端点的VSCode扩展。帮助开发者在大型Java项目中快速定位和导航到API端点。

## 功能特性

- **快速搜索端点**：通过方法名或路径搜索端点，使用 `/url` 前缀启动搜索
- **智能结果排序**：根据匹配度智能排序搜索结果
- **端点导航**：直接跳转到选中的端点定义
- **路径复制**：在端点注解旁边显示复制按钮，一键复制完整路径
- **支持Spring MVC**：支持标准的Spring MVC控制器注解
- **支持Feign客户端**：支持Feign接口的识别和导航

## 使用方法

### 搜索端点

1. 按下 `Ctrl+Shift+\`（macOS: `Cmd+Shift+\`）或从命令面板运行 `Go To Endpoint: Search Endpoints`
2. 在搜索框中输入 `/url` 开头的查询，例如：
   - `/url getUserById` - 搜索方法名
   - `/url /users/{id}` - 搜索路径

### 复制端点路径

1. 打开包含Spring Controller或Feign客户端的Java文件
2. 找到带有 `@RequestMapping`, `@GetMapping`, `@PostMapping` 等注解的方法
3. 注解左侧会显示复制按钮，点击即可复制完整路径

## 安装

1. 从VSCode扩展市场安装
2. 或使用Quick Open（`Ctrl+P`），运行以下命令：
   ```
   ext install go-to-endpoints
   ```

## 配置选项

- `gotoEndpoints.includeGlobs`：设置要包含在端点索引中的文件的Glob模式
- `gotoEndpoints.excludeGlobs`：设置要排除在端点索引外的文件的Glob模式

## 注意事项

- 首次打开Java项目时，扩展会自动构建端点索引
- 索引过程在后台进行，大型项目可能需要一些时间完成
- 文件修改后会自动更新索引

## 更新日志

请查看 [CHANGELOG.md](CHANGELOG.md) 文件了解更新历史。

## 反馈与贡献

如发现问题或有功能建议，请在 GitHub 仓库提交 Issue。

## 许可证

MIT

## Features

*   **Endpoint Indexing**: Automatically scans your workspace (respecting `.gitignore` and configured include/exclude patterns) for Java files containing Spring MVC (`@RestController`, `@Controller`, `@RequestMapping`, `@GetMapping`, etc.) and Feign (`@FeignClient`) annotations.
*   **Quick Search**: Use the command palette or a keyboard shortcut to quickly search for endpoints by their URL path or method name.
*   **Go To Definition**: Select an endpoint from the search results to instantly jump to its definition in the source code.
*   **Copy Path**: A CodeLens appears above detected endpoint methods, allowing you to click and copy the full endpoint URL path to the clipboard.

## Usage

1.  **Open Command Palette**: Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac).
2.  **Run Command**: Type `Go To Endpoint: Search Endpoints` and press Enter.
    *   Alternatively, use the default keyboard shortcut: `Ctrl+Alt+/` (or `Cmd+Alt+/` on Mac).
3.  **Enter Query**: Type a part of the URL path (e.g., `/users/details`) or the Java method name (e.g., `getUserDetails`) you are looking for.
4.  **Select & Navigate**: Choose the desired endpoint from the results list. The corresponding file will be opened, and the cursor will jump to the method definition.
5.  **Copy Path (CodeLens)**: In your Java files, look for the `$(clippy) Copy Path: /your/endpoint/path` text above endpoint methods. Click it to copy the path.

## Configuration

You can customize the files included and excluded from indexing via VS Code settings (`settings.json`):

*   `gotoEndpoints.includeGlobs` (default: `["**/*.java"]`):
    An array of glob patterns specifying which files should be included in the index.
*   `gotoEndpoints.excludeGlobs` (default: `["**/node_modules/**", "**/target/**", "**/build/**", "**/.*/**", "**/*Test.java"]`):
    An array of glob patterns specifying files or folders to exclude from the index. Useful for improving performance by ignoring irrelevant files or build outputs.

## Known Issues / Limitations

*   Initial indexing might take a moment for large workspaces.
*   Path variable resolution ({id}) is basic; complex path constructions might not be fully represented.
*   Parsing relies on `java-parser` and might have limitations with highly complex or non-standard Java syntax.
*   Does not currently resolve paths defined in application properties or YAML files.

## Development

(Instructions for building/debugging - can be added later)

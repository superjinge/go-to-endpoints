# Go To Endpoints

[![版本](https://img.shields.io/visual-studio-marketplace/v/superjinge.go-to-endpoints)](https://marketplace.visualstudio.com/items?itemName=superjinge.go-to-endpoints)
[![下载量](https://img.shields.io/visual-studio-marketplace/d/superjinge.go-to-endpoints)](https://marketplace.visualstudio.com/items?itemName=superjinge.go-to-endpoints)
[![评分](https://img.shields.io/visual-studio-marketplace/r/superjinge.go-to-endpoints)](https://marketplace.visualstudio.com/items?itemName=superjinge.go-to-endpoints)
[![许可证](https://img.shields.io/github/license/superjinge/go-to-endpoints)](LICENSE)

**专为Java开发者设计的强大VS Code扩展，快速搜索和导航到Spring Controller API端点。**

通过即时定位和管理大型Spring项目中的API端点，简化您的Java开发工作流程。告别在无数控制器文件中手动搜索的烦恼！

![预览图](https://raw.githubusercontent.com/superjinge/go-to-endpoints/main/resources/preview.png)

## ✨ 功能特性

### 🔍 **智能端点搜索**
- **闪电般快速搜索**：通过路径或方法名查找端点，智能排序
- **模糊匹配**：输入 `/users` 或 `getUserById` 即可立即定位相关端点
- **实时结果**：输入时即可看到搜索结果，支持实时过滤

### 🌳 **端点树视图**
- **层次化显示**：在侧边栏中按路径结构组织浏览所有端点
- **一键导航**：单击即可直接跳转到端点定义
- **可视化组织**：按控制器和HTTP方法清晰分类端点

### 📋 **复制端点路径**
- **CodeLens集成**：在端点注解上方显示复制按钮
- **完整路径复制**：获取包含基础映射的完整API路径
- **开发者友好**：非常适合API文档编写和测试

### ⚡ **性能优化**
- **智能缓存**：索引缓存机制，VS Code重启后加载更快
- **并发处理**：多线程文件解析，适用于大型项目
- **智能过滤**：预过滤文件以避免不必要的处理
- **实时更新**：文件保存时自动更新索引

### 🎯 **框架支持**
- **Spring框架**：完全支持 `@RestController`、`@Controller`、`@RequestMapping`
- **HTTP方法**：`@GetMapping`、`@PostMapping`、`@PutMapping`、`@DeleteMapping`、`@PatchMapping`
- **路径变量**：智能解析路径参数和请求映射

## 🚀 快速开始

### 安装

**从VS Code扩展市场安装：**
1. 打开VS Code
2. 转到扩展 (`Ctrl+Shift+X`)
3. 搜索 "Go To Endpoints"
4. 点击安装

**从命令行安装：**
```bash
code --install-extension superjinge.go-to-endpoints
```

### 基本用法

#### 1. 搜索端点
- 按 `Ctrl+Shift+\` (macOS: `Cmd+Shift+\`)
- 输入搜索查询：
  - `/api/users` - 查找包含此路径的端点
  - `getUserById` - 查找包含此方法名的端点
  - `POST /users` - 查找POST端点

#### 2. 浏览端点树
- 点击侧边栏中的端点浏览器图标
- 在层次化端点结构中导航
- 点击任何端点即可跳转到其定义

#### 3. 复制端点路径
- 打开包含Spring Controller注解的Java文件
- 查找 `@RequestMapping`、`@GetMapping` 等注解上方的复制按钮（CodeLens）
- 点击即可复制完整的端点路径

#### 4. 扫描工作区
- 使用 `Ctrl+Shift+K` (macOS: `Cmd+Shift+K`) 扫描整个工作区
- 或点击端点树视图中的刷新按钮

## ⚙️ 配置

在VS Code设置中自定义扩展行为：

```json
{
  "gotoEndpoints.includeGlobs": ["**/*.java"],
  "gotoEndpoints.excludeGlobs": [
    "**/node_modules/**",
    "**/target/**", 
    "**/build/**",
    "**/.*/**",
    "**/*Test.java"
  ],
  "gotoEndpoints.enableCache": true,
  "gotoEndpoints.concurrencyLimit": 50,
  "gotoEndpoints.autoIndex": true,
  "gotoEndpoints.usePrefilter": true,
  "gotoEndpoints.enableDecorations": true,
  "gotoEndpoints.enableCodeLens": true,
  "gotoEndpoints.notificationTimeout": 3000
}
```

### 配置选项

| 设置 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `includeGlobs` | 数组 | `["**/*.java"]` | 要包含在端点索引中的文件模式 |
| `excludeGlobs` | 数组 | `["**/node_modules/**", ...]` | 要从索引中排除的文件模式 |
| `enableCache` | 布尔值 | `true` | 启用缓存以加速索引 |
| `concurrencyLimit` | 数字 | `50` | 最大并发文件解析操作数 |
| `autoIndex` | 布尔值 | `true` | 扩展启动时自动索引文件 |
| `usePrefilter` | 布尔值 | `true` | 预过滤不包含控制器注解的文件 |
| `enableDecorations` | 布尔值 | `true` | 启用API端点的行装饰器 |
| `enableCodeLens` | 布尔值 | `true` | 启用端点注解上方的复制按钮 |
| `notificationTimeout` | 数字 | `3000` | 通知自动关闭超时时间（毫秒） |

## ⌨️ 键盘快捷键

| 快捷键 | 操作 | 描述 |
|--------|------|------|
| `Ctrl+Shift+\` | 搜索端点 | 打开端点搜索对话框 |
| `Ctrl+Shift+J` | 扫描当前文件 | 索引当前Java文件中的端点 |
| `Ctrl+Shift+K` | 扫描工作区 | 清除缓存并扫描整个工作区 |

*注意：在macOS上，使用 `Cmd` 替代 `Ctrl`*

## 🔧 技术要求

- **VS Code版本**：1.96.0或更高版本
- **语言支持**：Java
- **框架支持**：Spring框架（Spring Boot、Spring MVC）
- **文件类型**：`.java` 文件
- **操作系统**：Windows、macOS、Linux

## 📊 性能

- **激活条件**：仅在打开Java文件时激活
- **内存高效**：优化解析，可配置并发限制
- **缓存系统**：持久化缓存减少重新索引时间
- **大型项目**：已在包含1000+端点定义的项目中测试
- **后台处理**：非阻塞索引不会中断您的工作流程

## 🤝 贡献

我们欢迎贡献！以下是开始的方法：

### 开发环境设置

1. **克隆仓库**
   ```bash
   git clone https://github.com/superjinge/go-to-endpoints.git
   cd go-to-endpoints
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **在VS Code中打开**
   ```bash
   code .
   ```

4. **运行扩展**
   - 按 `F5` 打开新的扩展开发主机窗口
   - 在新窗口中测试您的更改

### 项目结构

```
src/
├── extension.ts          # 主扩展入口点
├── features/            # 功能实现
├── indexer/            # 端点索引逻辑
├── parser/             # Java文件解析
├── utils/              # 工具函数
└── test/               # 测试文件
```

### 提交更改

1. Fork仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交您的更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 打开Pull Request

## 📝 更新日志

查看 [CHANGELOG.md](CHANGELOG.md) 了解详细的更改历史。

## 🐛 问题与支持

- **错误报告**：[GitHub Issues](https://github.com/superjinge/go-to-endpoints/issues)
- **功能请求**：[GitHub Discussions](https://github.com/superjinge/go-to-endpoints/discussions)
- **文档**：[Wiki](https://github.com/superjinge/go-to-endpoints/wiki)

## 📄 许可证

本项目采用MIT许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🌟 致谢

- 感谢所有帮助改进此扩展的贡献者
- 灵感来源于在大型Java项目中更好地管理API端点的需求
- 为Java开发者社区用❤️构建

---

**由 [superjinge](https://github.com/superjinge) 用❤️制作**

*如果此扩展对您的开发工作流程有帮助，请考虑在GitHub上给它一个⭐并在VS Code扩展市场留下评价！* 
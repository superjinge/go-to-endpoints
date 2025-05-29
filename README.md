# Go To Endpoints

[![Version](https://img.shields.io/visual-studio-marketplace/v/superjinge.go-to-endpoints)](https://marketplace.visualstudio.com/items?itemName=superjinge.go-to-endpoints)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/superjinge.go-to-endpoints)](https://marketplace.visualstudio.com/items?itemName=superjinge.go-to-endpoints)
[![Rating](https://img.shields.io/visual-studio-marketplace/r/superjinge.go-to-endpoints)](https://marketplace.visualstudio.com/items?itemName=superjinge.go-to-endpoints)
[![License](https://img.shields.io/github/license/superjinge/go-to-endpoints)](LICENSE)

> **Language**: English | [中文](README_CN.md)

**A powerful VS Code extension for Java developers to quickly search and navigate to Spring Controller API endpoints.**

Streamline your Java development workflow by instantly locating and managing API endpoints in large Spring projects. No more manual searching through countless controller files!

![Preview](https://raw.githubusercontent.com/superjinge/go-to-endpoints/main/resources/preview.png)

## ✨ Features

### 🔍 **Smart Endpoint Search**
- **Lightning-fast search**: Find endpoints by path or method name with intelligent ranking
- **Fuzzy matching**: Type `/users` or `getUserById` to instantly locate relevant endpoints
- **Real-time results**: See search results as you type with live filtering

### 🌳 **Endpoint Tree View**
- **Hierarchical display**: Browse all endpoints organized by path structure in the sidebar
- **One-click navigation**: Jump directly to endpoint definitions with a single click
- **Visual organization**: Clear categorization of endpoints by controller and HTTP method

### 📋 **Copy Endpoint Paths**
- **CodeLens integration**: Copy buttons appear above endpoint annotations
- **Full path copying**: Get complete API paths including base mappings
- **Developer-friendly**: Perfect for API documentation and testing

### ⚡ **Performance Optimized**
- **Intelligent caching**: Index caching for faster startup after VS Code restarts
- **Concurrent processing**: Multi-threaded file parsing for large projects
- **Smart filtering**: Pre-filter files to avoid unnecessary processing
- **Real-time updates**: Automatic index updates when files are saved

### 🎯 **Framework Support**
- **Spring Framework**: Full support for `@RestController`, `@Controller`, `@RequestMapping`
- **HTTP Methods**: `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping`, `@PatchMapping`
- **Path Variables**: Intelligent parsing of path parameters and request mappings

## 🚀 Quick Start

### Installation

**From VS Code Marketplace:**
1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X`)
3. Search for "Go To Endpoints"
4. Click Install

**From Command Line:**
```bash
code --install-extension superjinge.go-to-endpoints
```

### Basic Usage

#### 1. Search Endpoints
- Press `Ctrl+Shift+\` (macOS: `Cmd+Shift+\`)
- Type your search query:
  - `/api/users` - Find endpoints with this path
  - `getUserById` - Find methods with this name
  - `POST /users` - Find POST endpoints

#### 2. Browse Endpoint Tree
- Click the endpoint explorer icon in the sidebar
- Navigate through the hierarchical endpoint structure
- Click any endpoint to jump to its definition

#### 3. Copy Endpoint Paths
- Open a Java file with Spring Controller annotations
- Look for copy buttons (CodeLens) above `@RequestMapping`, `@GetMapping`, etc.
- Click to copy the complete endpoint path

#### 4. Scan Workspace
- Use `Ctrl+Shift+K` (macOS: `Cmd+Shift+K`) to scan the entire workspace
- Or click the refresh button in the endpoint tree view

## ⚙️ Configuration

Customize the extension behavior in VS Code settings:

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

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `includeGlobs` | array | `["**/*.java"]` | File patterns to include in endpoint indexing |
| `excludeGlobs` | array | `["**/node_modules/**", ...]` | File patterns to exclude from indexing |
| `enableCache` | boolean | `true` | Enable caching for faster indexing |
| `concurrencyLimit` | number | `50` | Maximum concurrent file parsing operations |
| `autoIndex` | boolean | `true` | Automatically index files on extension startup |
| `usePrefilter` | boolean | `true` | Pre-filter files without controller annotations |
| `enableDecorations` | boolean | `true` | Enable line decorations for API endpoints |
| `enableCodeLens` | boolean | `true` | Enable copy buttons above endpoint annotations |
| `notificationTimeout` | number | `3000` | Auto-close timeout for notifications (ms) |

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Shift+\` | Search Endpoints | Open endpoint search dialog |
| `Ctrl+Shift+J` | Scan Current File | Index endpoints in current Java file |
| `Ctrl+Shift+K` | Scan Workspace | Clear cache and scan entire workspace |

*Note: On macOS, use `Cmd` instead of `Ctrl`*

## 🔧 Technical Requirements

- **VS Code Version**: 1.96.0 or higher
- **Language Support**: Java
- **Framework Support**: Spring Framework (Spring Boot, Spring MVC)
- **File Types**: `.java` files
- **Operating Systems**: Windows, macOS, Linux

## 📊 Performance

- **Activation**: Only activates when Java files are opened
- **Memory Efficient**: Optimized parsing with configurable concurrency limits
- **Cache System**: Persistent caching reduces re-indexing time
- **Large Projects**: Tested with projects containing 1000+ endpoint definitions
- **Background Processing**: Non-blocking indexing won't interrupt your workflow

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/superjinge/go-to-endpoints.git
   cd go-to-endpoints
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Open in VS Code**
   ```bash
   code .
   ```

4. **Run the extension**
   - Press `F5` to open a new Extension Development Host window
   - Test your changes in the new window

### Project Structure

```
src/
├── extension.ts          # Main extension entry point
├── features/            # Feature implementations
├── indexer/            # Endpoint indexing logic
├── parser/             # Java file parsing
├── utils/              # Utility functions
└── test/               # Test files
```

### Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Changelog

See [CHANGELOG.md](CHANGELOG.md) for a detailed history of changes.

## 🐛 Issues & Support

- **Bug Reports**: [GitHub Issues](https://github.com/superjinge/go-to-endpoints/issues)
- **Feature Requests**: [GitHub Discussions](https://github.com/superjinge/go-to-endpoints/discussions)
- **Documentation**: [Wiki](https://github.com/superjinge/go-to-endpoints/wiki)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Acknowledgments

- Thanks to all contributors who have helped improve this extension
- Inspired by the need for better API endpoint management in large Java projects
- Built with ❤️ for the Java developer community

---

**Made with ❤️ by [superjinge](https://github.com/superjinge)**

*If this extension helps your development workflow, please consider giving it a ⭐ on GitHub and leaving a review on the VS Code Marketplace!* 

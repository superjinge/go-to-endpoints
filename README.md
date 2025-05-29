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

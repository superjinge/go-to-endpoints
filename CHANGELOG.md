# Change Log

All notable changes to the "go-to-endpoints" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.7] - Latest Release

### Added
- Enhanced endpoint search with real-time results display
- Improved search algorithm with intelligent ranking
- Better performance optimization for large projects

### Fixed
- Resolved plugin activation issues
- Improved CodeLens positioning and functionality
- Enhanced Java file parsing reliability

## [0.0.6] - Real-time Search Results

### Added
- Real-time search results display as you type
- Live filtering of endpoint matches
- Improved search responsiveness

## [0.0.5] - Description Fix

### Fixed
- Updated plugin description for better clarity
- Improved marketplace presentation

## [0.0.4] - Icon Size Fix

### Fixed
- Resolved icon sizing issues in VS Code interface
- Optimized icon display across different themes

## [0.0.3] - Icon Addition

### Added
- Added extension icon for better visual identification
- Improved branding and marketplace presence

## [0.0.2] - Major Feature Update (Unreleased)

### Added
- **Endpoint Tree View**: Added sidebar panel displaying all endpoints in hierarchical structure
- **Enhanced Search Format**: Updated search results to show "Path ((ClassName)[HTTPMethod])" format
- **Improved Search Algorithm**: Implemented score-based ranking for better search relevance
- **Better CodeLens Integration**: Optimized copy buttons positioning above annotations
- **Chinese Localization**: Added comprehensive Chinese language support

### Enhanced
- **Feign Client Support**: Enhanced parsing for FeignClient annotations with url, name, value, and path attributes
- **Path Resolution**: Improved intelligent path parsing logic with service name inference
- **Annotation Extraction**: More robust annotation value extraction methods

### Fixed
- Plugin activation issues ensuring proper functionality
- Search result relevance and sorting accuracy
- CodeLens button positioning and display

## [0.0.1] - Initial Release (Unreleased)

### Added
- **Basic Endpoint Indexing**: Core Java endpoint indexing and search functionality
- **Spring MVC Support**: Full support for Spring MVC controllers
- **Keyboard Shortcuts**: Search endpoints via shortcuts and command palette
- **URL Search**: Support for `/url` pattern searches to avoid conflicts with VS Code native search
- **CodeLens Integration**: Copy path functionality for endpoint annotations

### Features
- Fast endpoint discovery in Java Spring projects
- Intelligent search with path and method name matching
- One-click navigation to endpoint definitions
- Copy endpoint paths for API testing and documentation

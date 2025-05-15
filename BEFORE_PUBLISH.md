# 发布前检查清单

## 插件图标
- [x] 已创建`icon.png`作为主图标
- [x] 已在package.json中添加`icon`字段
- [ ] 检查图标是否清晰可见
- [ ] 考虑创建更专业的图标设计

## 预览图
- [x] 已从README中移除预览图部分，避免格式问题

## README格式限制
- [x] 已移除内联SVG标签（VS Code扩展市场不允许在README中使用SVG标签）
- [x] 已移除所有图片引用
- [x] 检查HTML标签使用，确保符合扩展市场规范
- [x] 移除了重复内容（英文部分）

## 发布者信息
- [ ] 更新package.json中的`publisher`字段为您的真实发布者ID
- [ ] 更新package.json中的repository.url为您的真实GitHub仓库URL

## 文档检查
- [x] 确认README.md中所有功能描述准确
- [ ] 确认CHANGELOG.md中版本信息完整

## 打包命令
```
vsce package
```

## 发布命令
```
vsce publish
```

## 发布后
- [ ] 在GitHub上创建新的发布版本
- [ ] 上传生成的.vsix文件到GitHub发布页面
- [ ] 更新版本号准备下一个版本 
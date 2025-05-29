import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';
import { EndpointInfo } from '../parser/models';
import { showInfo } from '../utils/messageUtils';

const COPY_COMMAND_ID = 'gotoEndpoints.copyPath';

export class EndpointCodeLensProvider implements vscode.CodeLensProvider {

    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    
    // 只保留主装饰器类型
    private endpointDecorationType: vscode.TextEditorDecorationType;
    
    // 添加请求计数器，用于减少日志
    private _codeLensRequestCount = new Map<string, number>();
    
    // 添加端点缓存，避免重复请求
    private _fileEndpointCache = new Map<string, {
        endpoints: EndpointInfo[],
        timestamp: number
    }>();
    
    // 缓存过期时间（毫秒）
    private readonly CACHE_EXPIRY = 1000; // 缓存1秒内的请求

    constructor(private indexManager: IndexManager) {
        console.log('[GoToEndpoint] CodeLensProvider initialized');
        
        // 创建主装饰器类型 - 代码区域内
        this.endpointDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(200, 200, 255, 0.1)',
            isWholeLine: true,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        
        // Refresh lenses when workspace configuration changes (e.g., include/exclude globs)
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('gotoEndpoints')) {
                this._onDidChangeCodeLenses.fire();
                this.updateDecorations();
            }
        });

        // Refresh lenses when the index is updated
        this.indexManager.onIndexUpdated(() => {
            this._onDidChangeCodeLenses.fire();
            this.updateDecorations();
        });
        
        // 监听文本文档变化
        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'java') {
                this._onDidChangeCodeLenses.fire();
                this.updateDecorations();
            }
        });
        
        // 监听活动编辑器变化，更新装饰器
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this.updateDecorations();
            }
        });
        
        // 初始更新当前编辑器的装饰器
        this.updateDecorations();
    }

    /**
     * 从缓存或IndexManager获取文件的端点
     * 这个方法会缓存端点信息，避免在短时间内重复请求相同的文件
     */
    private getFileEndpoints(filePath: string): EndpointInfo[] | undefined {
        const now = Date.now();
        const cached = this._fileEndpointCache.get(filePath);
        
        // 如果缓存存在且未过期，直接使用缓存
        if (cached && (now - cached.timestamp) < this.CACHE_EXPIRY) {
            return cached.endpoints;
        }
        
        // 从IndexManager获取端点
        const endpoints = this.indexManager.getEndpointsForFile(filePath);
        
        // 更新缓存
        if (endpoints) {
            this._fileEndpointCache.set(filePath, {
                endpoints,
                timestamp: now
            });
        } else {
            // 如果没有找到端点，也缓存结果（undefined表示文件没有端点）
            this._fileEndpointCache.set(filePath, {
                endpoints: [],
                timestamp: now
            });
        }
        
        return endpoints;
    }

    // 更新装饰器
    private updateDecorations() {
        // 检查是否启用装饰器
        const config = vscode.workspace.getConfiguration('gotoEndpoints');
        const enableDecorations = config.get<boolean>('enableDecorations', true);
        
        if (!enableDecorations) {
            // 如果装饰器被禁用，清除所有装饰器
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                activeEditor.setDecorations(this.endpointDecorationType, []);
            }
            return;
        }
        
        const activeEditor = vscode.window.activeTextEditor;
        if (!activeEditor || !activeEditor.document.languageId.includes('java')) {
            return;
        }
        
        const document = activeEditor.document;
        const filePath = document.uri.fsPath;
        const endpoints = this.getFileEndpoints(filePath);
        
        if (!endpoints || endpoints.length === 0) {
            // 清除装饰器
            activeEditor.setDecorations(this.endpointDecorationType, []);
            return;
        }
        
        // 创建装饰器数组
        const decorations: vscode.DecorationOptions[] = [];
        
        for (const endpoint of endpoints) {
            try {
                // 使用端点的起始行 (1-based 转为 0-based)
                const lineNumber = endpoint.startLine - 1;
                
                // 确保行号在文档范围内
                if (lineNumber < 0 || lineNumber >= document.lineCount) {
                    continue;
                }
                
                // 获取行对象
                const line = document.lineAt(lineNumber);
                
                // 主装饰器 - 整行
                const fullLineRange = new vscode.Range(
                    new vscode.Position(lineNumber, 0),
                    new vscode.Position(lineNumber, line.text.length)
                );
                
                // 创建装饰器选项
                const decoration: vscode.DecorationOptions = {
                    range: fullLineRange,
                    hoverMessage: new vscode.MarkdownString(
                        `**API路径:** ${endpoint.fullPath}\n\n` +
                        `**HTTP方法:** ${endpoint.httpMethod}`
                    )
                };
                
                decorations.push(decoration);
            } catch (error) {
                console.error(`[GoToEndpoint] 创建装饰器时出错 (行 ${endpoint.startLine}):`, error);
            }
        }
        
        // 应用装饰器
        activeEditor.setDecorations(this.endpointDecorationType, decorations);
    }

    public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        // 检查是否启用CodeLens
        const config = vscode.workspace.getConfiguration('gotoEndpoints');
        const enableCodeLens = config.get<boolean>('enableCodeLens', true);
        
        if (!enableCodeLens) {
            return [];
        }
        
        // 先检查文件类型，非Java文件直接返回空数组
        if (!document.languageId.includes('java')) { 
            return [];
        }

        // 获取当前文件的端点
        const endpoints = this.getFileEndpoints(document.uri.fsPath);

        // 如果没有端点，直接返回空数组
        if (!endpoints || endpoints.length === 0) {
            return []; 
        }

        // 使用计数器来减少日志输出
        const filePath = document.uri.fsPath;
        if (!this._codeLensRequestCount) {
            this._codeLensRequestCount = new Map<string, number>();
        }
        
        // 增加请求计数
        const count = (this._codeLensRequestCount.get(filePath) || 0) + 1;
        this._codeLensRequestCount.set(filePath, count);
        
        // 只在第一次请求或每10次请求输出一次日志
        if (count === 1 || count % 10 === 0) {
            console.log(`[GoToEndpoint] 为文件添加 ${endpoints.length} 个端点按钮: ${filePath}`);
        }
        
        const lenses: vscode.CodeLens[] = [];
        
        // 用于追踪是否存在不匹配的注解，需要重新扫描
        let needsRescan = false;
        const annotationMismatches: number[] = [];
        
        // 循环创建CodeLens - 过滤掉类级别的端点
        for (const endpoint of endpoints) {
            try {
                // 跳过类级别的注解 - 类级别注解的methodName通常为空或特殊标记
                // 即：只有确实有方法名的端点才显示复制按钮
                if (!endpoint.methodName || endpoint.methodName === '<class>' || endpoint.methodName === 'unknownMethod') {
                    console.log(`[GoToEndpoint] 跳过类级别注解: ${endpoint.fullPath}`);
                    continue;
                }
                
                // 强化类级别注解检测 - 使用正则表达式检查当前行是否包含类级别注解
                const lineNumber = endpoint.startLine - 1;
                if (lineNumber < 0 || lineNumber >= document.lineCount) {
                    continue;
                }
                
                const lineText = document.lineAt(lineNumber).text.trim();
                
                // 更严格检查是否包含类级别注解标记
                if (/^@(?:RestController|Controller|RequestMapping)/.test(lineText)) {
                    // 获取后面几行的内容，查找是否包含类声明
                    let isClassLevelAnnotation = false;
                    
                    // 检查接下来的几行是否包含"class"关键字和控制器命名模式
                    for (let i = 1; i <= 3 && lineNumber + i < document.lineCount; i++) {
                        const nextLineText = document.lineAt(lineNumber + i).text.trim();
                        if (/\bclass\b.*Controller/.test(nextLineText)) {
                            isClassLevelAnnotation = true;
                            break;
                        }
                    }
                    
                    if (isClassLevelAnnotation) {
                        console.log(`[GoToEndpoint] 检测到类级别的注解模式，跳过: ${endpoint.fullPath} at line ${endpoint.startLine}`);
                        continue;
                    }
                }
                
                // 验证该行是否确实包含注解
                const containsAnnotation = this.lineContainsAnnotation(lineText);
                if (!containsAnnotation) {
                    // 如果行上没有注解，记录不匹配
                    needsRescan = true;
                    annotationMismatches.push(lineNumber);
                    continue; // 跳过此端点，不添加CodeLens
                }
                
                // 只保留代码前的复制按钮
                const indent = document.lineAt(lineNumber).firstNonWhitespaceCharacterIndex;
                const indentPosition = new vscode.Position(lineNumber, indent);
                const indentRange = new vscode.Range(indentPosition, indentPosition);
                
                // 创建复制命令
                const httpMethod = endpoint.httpMethod;
                const displayMethod = httpMethod;
                
                // 使用标准化的fullPath，与搜索结果保持一致
                // 这样可以确保复制按钮与搜索功能使用相同的路径格式
                const pathToCopy = endpoint.fullPath;
                
                // 代码前命令 - 详细版
                const indentCommand: vscode.Command = {
                    title: `$(clippy) 复制 [${displayMethod}]`,
                    tooltip: `复制路径: ${pathToCopy}`,
                    command: COPY_COMMAND_ID,
                    arguments: [pathToCopy, httpMethod, endpoint.className, endpoint.methodName, endpoint.originalClassPath, endpoint.originalMethodPath]
                };
                
                // 只添加代码前的CodeLens
                lenses.push(new vscode.CodeLens(indentRange, indentCommand));
            } catch (error) {
                console.error(`[GoToEndpoint] 创建CodeLens时出错 (行 ${endpoint?.startLine}):`, error);
            }
        }

        // 如果发现不匹配，触发重新扫描文件
        if (needsRescan) {
            // 使用防抖处理，避免频繁触发
            this.triggerRescan(document.uri.fsPath, annotationMismatches);
        }
        
        return lenses;
    }
    
    // 检查行文本是否包含端点注解
    private lineContainsAnnotation(lineText: string): boolean {
        const annotationPatterns = [
            /@RequestMapping/i,
            /@GetMapping/i,
            /@PostMapping/i, 
            /@PutMapping/i,
            /@DeleteMapping/i,
            /@PatchMapping/i,
            /@Controller/i,
            /@RestController/i,
            /@FeignClient/i
        ];
        
        return annotationPatterns.some(pattern => pattern.test(lineText));
    }
    
    // 上次扫描时间记录，用于防抖
    private lastRescanMap = new Map<string, number>();
    // 防抖时间（毫秒）
    private readonly RESCAN_DEBOUNCE = 5000; // 5秒内不重复扫描同一文件
    
    /**
     * 触发重新扫描文件，带防抖处理
     * @param filePath 文件路径
     * @param mismatches 不匹配的行号
     */
    private triggerRescan(filePath: string, mismatches: number[]): void {
        const now = Date.now();
        const lastRescan = this.lastRescanMap.get(filePath) || 0;
        
        // 如果距离上次扫描时间小于防抖时间，则不触发
        if (now - lastRescan < this.RESCAN_DEBOUNCE) {
            return;
        }
        
        console.log(`[GoToEndpoint] 检测到端点按钮位置与注解不匹配，触发重新扫描: ${filePath}`);
        console.log(`[GoToEndpoint] 不匹配的行号: ${mismatches.join(', ')}`);
        
        // 记录本次扫描时间
        this.lastRescanMap.set(filePath, now);
        
        // 清除缓存
        this._fileEndpointCache.delete(filePath);
        
        // 触发重新扫描
        this.indexManager.updateFile(filePath).then(() => {
            console.log(`[GoToEndpoint] 自动重新扫描完成: ${filePath}`);
            
            // 刷新CodeLens
            this._onDidChangeCodeLenses.fire();
            // 刷新装饰器
            this.updateDecorations();
        }).catch(error => {
            console.error(`[GoToEndpoint] 自动重新扫描失败: ${filePath}`, error);
        });
    }
}

// Register the command handler for copying the path
export function registerCodeLensCommand(context: vscode.ExtensionContext) {
    console.log('[GoToEndpoint] Registering CodeLens command');
    const disposable = vscode.commands.registerCommand(COPY_COMMAND_ID, (path: string, method?: string, className?: string, methodName?: string, originalClassPath?: string, originalMethodPath?: string) => {
        if (path) {
            // 打印更多调试信息
            console.log(`[GoToEndpoint] 路径复制调试信息:`);
            console.log(`[GoToEndpoint] - 原始路径: ${path}`);
            console.log(`[GoToEndpoint] - HTTP方法: ${method}`);
            console.log(`[GoToEndpoint] - 类名: ${className}`);
            console.log(`[GoToEndpoint] - 方法名: ${methodName}`);
            
            // 路径验证和修复逻辑
            // 检查是否是完整路径 - 对于类似 SpringBoot 的格式，完整路径通常应包含方法路径部分
            // 仅当 path 只包含类路径而没有方法路径时进行修复
            let finalPath = path;
            
            // 获取 endpoint 的 originalClassPath 和 originalMethodPath 属性
            // 这些是从参数传入的，在 provideCodeLenses 创建 CodeLens 时赋值
            const classPath = originalClassPath || '';
            const methodPath = originalMethodPath || '';
            
            // 分析当前 path 是否看起来像是完整路径
            const pathParts = path.split('/').filter(p => p.length > 0);
            const isLikelyJustClassPath = pathParts.length <= 1 && methodPath && methodPath.length > 0;
            
            if (isLikelyJustClassPath && classPath && methodPath) {
                // 可能只有类路径，尝试使用 utils/pathUtils.ts 中的 joinPaths 函数手动拼接
                try {
                    const { joinPaths } = require('../utils/pathUtils');
                    finalPath = joinPaths(classPath, methodPath);
                    console.log(`[GoToEndpoint] - 检测到路径不完整，重新拼接: ${finalPath}`);
                } catch (error) {
                    console.error(`[GoToEndpoint] - 路径拼接失败:`, error);
                    // 兜底方案：简单拼接
                    finalPath = `${classPath}${methodPath.startsWith('/') ? '' : '/'}${methodPath}`;
                    console.log(`[GoToEndpoint] - 使用兜底方案拼接: ${finalPath}`);
                }
            }
            
            // 将修正后的路径复制到剪贴板
            vscode.env.clipboard.writeText(finalPath);
            
            // 构建更详细的消息
            let message = `路径已复制到剪贴板: ${finalPath}`;
            if (method) {
                message += ` [${method}]`;
            }
            
            // 构建详细信息
            let detail = undefined;
            if (className && methodName) {
                detail = `${className}.${methodName}`;
            }
            
            // 使用自动消失的通知
            showInfo(message, detail);
            
            console.log(`[GoToEndpoint] Copied path to clipboard: ${finalPath}`);
        } else {
            console.error('[GoToEndpoint] No path provided to copy command');
        }
    });
    
    context.subscriptions.push(disposable);
    console.log('[GoToEndpoint] CodeLens command registered successfully');
}
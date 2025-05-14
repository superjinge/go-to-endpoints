import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';
import { EndpointInfo } from '../parser/models';

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
                        `**API路径:** ${endpoint.originalMethodPath || endpoint.originalClassPath || endpoint.fullPath}\n\n` +
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
        
        // 循环创建CodeLens
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
                
                // 只保留代码前的复制按钮
                const indent = line.firstNonWhitespaceCharacterIndex;
                const indentPosition = new vscode.Position(lineNumber, indent);
                const indentRange = new vscode.Range(indentPosition, indentPosition);
                
                // 创建复制命令
                const httpMethod = endpoint.httpMethod;
                const displayMethod = httpMethod === "ANY" ? "ALL" : httpMethod;
                
                // 优先使用原始方法路径，这是直接从注解中提取的，没有经过处理
                // 对于只有类路径没有方法路径的情况，使用类路径
                const pathToCopy = endpoint.originalMethodPath || endpoint.originalClassPath || endpoint.fullPath;
                
                // 代码前命令 - 详细版
                const indentCommand: vscode.Command = {
                    title: `$(clippy) 复制 [${displayMethod}]`,
                    tooltip: `复制路径: ${pathToCopy}`,
                    command: COPY_COMMAND_ID,
                    arguments: [pathToCopy, httpMethod, endpoint.className, endpoint.methodName]
                };
                
                // 只添加代码前的CodeLens
                lenses.push(new vscode.CodeLens(indentRange, indentCommand));
            } catch (error) {
                console.error(`[GoToEndpoint] 处理端点时出错 (行 ${endpoint.startLine}):`, error);
            }
        }
        
        return lenses;
    }
}

// Register the command handler for copying the path
export function registerCodeLensCommand(context: vscode.ExtensionContext) {
    console.log('[GoToEndpoint] Registering CodeLens command');
    const disposable = vscode.commands.registerCommand(COPY_COMMAND_ID, (path: string, method?: string, className?: string, methodName?: string) => {
        if (path) {
            // 打印更多调试信息
            console.log(`[GoToEndpoint] 路径复制调试信息:`);
            console.log(`[GoToEndpoint] - 原始路径: ${path}`);
            console.log(`[GoToEndpoint] - HTTP方法: ${method}`);
            console.log(`[GoToEndpoint] - 类名: ${className}`);
            console.log(`[GoToEndpoint] - 方法名: ${methodName}`);
            
            // 将路径复制到剪贴板
            vscode.env.clipboard.writeText(path);
            
            // 构建更详细的消息
            let message = `路径已复制到剪贴板: ${path}`;
            if (method) {
                message += ` [${method}]`;
            }
            if (className && methodName) {
                message += `\n(${className}.${methodName})`;
            }
            
            vscode.window.showInformationMessage(message, { detail: '路径已复制到剪贴板' });
            console.log(`[GoToEndpoint] Copied path to clipboard: ${path}`);
        } else {
            console.error('[GoToEndpoint] No path provided to copy command');
        }
    });
    
    context.subscriptions.push(disposable);
    console.log('[GoToEndpoint] CodeLens command registered successfully');
}
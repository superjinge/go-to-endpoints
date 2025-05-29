import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';
import { EndpointInfo } from '../parser/models';

/**
 * 端点树节点类型
 */
export enum EndpointTreeItemType {
    Root = 'root',
    PathGroup = 'pathGroup',
    ControllerEndpoint = 'controllerEndpoint',
    FeignEndpoint = 'feignEndpoint',
}

/**
 * 端点树节点
 */
export class EndpointTreeItem extends vscode.TreeItem {
    public readonly childrenItems?: EndpointTreeItem[];

    constructor(
        public readonly label: string,
        public readonly type: EndpointTreeItemType,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly endpoint?: EndpointInfo,
        childrenItems?: EndpointTreeItem[],
        public readonly pathSegment?: string,
        public readonly fullPath?: string
    ) {
        super(label, collapsibleState);
        this.childrenItems = childrenItems;

        // 设置图标
        switch (type) {
            case EndpointTreeItemType.Root:
                this.iconPath = new vscode.ThemeIcon('list-tree');
                this.tooltip = '当前文件端点';
                break;
            case EndpointTreeItemType.PathGroup:
                this.iconPath = new vscode.ThemeIcon('folder');
                this.tooltip = fullPath || pathSegment || '';
                break;
            case EndpointTreeItemType.ControllerEndpoint:
                this.iconPath = new vscode.ThemeIcon('symbol-method');
                if (endpoint) {
                    const methodDisplay = endpoint.httpMethod;
                    const method = methodDisplay ? `[${methodDisplay}]` : '';
                    this.tooltip = `${endpoint.fullPath} ${method}\n${endpoint.className}.${endpoint.methodName}\n${endpoint.filePath}`;
                    this.description = `${endpoint.className}.${endpoint.methodName}`;
                    // 设置命令，点击时跳转到定义
                    this.command = {
                        command: 'gotoEndpoints.openEndpoint',
                        title: '打开端点定义',
                        arguments: [endpoint]
                    };
                }
                break;
            case EndpointTreeItemType.FeignEndpoint:
                this.iconPath = new vscode.ThemeIcon('combine');
                if (endpoint) {
                    const methodDisplay = endpoint.httpMethod;
                    const method = methodDisplay ? `[${methodDisplay}]` : '';
                    this.tooltip = `${endpoint.fullPath} ${method}\n${endpoint.className}.${endpoint.methodName}\n${endpoint.filePath}`;
                    this.description = `${endpoint.className}.${endpoint.methodName}`;
                    // 设置命令，点击时跳转到定义
                    this.command = {
                        command: 'gotoEndpoints.openEndpoint',
                        title: '打开端点定义',
                        arguments: [endpoint]
                    };
                }
                break;
        }
    }

    /**
     * 获取上下文值，用于命令参数
     */
    contextValue = this.type;
}

/**
 * 端点树视图提供程序
 */
export class EndpointTreeProvider implements vscode.TreeDataProvider<EndpointTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<EndpointTreeItem | undefined | null> = new vscode.EventEmitter<EndpointTreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<EndpointTreeItem | undefined | null> = this._onDidChangeTreeData.event;
    
    private currentFilePath?: string;
    
    // 添加端点缓存，避免重复请求
    private _fileEndpointCache = new Map<string, {
        endpoints: EndpointInfo[],
        timestamp: number
    }>();
    
    // 缓存过期时间（毫秒）
    private readonly CACHE_EXPIRY = 1000; // 缓存1秒内的请求

    constructor(private indexManager: IndexManager) {
        // 监听索引更新事件，刷新树视图
        indexManager.onIndexUpdated(() => {
            this.refresh();
            
            // 清除当前文件的缓存，确保下次获取最新数据
            if (this.currentFilePath) {
                this._fileEndpointCache.delete(this.currentFilePath);
                console.log(`[GoToEndpoint] 清除端点树缓存以响应索引更新: ${this.currentFilePath}`);
            }
        });
        
        // 监听活动编辑器变化，更新当前文件
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'java') {
                this.currentFilePath = editor.document.uri.fsPath;
                // 清除缓存，确保获取最新数据
                this._fileEndpointCache.delete(this.currentFilePath);
                this.refresh();
            }
        });
        
        // 监听文档保存，刷新对应文件的端点
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.languageId === 'java') {
                // 如果保存的是当前文件，清除缓存并刷新视图
                if (document.uri.fsPath === this.currentFilePath) {
                    console.log(`[GoToEndpoint] 文件保存，刷新端点树视图: ${document.uri.fsPath}`);
                    this._fileEndpointCache.delete(document.uri.fsPath);
                    this.refresh();
                }
            }
        });
        
        // 初始化当前文件
        if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.languageId === 'java') {
            this.currentFilePath = vscode.window.activeTextEditor.document.uri.fsPath;
        }
    }

    /**
     * 刷新树视图
     */
    refresh(): void {
        this._onDidChangeTreeData.fire(null);
    }

    /**
     * 获取树节点
     */
    getTreeItem(element: EndpointTreeItem): vscode.TreeItem {
        return element;
    }

    /**
     * 获取子节点
     */
    getChildren(element?: EndpointTreeItem): Thenable<EndpointTreeItem[]> {
        if (!element) {
            // 根节点
            return Promise.resolve(this.getRootItems());
        } else if (element.type === EndpointTreeItemType.Root || element.type === EndpointTreeItemType.PathGroup) {
            // 路径组或根节点
            return Promise.resolve(element.childrenItems || []);
        } else {
            // 端点节点没有子节点
            return Promise.resolve([]);
        }
    }

    /**
     * 获取根节点项
     */
    private getRootItems(): EndpointTreeItem[] {
        // 如果没有当前文件或当前文件不是Java文件，显示提示
        if (!this.currentFilePath) {
            return [
                new EndpointTreeItem(
                    '没有打开Java文件',
                    EndpointTreeItemType.Root,
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }
        
        // 获取当前文件的端点
        let endpoints: EndpointInfo[] | undefined;
        
        // 检查缓存
        const cachedEndpoints = this._fileEndpointCache.get(this.currentFilePath);
        if (cachedEndpoints && Date.now() - cachedEndpoints.timestamp < this.CACHE_EXPIRY) {
            endpoints = cachedEndpoints.endpoints;
        } else {
            // 缓存不存在或已过期，从IndexManager获取
            endpoints = this.indexManager.getEndpointsForFile(this.currentFilePath);
            
            // 更新缓存
            if (endpoints) {
                this._fileEndpointCache.set(this.currentFilePath, {
                    endpoints: endpoints,
                    timestamp: Date.now()
                });
            }
        }
        
        if (!endpoints || endpoints.length === 0) {
            const fileName = this.currentFilePath.split(/[/\\]/).pop() || '';
            // 没有端点时显示提示
            return [
                new EndpointTreeItem(
                    `文件 ${fileName} 中没有找到端点`,
                    EndpointTreeItemType.Root,
                    vscode.TreeItemCollapsibleState.None
                )
            ];
        }

        // 按路径分组构建树
        return this.buildPathTree(endpoints);
    }

    /**
     * 构建路径树
     */
    private buildPathTree(endpoints: EndpointInfo[]): EndpointTreeItem[] {
        const fileName = this.currentFilePath?.split(/[/\\]/).pop() || '当前文件';
        
        // 按照路径分组
        const pathGroups: { [path: string]: EndpointInfo[] } = {};
        
        // 首先将端点按照路径第一段分组
        endpoints.forEach(endpoint => {
            // 分割路径，去除空字符串
            const pathSegments = endpoint.fullPath.split('/').filter(segment => segment.length > 0);
            const firstSegment = pathSegments.length > 0 ? `/${pathSegments[0]}` : '/';
            
            if (!pathGroups[firstSegment]) {
                pathGroups[firstSegment] = [];
            }
            
            pathGroups[firstSegment].push(endpoint);
        });

        // 将分组转换为树节点，创建根节点并设置子节点
        const childrenItems = Object.keys(pathGroups).sort().map(pathKey => {
            return this.createPathGroupNode(pathKey, pathKey, pathGroups[pathKey]);
        });
        
        return [
            new EndpointTreeItem(
                `${fileName} 端点 (${endpoints.length})`,
                EndpointTreeItemType.Root,
                vscode.TreeItemCollapsibleState.Expanded,
                undefined,
                childrenItems
            )
        ];
    }

    /**
     * 创建路径组节点
     */
    private createPathGroupNode(label: string, fullPath: string, endpoints: EndpointInfo[]): EndpointTreeItem {
        // 按照下一级路径继续分组
        const subGroups: { [path: string]: EndpointInfo[] } = {};
        const currentLevelEndpoints: EndpointInfo[] = [];
        
        endpoints.forEach(endpoint => {
            // 如果当前路径的长度超过了fullPath，需要继续分组
            if (endpoint.fullPath.length > fullPath.length && endpoint.fullPath.startsWith(fullPath)) {
                // 获取下一段路径
                const remaining = endpoint.fullPath.substring(fullPath.length);
                const segments = remaining.split('/').filter(s => s.length > 0);
                
                if (segments.length > 0) {
                    const nextSegment = `${fullPath}/${segments[0]}`;
                    
                    if (!subGroups[nextSegment]) {
                        subGroups[nextSegment] = [];
                    }
                    
                    subGroups[nextSegment].push(endpoint);
                    return;
                }
            }
            
            // 如果没有下一级路径，则为当前级别的端点
            currentLevelEndpoints.push(endpoint);
        });
        
        // 创建子节点
        const children: EndpointTreeItem[] = [];
        
        // 添加子分组
        Object.keys(subGroups).sort().forEach(subPath => {
            const subPathLabel = `/${subPath.split('/').filter(s => s.length > 0).pop() || ''}`;
            children.push(this.createPathGroupNode(subPathLabel, subPath, subGroups[subPath]));
        });
        
        // 添加当前级别的端点
        currentLevelEndpoints.sort((a, b) => {
            // 首先按方法排序
            if (a.httpMethod && b.httpMethod) {
                return a.httpMethod.localeCompare(b.httpMethod);
            }
            
            // 然后按端点路径排序
            return a.fullPath.localeCompare(b.fullPath);
        }).forEach(endpoint => {
            let methodValue = endpoint.httpMethod;
            let methodLabel = methodValue ? `[${methodValue}] ` : '';
            let isFeign = endpoint.className && endpoint.className.toLowerCase().includes('feign');
            
            children.push(new EndpointTreeItem(
                `${methodLabel}${endpoint.methodName || endpoint.fullPath}`,
                isFeign ? EndpointTreeItemType.FeignEndpoint : EndpointTreeItemType.ControllerEndpoint,
                vscode.TreeItemCollapsibleState.None,
                endpoint
            ));
        });
        
        // 创建当前组节点并设置子节点
        return new EndpointTreeItem(
            label,
            EndpointTreeItemType.PathGroup,
            vscode.TreeItemCollapsibleState.Expanded,
            undefined,
            children,
            label,
            fullPath
        );
    }
}

/**
 * 打开端点定义
 */
export function openEndpoint(endpoint: EndpointInfo): Thenable<void> {
    return vscode.workspace.openTextDocument(endpoint.filePath)
        .then(document => {
            return vscode.window.showTextDocument(document).then(editor => {
                // 转到端点方法定义处
                const position = new vscode.Position(endpoint.startLine - 1, endpoint.startColumn - 1);
                
                // 设置选择范围
                editor.selection = new vscode.Selection(position, position);
                
                // 确保可见
                editor.revealRange(
                    new vscode.Range(position, position),
                    vscode.TextEditorRevealType.InCenter
                );
            });
        });
}

/**
 * 注册端点树命令
 */
export function registerEndpointTreeCommands(context: vscode.ExtensionContext, treeProvider: EndpointTreeProvider): void {
    // 刷新树视图命令
    context.subscriptions.push(
        vscode.commands.registerCommand('gotoEndpoints.refreshEndpointTree', () => {
            treeProvider.refresh();
        })
    );
    
    // 打开端点定义命令
    context.subscriptions.push(
        vscode.commands.registerCommand('gotoEndpoints.openEndpoint', (endpoint: EndpointInfo) => {
            openEndpoint(endpoint);
        })
    );
} 
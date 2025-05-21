import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';
import { EndpointInfo } from '../parser/models';

const LOG_LEVEL = 'info'; // 'debug' | 'info' | 'warn' | 'error'

function shouldLog(level: string, targetLevel: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const levelIndex = levels.indexOf(level);
    const targetIndex = levels.indexOf(targetLevel);
    return levelIndex >= targetIndex;
}

function log(level: string, message: string, error?: any) {
    if (shouldLog(level, LOG_LEVEL)) {
        if (error) {
            console.log(`[GoToEndpoint] ${message}`, error);
        } else {
            console.log(`[GoToEndpoint] ${message}`);
        }
    }
}

/**
 * 简单的防抖函数，用于减少快速连续触发的搜索
 */
function debounce(func: Function, wait: number): (...args: any[]) => void {
    let timeout: NodeJS.Timeout | null = null;
    return function(...args: any[]) {
        const later = () => {
            timeout = null;
            func(...args);
        };
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(later, wait);
    };
}

export class SearchProvider {

    constructor(private indexManager: IndexManager) {}

    registerSearchCommand(context: vscode.ExtensionContext) {
        const disposable = vscode.commands.registerCommand('gotoEndpoints.search', async () => {
            log('info', '[GoToEndpoint] Search command triggered');
            
            // 检查是否有任何已扫描的端点
            const totalEndpoints = this.indexManager.getTotalEndpointsCount();
            if (totalEndpoints === 0) {
                const result = await vscode.window.showInformationMessage(
                    '未找到任何已扫描的端点。请先使用"Go To Endpoint: 扫描当前Java文件"命令扫描文件。',
                    '扫描当前文件', '取消'
                );
                
                if (result === '扫描当前文件') {
                    vscode.commands.executeCommand('gotoEndpoints.scanCurrentFile');
                }
                return;
            }
            
            // 创建 QuickPick 实例
            const quickPick = vscode.window.createQuickPick<vscode.QuickPickItem & { endpointData?: EndpointInfo }>();
            quickPick.placeholder = '/users/get or getUserById';
            quickPick.title = 'Search Java Endpoints';
            quickPick.matchOnDescription = true;
            quickPick.matchOnDetail = true;
            
            // 初始状态显示加载中
            quickPick.busy = false;
            quickPick.items = [{
                label: '$(search) 请输入搜索关键词...',
                description: '',
                detail: '输入后将自动搜索匹配的端点'
            }];
            
            // 创建一个防抖的搜索函数，避免频繁搜索
            const performSearch = debounce(async (searchQuery: string) => {
                if (!searchQuery || searchQuery.trim().length === 0) {
                    quickPick.items = [{
                        label: '$(search) 请输入搜索关键词...',
                        description: '',
                        detail: '输入后将自动搜索匹配的端点'
                    }];
                    quickPick.busy = false;
                    return;
                }
                
                quickPick.busy = true;
                log('info', `[GoToEndpoint] Processing search query: "${searchQuery}"`);
                
                // 执行搜索
                const results = this.indexManager.search(searchQuery);
                log('info', `[GoToEndpoint] Search completed. Found ${results.length} results for query: "${searchQuery}"`);
                
                // 更新提示文字
                if (results.length === 0) {
                    quickPick.items = [{
                        label: `$(search) 未找到匹配 "${searchQuery}" 的端点`,
                        description: '',
                        detail: '尝试其他关键词或修改搜索条件'
                    }];
                } else {
                    // 转换搜索结果为 QuickPickItem
                    const quickPickItems = results.map(endpoint => {
                        // 优化HTTP方法显示
                        let httpMethodDisplay = endpoint.httpMethod;
                        
                        return {
                            label: `${endpoint.fullPath} ((${endpoint.className})[${httpMethodDisplay}])`,
                            description: `$(symbol-method) ${endpoint.methodName}`,
                            detail: `$(file-code) ${vscode.workspace.asRelativePath(endpoint.filePath)}`,
                            endpointData: endpoint
                        };
                    });
                    
                    quickPick.items = quickPickItems;
                }
                
                quickPick.busy = false;
            }, 300); // 300ms 防抖延迟
            
            // 输入变化时触发搜索
            quickPick.onDidChangeValue(value => {
                if (value !== quickPick.value) {
                    return; // 避免重复处理同一个值
                }
                
                const searchValue = value.trim();
                quickPick.busy = true;
                performSearch(searchValue);
            });
            
            // 选择结果时，导航到相应的端点
            quickPick.onDidAccept(async () => {
                const selectedItem = quickPick.selectedItems[0];
                if (selectedItem && selectedItem.endpointData) {
                    const endpoint = selectedItem.endpointData;
                    log('info', `[GoToEndpoint] User selected endpoint: ${endpoint.fullPath} in ${endpoint.filePath}`);
                    try {
                        quickPick.hide();
                        const doc = await vscode.workspace.openTextDocument(endpoint.filePath);
                        const position = new vscode.Position(endpoint.startLine - 1, endpoint.startColumn -1);
                        await vscode.window.showTextDocument(doc, { selection: new vscode.Range(position, position) });
                        log('info', `[GoToEndpoint] Successfully navigated to selected endpoint in ${endpoint.filePath}`);
                    } catch (error) {
                        log('error', `[GoToEndpoint] Error opening file ${endpoint.filePath}:`, error);
                        vscode.window.showErrorMessage(`GoToEndpoint: Failed to open file: ${endpoint.filePath}`);
                    }
                } else {
                    log('info', '[GoToEndpoint] No endpoint selected by user or selection invalid');
                    quickPick.hide();
                }
            });
            
            // 取消时隐藏 QuickPick
            quickPick.onDidHide(() => {
                quickPick.dispose();
            });
            
            // 显示 QuickPick
            quickPick.show();
        });

        context.subscriptions.push(disposable);
        log('info', '[GoToEndpoint] Search command registered successfully');
    }
}

// Extend QuickPickItem to hold our custom data
declare module 'vscode' {
    interface QuickPickItem {
        endpointData?: EndpointInfo;
    }
} 
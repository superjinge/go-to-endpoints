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
            
            const query = await vscode.window.showInputBox({
                prompt: 'Search Java Endpoints',
                placeHolder: '/users/get or getUserById',
                ignoreFocusOut: true,
            });

            if (query === undefined) {
                log('info', '[GoToEndpoint] Search cancelled by user');
                return; // User cancelled
            }

            const searchQuery = query.trim();

            if (searchQuery.length === 0) {
                log('info', '[GoToEndpoint] Empty search query');
                vscode.window.showInformationMessage('Please provide a search term.');
                return; // Empty search term
            }

            log('info', `[GoToEndpoint] Processing search query: "${searchQuery}"`);
            const results = this.indexManager.search(searchQuery);
            log('info', `[GoToEndpoint] Search completed. Found ${results.length} results for query: "${searchQuery}"`);

            if (results.length === 0) {
                log('info', '[GoToEndpoint] No results found, showing information message');
                vscode.window.showInformationMessage(`GoToEndpoint: No endpoints found matching "${searchQuery}".`);
                return;
            }

            log('info', '[GoToEndpoint] Creating quick pick items from search results');
            const quickPickItems: vscode.QuickPickItem[] = results.map(endpoint => {
                // 优化HTTP方法显示
                let httpMethodDisplay = endpoint.httpMethod;
                
                return {
                    label: `${endpoint.fullPath} ((${endpoint.className})[${httpMethodDisplay}])`,
                    description: `$(symbol-method) ${endpoint.methodName}`,
                    detail: `$(file-code) ${vscode.workspace.asRelativePath(endpoint.filePath)}`,
                    endpointData: endpoint
                };
            });

            log('info', '[GoToEndpoint] Showing quick pick with search results');
            const selectedItem = await vscode.window.showQuickPick(quickPickItems, {
                matchOnDescription: true,
                matchOnDetail: true,
                placeHolder: `找到 ${results.length} 个端点匹配 "${searchQuery}"。选择一个以导航。`, 
                ignoreFocusOut: true,
            });

            if (selectedItem && (selectedItem as any).endpointData) {
                const endpoint: EndpointInfo = (selectedItem as any).endpointData;
                log('info', `[GoToEndpoint] User selected endpoint: ${endpoint.fullPath} in ${endpoint.filePath}`);
                try {
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
            }
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
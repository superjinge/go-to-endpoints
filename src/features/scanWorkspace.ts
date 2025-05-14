import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';

/**
 * 注册扫描整个工作区的命令
 * @param context VS Code扩展上下文
 * @param indexManager 索引管理器实例
 */
export function registerScanWorkspaceCommand(context: vscode.ExtensionContext, indexManager: IndexManager) {
    const disposable = vscode.commands.registerCommand('gotoEndpoints.scanWorkspace', async () => {
        try {
            // 确保有打开的工作区
            if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
                vscode.window.showInformationMessage('没有打开的工作区，请先打开一个项目');
                return;
            }

            // 提示用户这可能需要一些时间
            const proceed = await vscode.window.showInformationMessage(
                '将扫描整个工作区以查找端点，对于大型项目这可能需要一些时间。是否继续？',
                '继续', '取消'
            );

            if (proceed !== '继续') {
                return;
            }

            // 开始构建索引
            vscode.window.showInformationMessage('开始扫描工作区...');
            console.log('[GoToEndpoint] Starting workspace scan via command');
            
            await indexManager.buildIndex();
            
            console.log('[GoToEndpoint] Workspace scan completed');
        } catch (error) {
            console.error('[GoToEndpoint] Error scanning workspace:', error);
            vscode.window.showErrorMessage('扫描工作区时出错');
        }
    });
    
    context.subscriptions.push(disposable);
    console.log('[GoToEndpoint] Scan workspace command registered');
} 
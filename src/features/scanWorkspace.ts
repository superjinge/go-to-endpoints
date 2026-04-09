import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';
import { t } from '../i18n';

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
                vscode.window.showInformationMessage(t('scanWorkspace.noWorkspace'));
                return;
            }

            const cont = t('common.continue');
            const cancel = t('common.cancel');
            const proceed = await vscode.window.showInformationMessage(
                t('scanWorkspace.confirmScan'),
                cont,
                cancel
            );

            if (proceed !== cont) {
                return;
            }

            vscode.window.showInformationMessage(t('scanWorkspace.starting'));
            console.log('[GoToEndpoint] Starting workspace scan via command');
            
            await indexManager.buildIndex();
            
            console.log('[GoToEndpoint] Workspace scan completed');
        } catch (error) {
            console.error('[GoToEndpoint] Error scanning workspace:', error);
            vscode.window.showErrorMessage(t('scanWorkspace.error'));
        }
    });
    
    context.subscriptions.push(disposable);
    console.log('[GoToEndpoint] Scan workspace command registered');
} 
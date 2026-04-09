// Add log at the very top level to check module loading
console.log('[GoToEndpoint] MODULE LOADING...');

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { IndexManager } from './indexer/indexManager';
import { FileWatcher } from './indexer/fileWatcher'; // 启用文件监听
import { SearchProvider } from './features/searchProvider'; // Only import SearchProvider
import { EndpointCodeLensProvider, registerCodeLensCommand } from './features/codeLensProvider';
import { EndpointTreeProvider, registerEndpointTreeCommands } from './features/endpointTreeProvider';
import { showInfo, showWarning, showError } from './utils/messageUtils';
import { initI18n, t } from './i18n';

let fileWatcher: FileWatcher | null = null; // 启用文件监听变量
let statusBarItem: vscode.StatusBarItem;
let lastEndpointCount = 0;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('[GoToEndpoint] ACTIVATE function called.');
	console.log('[GoToEndpoint] Extension activating...');

	// 创建状态栏项目
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'gotoEndpoints.search'; // This command is registered by SearchProvider
	updateStatusBar(0);
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// 1. Initialize Index Manager
	const indexManager = new IndexManager();
	
	// 添加端点更新事件监听器，更新状态栏
	indexManager.onIndexUpdated((count) => {
		updateStatusBar(count);
	});

	// 3. Initialize SearchProvider and register its command
	const searchProvider = new SearchProvider(indexManager);
	searchProvider.registerSearchCommand(context); // This correctly registers 'gotoEndpoints.search'
	console.log('[GoToEndpoint] Search command registered via SearchProvider.');

	// 4. Initialize and register CodeLens Provider
	const codeLensProvider = new EndpointCodeLensProvider(indexManager);
	const codeLensDisposable = vscode.languages.registerCodeLensProvider({ language: 'java' }, codeLensProvider);
	context.subscriptions.push(codeLensDisposable);
	console.log('[GoToEndpoint] CodeLens provider registered.');

	// 5. 启用文件监听，自动更新索引
	fileWatcher = new FileWatcher(indexManager);
	fileWatcher.startWatching();
	context.subscriptions.push({ dispose: () => fileWatcher?.dispose() });
	console.log('[GoToEndpoint] File watcher started for Java files.');
	
	// 6. 监听当前文件变更，自动扫描当前Java文件
	const fileChangeListener = vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.languageId === 'java') {
			console.log(`[GoToEndpoint] Java file saved: ${document.uri.fsPath}`);
			// 文件保存时强制刷新，因为内容已改变
			indexManager.updateFile(document.uri.fsPath, true).then(() => {
				const endpoints = indexManager.getEndpointsForFile(document.uri.fsPath) || [];
				console.log(`[GoToEndpoint] Auto-updated index for ${document.uri.fsPath}, found ${endpoints.length} endpoints`);
			});
		}
	});
	context.subscriptions.push(fileChangeListener);
	
	// 7. 监听编辑器变更，确保当前Java文件被扫描
	const editorChangeListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor && editor.document.languageId === 'java') {
			const filePath = editor.document.uri.fsPath;
			console.log(`[GoToEndpoint] Active editor changed to Java file: ${filePath}`);
			
			// 仅当从未进入过索引（undefined）时自动扫描；已索引但为 [] 表示已解析无端点，避免反复扫
			if (indexManager.getEndpointsForFile(filePath) === undefined) {
				console.log(`[GoToEndpoint] Auto-scanning newly opened Java file: ${filePath}`);
				// 自动扫描时不强制刷新，可以使用缓存
				indexManager.updateFile(filePath, false).then(() => {
					const endpoints = indexManager.getEndpointsForFile(filePath) || [];
					console.log(`[GoToEndpoint] Auto-scanned Java file, found ${endpoints.length} endpoints`);
				});
			}
		}
	});
	context.subscriptions.push(editorChangeListener);

	// Register the command for copying path (used by CodeLens)
	registerCodeLensCommand(context);
	console.log('[GoToEndpoint] CodeLens copy command registered.');

	// Register scan current file command
	const scanDisposable = vscode.commands.registerCommand('gotoEndpoints.scanCurrentFile', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification, 
			title: t('scan.current.progressTitle'),
			cancellable: false
		}, async (progress) => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (editor && editor.document.languageId === 'java') {
					const filePath = editor.document.uri.fsPath;
					const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
					progress.report({ message: t('scan.current.progressFile', { fileName }) });
					
					// 手动扫描时强制刷新，忽略缓存
					await indexManager.updateFile(filePath, true);
					const endpoints = indexManager.getEndpointsForFile(filePath) || [];
					showInfo(t('scan.current.done', { count: endpoints.length }));
				} else {
					showWarning(t('scan.current.noJavaFile'));
				}
			} catch (error: any) {
				console.error('[GoToEndpoint] 扫描当前文件失败:', error);
				showError(t('scan.current.error', { detail: error?.message || t('common.unknownError') }));
			}
		});
	});
	context.subscriptions.push(scanDisposable);
	console.log('[GoToEndpoint] Scan current file command registered.');

	// 注册扫描工作区的命令
	const scanWorkspaceDisposable = vscode.commands.registerCommand('gotoEndpoints.scanWorkspace', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: t('scan.workspace.progressTitle'),
			cancellable: true
		}, async (progress, token) => {
			progress.report({ message: t('scan.workspace.progressStart') });
			try {
				// 首先清空缓存
				console.log('[GoToEndpoint] 清除缓存并重建索引...');
				indexManager.index.clear();
				indexManager.initializeEmptyCache();
				
				// 删除缓存文件
				try {
					const fs = require('fs');
					const cachePath = indexManager.getCachePath();
					if (fs.existsSync(cachePath)) {
						fs.unlinkSync(cachePath);
						console.log('[GoToEndpoint] 缓存文件已删除');
					}
				} catch (error) {
					console.error('[GoToEndpoint] 删除缓存文件时出错:', error);
				}
				
				// 然后重建索引
				await indexManager.buildIndex(token);
				showInfo(t('scan.workspace.done', { count: indexManager.getEndpointCount() }));
			} catch (error: any) {  // 显式类型标注
				if (!token.isCancellationRequested) {
					const errorMessage = error?.message || t('common.unknownError');
					showError(t('scan.workspace.error', { detail: errorMessage }));
				}
			}
		});
	});
	context.subscriptions.push(scanWorkspaceDisposable);
	console.log('[GoToEndpoint] Scan workspace command registered.');

	// 注册清除缓存并重新扫描的命令
	const clearCacheDisposable = vscode.commands.registerCommand('gotoEndpoints.clearCacheAndRebuild', () => {
		const ok = t('common.ok');
		const cancel = t('common.cancel');
		vscode.window.showWarningMessage(
			t('dialog.clearCache.confirm'),
			ok,
			cancel
		).then(selection => {
			if (selection === ok) {
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: t('clearCache.progressTitle'),
					cancellable: true
				}, async (progress, token) => {
					progress.report({ message: t('clearCache.clearing') });
					try {
						// 清空缓存
						console.log('[GoToEndpoint] 清除缓存并重建索引...');
						indexManager.index.clear();
						indexManager.initializeEmptyCache();
						
						// 删除缓存文件
						try {
							const fs = require('fs');
							const cachePath = indexManager.getCachePath();
							if (fs.existsSync(cachePath)) {
								fs.unlinkSync(cachePath);
								console.log('[GoToEndpoint] 缓存文件已删除');
							}
						} catch (error) {
							console.error('[GoToEndpoint] 删除缓存文件时出错:', error);
						}
						
						// 然后重建索引
						progress.report({ message: t('clearCache.rescanning') });
						await indexManager.buildIndex(token);
						showInfo(t('clearCache.done', { count: indexManager.getEndpointCount() }));
					} catch (error: any) {
						if (!token.isCancellationRequested) {
							const errorMessage = error?.message || t('common.unknownError');
							showError(t('clearCache.error', { detail: errorMessage }));
						}
					}
				});
			}
		});
	});
	context.subscriptions.push(clearCacheDisposable);
	console.log('[GoToEndpoint] Clear cache command registered.');

	// 初始化端点树视图
	const endpointTreeProvider = new EndpointTreeProvider(indexManager);
	const treeView = vscode.window.createTreeView('gotoEndpointsExplorer', {
		treeDataProvider: endpointTreeProvider,
		showCollapseAll: true
	});
	context.subscriptions.push(treeView);
	
	// 注册树视图相关命令
	registerEndpointTreeCommands(context, endpointTreeProvider);
	console.log('[GoToEndpoint] Endpoint tree view registered.');

	context.subscriptions.push(
		initI18n(() => {
			updateStatusBar(lastEndpointCount);
			endpointTreeProvider.refresh();
			codeLensProvider.onDisplayLanguageChanged();
		})
	);

	console.log('[GoToEndpoint] Extension activated successfully.'); // Simplified message

	// 添加提示，告知用户插件已启动
	showInfo(t('activation.hint'));
}

/**
 * 更新状态栏显示
 * @param count 已索引的端点数量
 */
function updateStatusBar(count: number): void {
	lastEndpointCount = count;
	statusBarItem.text = `$(search) ${t('statusBar.text', { count })}`;
	statusBarItem.tooltip = t('statusBar.tooltip');
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (fileWatcher) {
		fileWatcher.dispose();
		fileWatcher = null;
	}
	console.log('[GoToEndpoint] Extension deactivated.');
}

// Add log at the very top level to check module loading
console.log('[GoToEndpoint] MODULE LOADING...');

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { IndexManager } from './indexer/indexManager';
import { FileWatcher } from './indexer/fileWatcher'; // 启用文件监听
import { SearchProvider } from './features/searchProvider'; // Only import SearchProvider
import { EndpointCodeLensProvider, registerCodeLensCommand } from './features/codeLensProvider';
// Remove old/incorrect imports
// import { registerScanCurrentFileCommand } from './features/scanCurrentFile'; 
// import { registerScanWorkspaceCommand } from './features/scanWorkspace'; // Assuming this is not needed or handled elsewhere
// import { showSearchInput } from './features/search'; // Removed incorrect import path
// import { scanAndNavigateToFile } from './features/scanCurrentFile';
import { EndpointTreeProvider, registerEndpointTreeCommands } from './features/endpointTreeProvider';
import { showInfo, showWarning, showError } from './utils/messageUtils';

let fileWatcher: FileWatcher | null = null; // 启用文件监听变量
let statusBarItem: vscode.StatusBarItem;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {
	console.log('[GoToEndpoint] ACTIVATE function called.');
	console.log('[GoToEndpoint] Extension activating...');

	// 创建状态栏项目
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'gotoEndpoints.search'; // This command is registered by SearchProvider
	statusBarItem.tooltip = 'Go To Endpoint: 搜索端点'; // Chinese tooltip
	updateStatusBar(0);
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// 1. Initialize Index Manager
	const indexManager = new IndexManager();
	
	// 添加端点更新事件监听器，更新状态栏
	indexManager.onIndexUpdated((count) => {
		updateStatusBar(count);
	});

	// 注释掉自动构建索引的代码，只在用户手动触发时构建
	// 2. Start initial index build (asynchronously)
	// indexManager.buildIndex().then(() => {
	// 	console.log('[GoToEndpoint] Initial index build completed in background.');
	// }).catch(error => {
	// 	console.error("[GoToEndpoint] Initial index build failed:", error);
	// });

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
			indexManager.updateFile(document.uri.fsPath).then(() => {
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
			
			// 检查当前文件是否已索引
			if (!indexManager.getEndpointsForFile(filePath)) {
				console.log(`[GoToEndpoint] Auto-scanning newly opened Java file: ${filePath}`);
				indexManager.updateFile(filePath).then(() => {
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
			title: '扫描当前Java文件中...',
			cancellable: false
		}, async (progress) => {
			try {
				const editor = vscode.window.activeTextEditor;
				if (editor && editor.document.languageId === 'java') {
					const filePath = editor.document.uri.fsPath;
					progress.report({ message: `扫描文件: ${filePath.split(/[/\\]/).pop()}` });
					
					await indexManager.updateFile(filePath);
					const endpoints = indexManager.getEndpointsForFile(filePath) || [];
					showInfo(`扫描完成，在当前文件中找到 ${endpoints.length} 个端点`);
				} else {
					showWarning('没有打开的Java文件，请先打开Java文件');
				}
			} catch (error: any) {
				console.error('[GoToEndpoint] 扫描当前文件失败:', error);
				showError(`扫描失败: ${error?.message || '未知错误'}`);
			}
		});
	});
	context.subscriptions.push(scanDisposable);
	console.log('[GoToEndpoint] Scan current file command registered.');

	// 注册扫描工作区的命令
	const scanWorkspaceDisposable = vscode.commands.registerCommand('gotoEndpoints.scanWorkspace', () => {
		vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: '扫描工作区中...',
			cancellable: true
		}, async (progress, token) => {
			progress.report({ message: '开始扫描Java文件' });
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
				showInfo(`扫描完成，找到 ${indexManager.getEndpointCount()} 个端点`);
			} catch (error: any) {  // 显式类型标注
				if (!token.isCancellationRequested) {
					const errorMessage = error?.message || '未知错误';
					showError(`扫描失败: ${errorMessage}`);
				}
			}
		});
	});
	context.subscriptions.push(scanWorkspaceDisposable);
	console.log('[GoToEndpoint] Scan workspace command registered.');

	// 注册清除缓存并重新扫描的命令
	const clearCacheDisposable = vscode.commands.registerCommand('gotoEndpoints.clearCacheAndRebuild', () => {
		// 首先询问用户是否确定要清除缓存
		vscode.window.showWarningMessage(
			'确定要清除缓存并重新扫描吗？这将删除所有缓存并重新解析所有文件，可能需要较长时间。', 
			'确定', '取消'
		).then(selection => {
			if (selection === '确定') {
				vscode.window.withProgress({
					location: vscode.ProgressLocation.Notification,
					title: '清除缓存并重建索引...',
					cancellable: true
				}, async (progress, token) => {
					progress.report({ message: '正在清除缓存' });
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
						progress.report({ message: '重新扫描所有Java文件' });
						await indexManager.buildIndex(token);
						showInfo(`缓存已清除，重新扫描完成，找到 ${indexManager.getEndpointCount()} 个端点`);
					} catch (error: any) {
						if (!token.isCancellationRequested) {
							const errorMessage = error?.message || '未知错误';
							showError(`清除缓存失败: ${errorMessage}`);
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

	console.log('[GoToEndpoint] Extension activated successfully.'); // Simplified message

	// 添加提示，告知用户插件已启动
	showInfo('Go To Endpoints 已启动！性能优化模式已启用：仅显示当前Java文件的端点。右键点击Java文件选择"扫描当前Java文件"，或使用Ctrl+Shift+J快捷键立即扫描。');
}

/**
 * 更新状态栏显示
 * @param count 已索引的端点数量
 */
function updateStatusBar(count: number): void {
	statusBarItem.text = `$(search) 端点: ${count}`; // Chinese text
}

// This method is called when your extension is deactivated
export function deactivate() {
	if (fileWatcher) {
		fileWatcher.dispose();
		fileWatcher = null;
	}
	console.log('[GoToEndpoint] Extension deactivated.');
}

import * as vscode from 'vscode';
import { IndexManager } from '../indexer/indexManager';
import { EndpointInfo } from '../parser/models';

// Define a custom QuickPick item that holds the EndpointInfo
interface EndpointQuickPickItem extends vscode.QuickPickItem {
    endpoint: EndpointInfo;
}

/**
 * Scans the current active Java file for endpoints and displays them in a Quick Pick list.
 * Allows the user to select an endpoint to navigate to its definition.
 * @param indexManager An instance of IndexManager to get endpoint data.
 */
export async function scanAndNavigateToFile(indexManager: IndexManager) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showInformationMessage('No active editor found.');
        return;
    }

    const document = editor.document;
    if (!document.languageId.includes('java')) {
        vscode.window.showInformationMessage('Current file is not a Java file.');
        return;
    }

    const filePath = document.uri.fsPath;
    console.log(`[GoToEndpoint] Scanning current file: ${filePath}`);
    
    try {
        // 扫描文件内容获取端点
        const fileContent = document.getText();
        console.log(`[GoToEndpoint] File size: ${fileContent.length} bytes`);

        // 强制重新解析当前文件，确保能获取最新内容
        console.log(`[GoToEndpoint] Forcing file reparse: ${filePath}`);
        
        // 先更新索引中的文件 (强制重新解析)
        await indexManager.updateFile(filePath);
        
        // 获取文件的端点
        const endpoints = indexManager.getEndpointsForFile(filePath);

    if (!endpoints || endpoints.length === 0) {
            console.log(`[GoToEndpoint] No endpoints found in file: ${filePath}`);
            console.log(`[GoToEndpoint] File content sample (first 100 chars): ${fileContent.substring(0, 100)}`);
            
            // 检查文件中是否包含关键注解 (简单文本搜索)
            const hasController = fileContent.includes('@Controller') || fileContent.includes('@RestController');
            const hasRequestMapping = fileContent.includes('@RequestMapping');
            const hasGetMapping = fileContent.includes('@GetMapping');
            const hasPostMapping = fileContent.includes('@PostMapping');
            
            console.log(`[GoToEndpoint] Contains @Controller/@RestController: ${hasController}`);
            console.log(`[GoToEndpoint] Contains @RequestMapping: ${hasRequestMapping}`);
            console.log(`[GoToEndpoint] Contains @GetMapping: ${hasGetMapping}`);
            console.log(`[GoToEndpoint] Contains @PostMapping: ${hasPostMapping}`);
            
            if (hasController || hasRequestMapping || hasGetMapping || hasPostMapping) {
                vscode.window.showWarningMessage('File appears to contain endpoint annotations, but no endpoints were found. See logs for details.');
            } else {
                vscode.window.showInformationMessage('No endpoints found in current file.');
            }
        return;
    }

        console.log(`[GoToEndpoint] Found ${endpoints.length} endpoints in current file`);

        // 创建QuickPick项
        const items: EndpointQuickPickItem[] = endpoints.map(endpoint => ({
            label: `${endpoint.httpMethod} ${endpoint.fullPath}`,
            description: `${endpoint.className}.${endpoint.methodName}`,
            detail: `Line: ${endpoint.startLine}`,
            endpoint: endpoint
    }));

        // 显示QuickPick
        const selectedItem = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select an endpoint to navigate to'
    });

        if (selectedItem) {
            // 导航到选中的端点
            const endpoint = selectedItem.endpoint;
            const position = new vscode.Position(endpoint.startLine - 1, endpoint.startColumn - 1);
            
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
            
            console.log(`[GoToEndpoint] Navigated to endpoint: ${endpoint.methodName} at line ${endpoint.startLine}`);
        }
        } catch (error) {
        console.error(`[GoToEndpoint] Error during file scan:`, error);
        vscode.window.showErrorMessage(`Error scanning file: ${error instanceof Error ? error.message : String(error)}`);
    }
} 
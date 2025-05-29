import * as vscode from 'vscode';

/**
 * 显示自动消失的通知消息
 * @param message 消息内容
 * @param messageType 消息类型：'info' | 'warning' | 'error'
 * @param detail 详细信息（可选）
 */
export function showAutoHideMessage(
    message: string, 
    messageType: 'info' | 'warning' | 'error' = 'info',
    detail?: string
): Thenable<void> {
    // 获取配置的自动关闭时间（默认3秒）
    const config = vscode.workspace.getConfiguration('gotoEndpoints');
    const autoCloseTimeout = config.get<number>('notificationTimeout', 3000);
    
    // 如果有详细信息，添加到标题中
    const title = detail ? `${message} | ${detail}` : message;
    
    // 使用带有图标的消息文本
    const messageWithPrefix = messageType === 'warning' ? 
        `⚠️ ${title}` : (messageType === 'error' ? `❌ ${title}` : `ℹ️ ${title}`);
    
    // VS Code 标准通知 API 没有内置的自动关闭功能，必须使用 withProgress 来实现
    const disposable = vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: messageWithPrefix,
        cancellable: false
    }, async () => {
        // 等待指定时间后自动关闭
        await new Promise(resolve => setTimeout(resolve, autoCloseTimeout));
        return;
    });
    
    // 确保通知可以正常显示和被点击复制按钮
    // 返回 disposable 对象，允许在需要时手动关闭通知
    return disposable;
}

/**
 * 显示信息通知（自动消失）
 */
export function showInfo(message: string, detail?: string): Thenable<void> {
    return showAutoHideMessage(message, 'info', detail);
}

/**
 * 显示警告通知（自动消失）
 */
export function showWarning(message: string, detail?: string): Thenable<void> {
    return showAutoHideMessage(message, 'warning', detail);
}

/**
 * 显示错误通知（自动消失）
 */
export function showError(message: string, detail?: string): Thenable<void> {
    return showAutoHideMessage(message, 'error', detail);
} 
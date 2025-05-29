import * as vscode from 'vscode';
import { IndexManager } from './indexManager';
import { minimatch } from 'minimatch';

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
    let timeoutId: NodeJS.Timeout | null = null;

    return (...args: Parameters<F>): void => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        timeoutId = setTimeout(() => func(...args), waitFor);
    };
}

export class FileWatcher {
    private watcher: vscode.FileSystemWatcher | null = null;
    private debouncedUpdate: (filePath: string) => void;
    private debouncedRemove: (filePath: string) => void; // Renamed for clarity

    constructor(private indexManager: IndexManager, private debounceDelay: number = 500) {
        // Debounce updates and deletions to avoid excessive processing during rapid file changes
        this.debouncedUpdate = debounce(this.indexManager.updateFile.bind(this.indexManager), this.debounceDelay);
        // Use debounce for remove as well for consistency, although less critical
        this.debouncedRemove = debounce(this.indexManager.removeFile.bind(this.indexManager), this.debounceDelay);
    }

    public startWatching() {
        // Watch all files initially, rely on isExcluded during events
        // FileSystemWatcher glob pattern limitations make precise include/exclude hard here.
        this.watcher = vscode.workspace.createFileSystemWatcher('**/*');
        console.log(`[GoToEndpoint] File watcher started for pattern: **/*`);

        this.watcher.onDidChange(uri => {
            if (uri.fsPath.endsWith('.java') && !this.isExcluded(uri.fsPath)) {
                 console.log(`[GoToEndpoint] File changed: ${uri.fsPath}`);
                 this.debouncedUpdate(uri.fsPath);
            }
        });

        this.watcher.onDidCreate(uri => {
             if (uri.fsPath.endsWith('.java') && !this.isExcluded(uri.fsPath)) {
                 console.log(`[GoToEndpoint] File created: ${uri.fsPath}`);
                 this.debouncedUpdate(uri.fsPath); // Treat creation like an update
             }
        });

        this.watcher.onDidDelete(uri => {
             if (uri.fsPath.endsWith('.java')) { // No need to check exclusion for deletion from index
                console.log(`[GoToEndpoint] File deleted: ${uri.fsPath}`);
                this.debouncedRemove(uri.fsPath);
             }
        });
    }

    private isExcluded(filePath: string): boolean {
         const config = vscode.workspace.getConfiguration('gotoEndpoints');
         const excludeGlobs = config.get<string[]>('excludeGlobs') ?? [];
         const relativePath = vscode.workspace.asRelativePath(filePath);

         // Use minimatch for more reliable glob matching
         try {
            // Call the named import directly
            return excludeGlobs.some(pattern => minimatch(relativePath, pattern, { dot: true }) || minimatch(filePath, pattern, { dot: true }));
         } catch (error) {
            console.error(`[GoToEndpoint] Error during minimatch exclusion check for ${filePath}:`, error);
            return false; // Default to not excluded on error
         }
     }

    public dispose() {
        if (this.watcher) {
            this.watcher.dispose();
            this.watcher = null;
            console.log('[GoToEndpoint] File watcher stopped.');
        }
    }
} 
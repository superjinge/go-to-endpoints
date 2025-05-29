import * as vscode from 'vscode';
import { EndpointInfo } from '../parser/models';
import { AstJavaParser } from '../parser/astJavaParser';
import * as fs from 'fs/promises'; // Use promises API for async file reading
import { CancellationToken } from 'vscode';
import * as path from 'path';

// 缓存数据结构接口
interface EndpointCache {
  version: string;  // 缓存版本
  lastUpdate: number; // 上次更新时间戳
  fileData: { [filePath: string]: FileCacheEntry }; // 文件缓存映射
}

// 文件缓存条目接口
interface FileCacheEntry {
  lastModified: number; // 文件最后修改时间戳
  endpoints: EndpointInfo[]; // 解析出的端点
}

// Not just an interface but an Event interface
export interface EndpointIndexListener {
    (count: number): void;
}

export class IndexManager {
  public index: Map<string, EndpointInfo[]> = new Map(); // Key: file path, Value: endpoints in that file
  private parser: AstJavaParser;
  private isBuilding: boolean = false;
  private indexListeners: EndpointIndexListener[] = [];
  
  // 缓存相关属性
  private cache: EndpointCache | null = null;
  private readonly CACHE_VERSION = '1.0.0';
  private readonly CACHE_FILE_NAME = 'endpoints-cache.json';
  private cacheEnabled: boolean = true; // 是否启用缓存
  
  // 添加事件触发器，用于通知索引更新
  private _onIndexUpdated = new vscode.EventEmitter<number>();
  public readonly onIndexUpdated = this._onIndexUpdated.event;

  // 添加调用计数器
  private _endpointRequestCount = new Map<string, number>();

  constructor() {
    this.parser = new AstJavaParser();
    console.log('[GoToEndpoint IndexManager] Initialized with AST Parser');
    
    // 读取用户配置
    const config = vscode.workspace.getConfiguration('gotoEndpoints');
    this.cacheEnabled = config.get<boolean>('enableCache', true);
    console.log(`[GoToEndpoint] Cache ${this.cacheEnabled ? 'enabled' : 'disabled'}`);
    
    // 监听配置变更
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('gotoEndpoints.enableCache')) {
        this.cacheEnabled = vscode.workspace.getConfiguration('gotoEndpoints').get<boolean>('enableCache', true);
        console.log(`[GoToEndpoint] Cache setting changed to ${this.cacheEnabled ? 'enabled' : 'disabled'}`);
      }
    });
    
    // 初始化时加载缓存
    this.loadCache().then(() => {
      console.log('[GoToEndpoint] Cache loaded');
    this.setupWatcher();
      
      // 根据配置决定是否自动索引
      const autoIndex = config.get<boolean>('autoIndex', true);
      if (autoIndex) {
        // 使用缓存的索引进行初始化
    this.rebuildIndex();
      } else {
        console.log('[GoToEndpoint] Auto-indexing disabled, skipping initial index build');
        
        // 仍然触发一次更新事件，通知UI刷新
        this._onIndexUpdated.fire(this.getTotalEndpointsCount());
      }
    });
  }

  /**
   * 加载缓存文件
   */
  private async loadCache(): Promise<void> {
    try {
      // 获取缓存文件路径
      const cachePath = this.getCachePath();
      
      // 检查缓存文件是否存在
      try {
        await fs.access(cachePath);
      } catch {
        console.log('[GoToEndpoint] No cache file found, will create new cache');
        this.initializeEmptyCache();
        return;
      }
      
      // 读取缓存文件
      const cacheContent = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(cacheContent) as EndpointCache;
      
      // 验证缓存版本
      if (cache.version !== this.CACHE_VERSION) {
        console.log(`[GoToEndpoint] Cache version mismatch, expected ${this.CACHE_VERSION}, found ${cache.version}`);
        this.initializeEmptyCache();
        return;
      }
      
      this.cache = cache;
      console.log(`[GoToEndpoint] Loaded cache with ${Object.keys(cache.fileData).length} files`);
      
      // 将缓存数据恢复到索引中
      for (const [filePath, cacheEntry] of Object.entries(this.cache.fileData)) {
        if (cacheEntry.endpoints.length > 0) {
          this.index.set(filePath, cacheEntry.endpoints);
        }
      }
      
      console.log(`[GoToEndpoint] Restored ${this.index.size} files from cache`);
    } catch (error) {
      console.error('[GoToEndpoint] Error loading cache:', error);
      this.initializeEmptyCache();
    }
  }
  
  /**
   * 初始化空的缓存对象
   */
  public initializeEmptyCache(): void {
    this.cache = {
      version: this.CACHE_VERSION,
      lastUpdate: Date.now(),
      fileData: {}
    };
  }
  
  /**
   * 保存缓存到文件
   */
  private async saveCache(): Promise<void> {
    if (!this.cache || !this.cacheEnabled) {
      return;
    }
    
    try {
      const cachePath = this.getCachePath();
      this.cache.lastUpdate = Date.now();
      
      // 将缓存写入文件
      await fs.writeFile(cachePath, JSON.stringify(this.cache), 'utf-8');
      console.log(`[GoToEndpoint] Cache saved with ${Object.keys(this.cache.fileData).length} files`);
    } catch (error) {
      console.error('[GoToEndpoint] Error saving cache:', error);
    }
  }
  
  /**
   * 获取缓存文件路径
   */
  public getCachePath(): string {
    const storageUri = this.getStoragePath();
    return path.join(storageUri, this.CACHE_FILE_NAME);
  }
  
  /**
   * 获取存储路径
   */
  private getStoragePath(): string {
    // 使用扩展上下文的存储路径或临时目录
    const storagePath = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath || require('os').tmpdir();
    // 确保目录存在
    const cacheDir = path.join(storagePath, '.vscode', 'go-to-endpoints');
    
    // 使用同步API确保目录存在
    try {
      const fs = require('fs');
      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }
    } catch (error) {
      console.error('[GoToEndpoint] Error creating cache directory:', error);
    }
    
    return cacheDir;
  }
  
  /**
   * 检查文件是否需要重新解析
   * @param filePath 文件路径
   * @returns 是否需要解析
   */
  private async shouldParseFile(filePath: string): Promise<boolean> {
    if (!this.cache || !this.cacheEnabled) {
      return true; // 没有缓存或缓存禁用时，始终需要解析
    }
    
    try {
      // 获取文件状态
      const stats = await fs.stat(filePath);
      const lastModified = stats.mtimeMs;
      
      // 检查文件是否在缓存中
      const cacheEntry = this.cache.fileData[filePath];
      if (!cacheEntry) {
        return true; // 文件不在缓存中，需要解析
      }
      
      // 检查文件是否被修改过
      if (cacheEntry.lastModified < lastModified) {
        return true; // 文件被修改过，需要重新解析
      }
      
      // 文件没有变化，不需要重新解析
      // 直接从缓存恢复索引
      if (cacheEntry.endpoints.length > 0 && !this.index.has(filePath)) {
        this.index.set(filePath, cacheEntry.endpoints);
      }
      
      return false;
    } catch (error) {
      // 发生错误，安全起见重新解析
      return true;
    }
  }

  /**
   * Initiates the initial indexing process for the workspace.
   * Reports progress to the user.
   */
  async buildIndex(cancellationToken?: CancellationToken): Promise<void> {
    if (this.isBuilding) {
      console.warn("[GoToEndpoint] Index build already in progress. Skipping new request.");
      return;
    }
    
    console.log("[GoToEndpoint] Starting index build process...");
    this.isBuilding = true;

    try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Window,
            title: 'GoToEndpoint: Indexing Java endpoints...',
            cancellable: true, // Support cancellation
          },
          async (progress) => {
            try {
              const config = vscode.workspace.getConfiguration('gotoEndpoints');
              const includePatterns = config.get<string[]>('includeGlobs') ?? ['**/*.java'];
              const excludePattern = `{${(config.get<string[]>('excludeGlobs') ?? []).join(',')}}`; // Combine exclude patterns for findFiles

              console.log(`[GoToEndpoint] Include patterns: ${JSON.stringify(includePatterns)}`);
              console.log(`[GoToEndpoint] Exclude pattern: ${excludePattern}`);
              
              progress.report({ message: 'Finding Java files...', increment: 0 });

              // Use findFiles correctly with multiple include patterns and a single exclude pattern string
              let allJavaFiles: vscode.Uri[] = [];
              for (const pattern of includePatterns) {
                console.log(`[GoToEndpoint] Searching for files with pattern: ${pattern}`);
                const files = await vscode.workspace.findFiles(pattern, excludePattern);
                console.log(`[GoToEndpoint] Found ${files.length} files with pattern: ${pattern}`);
                allJavaFiles = allJavaFiles.concat(files);
              }
              // Remove duplicates if patterns overlap
              allJavaFiles = allJavaFiles.filter((uri, index, self) =>
                index === self.findIndex((u) => u.fsPath === uri.fsPath)
              );

              const totalFiles = allJavaFiles.length;
              console.log(`[GoToEndpoint] Total unique Java files found: ${totalFiles}`);
              progress.report({ message: `Found ${totalFiles} files. Parsing...`, increment: 10 });

              console.log(`[GoToEndpoint] Starting index build for ${totalFiles} files.`);

              // 大幅增加并发数
              const CONCURRENCY_LIMIT = config.get<number>('concurrencyLimit', 20);
              // 我们使用实际配置值的3倍，显著提高并发度，但最大不超过100
              const actualConcurrencyLimit = Math.min(CONCURRENCY_LIMIT * 3, 100);
              const usePrefilter = config.get<boolean>('usePrefilter', true);
              console.log(`[GoToEndpoint] Using concurrency limit: ${actualConcurrencyLimit} (config value * 3), prefilter: ${usePrefilter ? 'enabled' : 'disabled'}`);
              
              let processedCount = 0;
              let parsedCount = 0;
              let endpointCount = 0;
              let cachedCount = 0; // 记录使用缓存的文件数量
              let skippedCount = 0; // 记录通过预过滤跳过的文件
              
              // 减少批次大小，提高处理速度
              for (let i = 0; i < allJavaFiles.length; i += actualConcurrencyLimit) {
                // 检查是否取消
                if (cancellationToken?.isCancellationRequested) {
                  console.log("[GoToEndpoint] Index build cancelled by user.");
                  return;
                }
                
                // 获取当前批次的文件
                const batch = allJavaFiles.slice(i, i + actualConcurrencyLimit);
                // 减少日志输出，只在每10个批次时输出一次日志
                if ((i / actualConcurrencyLimit) % 10 === 0) {
                  console.log(`[GoToEndpoint] Processing batch ${i / actualConcurrencyLimit + 1}/${Math.ceil(allJavaFiles.length / actualConcurrencyLimit)} with ${batch.length} files`);
                }
                
                // 并行处理当前批次
                const batchPromises = batch.map(async fileUri => {
                  // 首先检查文件是否包含端点
                  const needsParsing = await this.shouldParseFile(fileUri.fsPath);
                  if (!needsParsing) {
                    // 使用缓存，不需要解析
                    cachedCount++;
                    processedCount++;
                    
                    // 获取缓存中的端点数量
                    const cacheEntry = this.cache?.fileData[fileUri.fsPath];
                    const cachedEndpointCount = cacheEntry?.endpoints.length || 0;
                    endpointCount += cachedEndpointCount;
                    
                    // 减少进度更新频率，每处理100个文件或最后一个文件更新一次进度
                    if (processedCount % 100 === 0 || processedCount === totalFiles) {
                      const progressPercentage = (processedCount / totalFiles) * 90;
                      progress.report({ 
                        message: `Processed ${processedCount}/${totalFiles} files (${cachedCount} cached, ${skippedCount} skipped), found ${endpointCount} endpoints...`, 
                        increment: progressPercentage - (processedCount - 1) / totalFiles * 90 
                      });
                    }
                    
                    return cachedEndpointCount;
                  }
                  
                  // 文件需要解析
                  return this.parseAndIndexFile(fileUri.fsPath).then(count => {
                    parsedCount++;
                    endpointCount += count;
                    processedCount++;
                    
                    // 检查此文件是否被跳过解析（预过滤）
                    if (count === -1) {
                      skippedCount++;
                      return 0;
                    }
                    
                    // 减少进度更新频率，每处理100个文件或最后一个文件更新一次进度
                    if (processedCount % 100 === 0 || processedCount === totalFiles) {
                      const progressPercentage = (processedCount / totalFiles) * 90;
                      progress.report({ 
                        message: `Processed ${processedCount}/${totalFiles} files (${cachedCount} cached, ${skippedCount} skipped), found ${endpointCount} endpoints...`, 
                        increment: progressPercentage - (processedCount - 1) / totalFiles * 90 
                      });
                    }
                    
                    return count;
                  });
                });
                
                // 等待当前批次全部完成
                await Promise.all(batchPromises);
              }
              
              // 计算总端点数
              let totalEndpoints = 0;
              for (const endpointsInFile of this.index.values()) {
                totalEndpoints += endpointsInFile.length;
              }

              console.log(`[GoToEndpoint] Index build complete. Found ${totalEndpoints} endpoints in ${this.index.size} files.`
                + ` Used cache for ${cachedCount} files. Skipped ${skippedCount} files without endpoint annotations.`);
              
              // 触发索引更新事件
              this._onIndexUpdated.fire(totalEndpoints);
              
              // 如果无法匹配端点，显示警告
              if (totalEndpoints === 0 && totalFiles > 0) {
                console.warn("[GoToEndpoint] No endpoints found in any Java files. Check if files contain Spring Controller or Feign Client annotations.");
                vscode.window.showWarningMessage("GoToEndpoint: No endpoints found in Java files. Ensure project contains Spring Controller or Feign Client annotations.");
              }
            } catch (error) {
              console.error('[GoToEndpoint] Error during index build execution:', error);
              vscode.window.showErrorMessage('GoToEndpoint: Failed to build endpoint index. See console for details.');
            }
          }
        );
    } catch (error) {
        console.error('[GoToEndpoint] Error setting up index build progress:', error);
        vscode.window.showErrorMessage('GoToEndpoint: Failed to start index build process.');
    } finally {
        this.isBuilding = false;
        console.log("[GoToEndpoint] Index build process finished.");
        
        // 索引完成后保存缓存
        await this.saveCache();
    }
  }

  /**
   * Parses a single file and updates the index.
   * @param filePath Absolute path of the file to parse.
   * @returns Number of endpoints found in the file, or -1 if file was skipped (not parsed)
   */
  private async parseAndIndexFile(filePath: string): Promise<number> {
    // console.log(`[GoToEndpoint] parseAndIndexFile called with path: ${filePath}`);
    
    // 检查文件是否需要重新解析
    const needsParsing = await this.shouldParseFile(filePath);
    if (!needsParsing) {
      // 文件没有变化，使用缓存数据
      // console.log(`[GoToEndpoint] Using cached data for file: ${filePath}`);
      const cacheEntry = this.cache?.fileData[filePath];
      return cacheEntry?.endpoints.length || 0;
    }
    
    let endpoints: EndpointInfo[] = []; // Declare here to access in finally
    try {
      // Check if file still exists before reading
      await fs.access(filePath);
      
      // 首先检查文件是否可能包含端点
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // 进行预检查，看文件是否包含API端点相关注解
      if (!this.fileContainsEndpointAnnotations(fileContent)) {
        // 文件不包含任何API端点注解，跳过解析
        // console.log(`[GoToEndpoint] File does not contain endpoint annotations, skipping: ${filePath}`);
      
        // 更新缓存信息
        if (this.cache && this.cacheEnabled) {
          const stats = await fs.stat(filePath);
          this.cache.fileData[filePath] = {
            lastModified: stats.mtimeMs,
            endpoints: []
          };
        }
        
        // 从索引中移除此文件
        if (this.index.has(filePath)) {
          this.index.delete(filePath);
          // console.log(`[GoToEndpoint] Removed ${filePath} from index due to no endpoint annotations`);
        }
        
        return -1; // 表示文件被跳过
      }
      
      // 文件可能包含端点，进行解析
      // console.log(`[GoToEndpoint] Parsing file: ${filePath}`);
      
      endpoints = await this.parser.parseJavaFile(filePath, fileContent);
      // console.log(`[GoToEndpoint] Found ${endpoints.length} endpoints in file: ${filePath}`);
      
      // 更新缓存
      if (this.cache && this.cacheEnabled) {
        const stats = await fs.stat(filePath);
        this.cache.fileData[filePath] = {
          lastModified: stats.mtimeMs,
          endpoints: endpoints
        };
      }
      
      // 调试时输出找到的端点详情
      if (endpoints.length > 0) {
        // endpoints.forEach((endpoint, index) => {
        //  console.log(`[GoToEndpoint] Endpoint ${index+1}: ${endpoint.httpMethod} ${endpoint.fullPath} (${endpoint.className}.${endpoint.methodName})`);
        // });
        
        // 存储到索引，使用原始路径
        this.index.set(filePath, endpoints);
        // console.log(`[GoToEndpoint] Updated index with key: ${filePath}`);
      } else {
        // Remove from index if no endpoints found (or file became irrelevant)
        if (this.index.has(filePath)) {
        this.index.delete(filePath);
          // console.log(`[GoToEndpoint] Removed ${filePath} from index due to no endpoints found`);
        }
      }
      
      return endpoints.length;
    } catch (error) {
        // If file not found or other read error, ensure it's removed from index
        if (this.index.has(filePath)) {
            this.index.delete(filePath);
            // console.log(`[GoToEndpoint] Removed ${filePath} from index due to error or no endpoints.`);
        }
            
        // 从缓存中移除
        if (this.cache && this.cacheEnabled && filePath in this.cache.fileData) {
          delete this.cache.fileData[filePath];
        }
        
        // Don't log every file not found error if it's expected during deletion/rename
        if ((error as NodeJS.ErrnoException)?.code !== 'ENOENT') {
             console.error(`[GoToEndpoint] Failed to parse or index file ${filePath}:`, error);
        }
        return 0;
    }
  }
  
  /**
   * 检查文件内容是否包含端点相关的注解
   * @param fileContent 文件内容
   * @returns 是否包含注解
   */
  private fileContainsEndpointAnnotations(fileContent: string): boolean {
    // 根据配置决定是否使用预过滤
    const config = vscode.workspace.getConfiguration('gotoEndpoints');
    const usePrefilter = config.get<boolean>('usePrefilter', true);
    if (!usePrefilter) {
      return true; // 如果禁用预过滤，总是返回true
    }
    
    // 检查是否包含Controller、Mapping等注解
    const annotations = [
      '@Controller', 
      '@RestController', 
      '@RequestMapping', 
      '@GetMapping', 
      '@PostMapping', 
      '@PutMapping', 
      '@DeleteMapping', 
      '@PatchMapping',
      '@FeignClient'
    ];
    
    // 使用正则表达式或简单字符串搜索
    for (const annotation of annotations) {
      if (fileContent.includes(annotation)) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Updates the index for a changed or newly created file.
   * @param filePath Absolute path of the file.
   */
  async updateFile(filePath: string): Promise<void> {
    if (this.isBuilding) {
        console.log(`[GoToEndpoint] Index build in progress. Update for ${filePath} skipped, will be handled by build if needed.`);
        return;
    }
    console.log(`[GoToEndpoint] Updating index for changed file: ${filePath}`);
    await this.parseAndIndexFile(filePath);
    // 注：不需要在此处触发事件，因为parseAndIndexFile已经触发了
  }

  /**
   * Removes a file from the index.
   * @param filePath Absolute path of the file.
   */
  removeFile(filePath: string): void {
    if (this.isBuilding) {
        console.log(`[GoToEndpoint] Index build in progress, removal of ${filePath} deferred/skipped.`);
        return;
    }
    if (this.index.delete(filePath)) {
        console.log(`[GoToEndpoint] Removed ${filePath} from index.`);
        
        // 触发索引更新事件
        this._onIndexUpdated.fire(this.getTotalEndpointsCount());
    }
  }

  /**
   * Searches the index for endpoints matching the query.
   * @param query The search string (matches against full path or method name).
   * @returns An array of matching EndpointInfo objects.
   */
  search(query: string): EndpointInfo[] {
    if (this.isBuilding) {
        console.log('[GoToEndpoint] Search executed while index is still building');
        vscode.window.showWarningMessage("GoToEndpoint: Index is currently being built. Search results may be incomplete.");
    }

    console.log(`[GoToEndpoint] Search starting with query: "${query}"`);
    console.log(`[GoToEndpoint] Current index size: ${this.index.size} files`);
    
    // 统计所有端点数量，用于调试
    let totalEndpoints = 0;
    for (const endpoints of this.index.values()) {
      totalEndpoints += endpoints.length;
    }
    console.log(`[GoToEndpoint] Total indexed endpoints: ${totalEndpoints}`);

    const results: (EndpointInfo & { score: number })[] = [];
    if (!query || query.trim().length === 0) {
      console.log('[GoToEndpoint] Empty query, returning empty results');
      return results; // Return empty if query is empty
    }

    const lowerCaseQuery = query.toLowerCase();
    console.log(`[GoToEndpoint] Normalized query (lowercase): "${lowerCaseQuery}"`);

    let matchCount = 0;
    for (const endpoints of this.index.values()) {
      for (const endpoint of endpoints) {
        // 计算匹配分数，以实现更智能的排序
        let score = 0;
        const lowerMethodName = endpoint.methodName.toLowerCase();
        const lowerPath = endpoint.fullPath.toLowerCase();
        const lowerClassName = endpoint.className.toLowerCase();

        // 记录详细的匹配过程
        let matchDetails = [];

        // 完全匹配方法名给予最高分
        if (lowerMethodName === lowerCaseQuery) {
          score += 100;
          matchDetails.push(`Method name exact match (+100): ${endpoint.methodName}`);
        } 
        // 方法名开头匹配给予高分
        else if (lowerMethodName.startsWith(lowerCaseQuery)) {
          score += 80;
          matchDetails.push(`Method name starts with query (+80): ${endpoint.methodName}`);
        } 
        // 方法名包含匹配给予中等分数
        else if (lowerMethodName.includes(lowerCaseQuery)) {
          score += 60;
          matchDetails.push(`Method name contains query (+60): ${endpoint.methodName}`);
        }

        // 路径完全匹配
        if (lowerPath === lowerCaseQuery) {
          score += 90;
          matchDetails.push(`Path exact match (+90): ${endpoint.fullPath}`);
        }
        // 路径开头匹配
        else if (lowerPath.startsWith(lowerCaseQuery)) {
          score += 70;
          matchDetails.push(`Path starts with query (+70): ${endpoint.fullPath}`);
        }
        // 路径包含匹配
        else if (lowerPath.includes(lowerCaseQuery)) {
          score += 50;
          matchDetails.push(`Path contains query (+50): ${endpoint.fullPath}`);
        }

        // 类名包含匹配
        if (lowerClassName.includes(lowerCaseQuery)) {
          score += 40;
          matchDetails.push(`Class name contains query (+40): ${endpoint.className}`);
        }

        // 只添加有分数的结果（即至少有一处匹配）
        if (score > 0) {
          matchCount++;
          if (matchCount <= 5) { // 限制日志数量，避免日志过多
            console.log(`[GoToEndpoint] Match found: ${endpoint.fullPath} (${endpoint.httpMethod}) - Score: ${score}`);
            console.log(`[GoToEndpoint] Match details: ${matchDetails.join(', ')}`);
          } else if (matchCount === 6) {
            console.log('[GoToEndpoint] More matches found, suppressing detailed logs...');
          }
          
          results.push({
            ...endpoint,
            score // 添加分数字段用于排序
          });
        }
      }
    }

    console.log(`[GoToEndpoint] Search complete. Found ${results.length} matches out of ${totalEndpoints} total endpoints`);

    // 按分数对结果进行排序（从高到低）
    const sortedResults = results.sort((a, b) => b.score - a.score);
      
    // 对搜索结果进行去重处理
    const dedupedResults = this.deduplicateSearchResults(sortedResults);
    console.log(`[GoToEndpoint] After deduplication: ${dedupedResults.length} results (removed ${sortedResults.length - dedupedResults.length} duplicates)`);
    
    // 移除临时添加的分数字段
    const finalResults = dedupedResults.map(({ score, ...endpoint }) => endpoint as EndpointInfo);
    
    console.log(`[GoToEndpoint] Results sorted by relevance score and deduplicated`);
    
    return finalResults;
  }

  /**
   * 对搜索结果进行去重处理
   * 主要去除相同类中同路径且HTTP方法相同的重复端点
   * @param results 原始搜索结果
   * @returns 去重后的结果
   */
  private deduplicateSearchResults(results: (EndpointInfo & { score: number })[]): (EndpointInfo & { score: number })[] {
    // 使用Map来存储唯一端点，键为"类名:路径:HTTP方法"的组合
    const uniqueEndpoints = new Map<string, EndpointInfo & { score: number }>();
    
    for (const endpoint of results) {
      // 创建唯一键
      const key = `${endpoint.className}:${endpoint.fullPath}:${endpoint.httpMethod}`;
      
      // 如果这个键已存在，只保留分数更高的那个
      if (uniqueEndpoints.has(key)) {
        const existing = uniqueEndpoints.get(key)!;
        if (endpoint.score > existing.score) {
          uniqueEndpoints.set(key, endpoint);
        }
      } else {
        uniqueEndpoints.set(key, endpoint);
      }
    }
    
    return Array.from(uniqueEndpoints.values());
  }

   /**
   * 获取指定文件的端点信息
   * @param filePath 文件路径
   * @returns 文件中的端点信息数组
   */
  getEndpointsForFile(filePath: string): EndpointInfo[] | undefined {
    // 使用调用计数器来减少重复日志
    if (!this._endpointRequestCount) {
      this._endpointRequestCount = new Map<string, number>();
    }
    
    // 增加请求计数
    const count = (this._endpointRequestCount.get(filePath) || 0) + 1;
    this._endpointRequestCount.set(filePath, count);
    
    // 只在第一次请求或每10次请求输出一次日志
    if (count === 1 || count % 10 === 0) {
      console.log(`[GoToEndpoint] getEndpointsForFile called with path: ${filePath}`);
    }
    
    // 如果无法获得特定文件的端点，返回undefined
    if (!this.index.has(filePath)) {
      return undefined;
    }
    
    const endpoints = this.index.get(filePath);
    
    // 只在第一次请求或每10次请求输出一次结果日志
    if (endpoints && (count === 1 || count % 10 === 0)) {
      console.log(`[GoToEndpoint] Found ${endpoints.length} endpoints with original path`);
    }
    
    return endpoints;
  }

  /**
   * 获取当前索引中的总端点数
   * @returns 总端点数
   */
  getTotalEndpointsCount(): number {
    let totalEndpoints = 0;
    for (const endpointsInFile of this.index.values()) {
      totalEndpoints += endpointsInFile.length;
    }
    return totalEndpoints;
  }

  /**
   * 设置文件监听器
   */
  private setupWatcher() {
    // Implementation of setupWatcher method
  }

  /**
   * 重建索引
   */
  private rebuildIndex() {
    console.log('[GoToEndpoint] 在初始化阶段调用rebuildIndex...');
    // 调用完整的buildIndex方法，确保初始化和重新扫描行为一致
    this.buildIndex().then(() => {
      console.log('[GoToEndpoint] 初始化阶段索引构建完成');
    }).catch(error => {
      console.error('[GoToEndpoint] 初始化阶段索引构建失败:', error);
    });
  }

  /**
   * 获取所有已索引的端点
   * @returns 端点信息数组
   */
  public getAllEndpoints(): EndpointInfo[] {
    // 收集所有索引中的端点
    const allEndpoints: EndpointInfo[] = [];
    for (const endpointsInFile of this.index.values()) {
      allEndpoints.push(...endpointsInFile);
    }
    return allEndpoints;
  }

  /**
   * 清除缓存并重建索引
   * 当需要强制刷新时使用
   */
  public clearCacheAndRebuild(): void {
    console.log('[GoToEndpoint] 清除缓存并重建索引...');
    
    // 清空索引和缓存
    this.index.clear();
    this.initializeEmptyCache();
    
    // 删除缓存文件
    try {
      const fs = require('fs');
      const cachePath = this.getCachePath();
      if (fs.existsSync(cachePath)) {
        fs.unlinkSync(cachePath);
        console.log('[GoToEndpoint] 缓存文件已删除');
      }
    } catch (error) {
      console.error('[GoToEndpoint] 删除缓存文件时出错:', error);
    }
    
    // 重新构建索引
    this.buildIndex().then(() => {
      console.log('[GoToEndpoint] 索引重建完成');
      vscode.window.showInformationMessage('GoToEndpoint: 缓存已清除，索引重建完成');
    });
  }

  /**
   * 获取已索引的端点数量
   * @returns 端点数量
   */
  public getEndpointCount(): number {
    // 直接使用已有的getTotalEndpointsCount方法
    return this.getTotalEndpointsCount();
  }

  /**
   * 添加索引更新监听器
   * @param listener 索引更新时调用的回调函数
   */
  public addIndexUpdateListener(listener: EndpointIndexListener): void {
    this.indexListeners.push(listener);
  }
} 
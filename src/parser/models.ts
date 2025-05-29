/**
 * 端点信息
 */
export interface EndpointInfo {
  fullPath: string;             // 完整路径（经过处理的规范化路径）
  rawPath?: string;             // 原始路径（直接从注解中提取的未经处理的路径）
  originalMethodPath?: string;  // 方法注解中提取的原始路径
  originalClassPath?: string;   // 类注解中提取的原始路径
  httpMethod: string;           // HTTP方法，如GET, POST, PUT, DELETE
  method: string;               // 同httpMethod，为兼容旧版本
  className: string;            // 类名
  methodName: string;           // 方法名
  filePath: string;             // 文件路径
  startLine: number;            // 起始行号
  startColumn: number;          // 起始列号
  line: number;                 // 行号 (同startLine，为兼容旧版本)
  column: number;               // 列号 (同startColumn，为兼容旧版本)
  endLine: number;              // 结束行号
  endColumn: number;            // 结束列号
  score?: number;               // 搜索结果匹配分数 (可选)
} 
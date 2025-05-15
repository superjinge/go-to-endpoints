// Dynamic imports for ESM modules
// import { parse, BaseJavaCstVisitorWithDefaults, NormalClassDeclarationCtx, NormalInterfaceDeclarationCtx, AnnotationCtx, ClassBodyDeclarationCstNode, InterfaceMemberDeclarationCstNode, ElementValuePairCstNode, MethodDeclarationCtx } from "java-parser";
// import { IToken } from 'chevrotain';

import { EndpointInfo } from './models';
import { joinPaths } from '../utils/pathUtils';

// Variables to hold the imported modules
let javaParserModule: any = null;
let parse: any = null;
let BaseJavaCstVisitorWithDefaults: any = null;
let EndpointVisitor: any = null;

// Function to load modules using CommonJS require instead of dynamic import
function loadModules(): boolean {
    console.log("[AST Parser] Loading java-parser and chevrotain modules...");
    
    try {
        // Try to load java-parser using require (CommonJS) instead of dynamic import
    if (!javaParserModule) {
            javaParserModule = require("java-parser");
            parse = javaParserModule.parse;
            BaseJavaCstVisitorWithDefaults = javaParserModule.BaseJavaCstVisitorWithDefaults;

            if (!parse || !BaseJavaCstVisitorWithDefaults) {
                console.error("[AST Parser] Failed to extract necessary functions from java-parser");
                return false;
            }
            
            console.log("[AST Parser] java-parser loaded successfully via require()");
        }
        
        // Define the visitor class immediately after loading the base class
        defineVisitorClass();
        
        return true;
        } catch (e) {
        console.error("[AST Parser] Failed to load dependencies:", e);
        return false;
    }
}

function isToken(node: any): boolean {
    return node && typeof node === 'object' && typeof node.image === 'string' && node.startOffset !== undefined;
}

function CstNodeToString(node: any | any[] | undefined): string {
    if (!node) return "";
    if (Array.isArray(node)) {
        return node.filter(isToken).map(t => t.image).join("");
    }
    if (isToken(node)) {
        return node.image;
    }
    return "";
}

// Simplified: returns only string | null
function extractStringLiteral(ctx: any): string | null {
    if (!ctx) return null;

    // Attempt 1: Direct StringLiteral child of the passed context
    let stringLiteralNode = ctx.StringLiteral?.[0];
    if (isToken(stringLiteralNode)) {
        const literal = CstNodeToString(stringLiteralNode);
        return literal.substring(1, literal.length - 1);
    }

    // Attempt 2: Through an expression node (common case for annotation values)
    const expression = ctx.expression?.[0]; 
    if (expression) {
        stringLiteralNode = expression.children?.literal?.[0]?.children?.StringLiteral?.[0];
        if (isToken(stringLiteralNode)) {
            const literal = CstNodeToString(stringLiteralNode);
            return literal.substring(1, literal.length - 1);
        }
    }

    // Attempt 3: Maybe ctx *is* the expression node passed from the caller
     stringLiteralNode = ctx.children?.literal?.[0]?.children?.StringLiteral?.[0];
     if (isToken(stringLiteralNode)) {
        const literal = CstNodeToString(stringLiteralNode);
        return literal.substring(1, literal.length - 1);
    }

    // If none of the above worked
    return null;
}

// Define the visitor class
function defineVisitorClass() {
    if (!BaseJavaCstVisitorWithDefaults) {
        console.error("[AST Parser] Cannot define EndpointVisitor: BaseJavaCstVisitorWithDefaults is not defined");
        return;
    }
    
    if (EndpointVisitor) {
        // Already defined
        return;
    }
    
    console.log("[AST Parser] Defining EndpointVisitor class...");
    
    try {
        EndpointVisitor = class extends BaseJavaCstVisitorWithDefaults {
            endpoints: EndpointInfo[] = [];
            currentClassName: string = "";
            currentFilePath: string = "";
            classLevelPaths: string[] = [''];
            isController: boolean = false;
            isFeignClient: boolean = false;

            constructor(filePath: string) {
                super();
                this.currentFilePath = filePath;
                this.validateVisitor();
            }

            // --- CST Visit Methods --- 
            normalClassDeclaration(ctx: any, _param?: any) {
                try {
                // Guess: identifier is under children
                    const identifierToken = ctx.children?.typeIdentifier?.[0]?.children?.Identifier?.[0]; 
                this.currentClassName = identifierToken ? CstNodeToString(identifierToken) : "UnknownClass";
                    
                    console.log(`[AST Parser] Processing class: ${this.currentClassName}`);
                    
                this.isController = false;
                this.classLevelPaths = [''];
                    
                // Guess: annotations are under children
                    if (ctx.children && ctx.children.annotation) {
                        const annotations = ctx.children.annotation;
                        console.log(`[AST Parser] Found ${annotations.length} annotations on class ${this.currentClassName}`);
                        
                if (annotations) {
                            annotations.forEach((anno: any, index: number) => {
                                console.log(`[AST Parser] Processing class annotation ${index+1}`);
                                this.visit(anno);
                            });
                        }
                    } else {
                        console.log(`[AST Parser] No annotations found on class ${this.currentClassName}`);
                }
                    
                if (this.isController) {
                    console.log(`[AST Parser] Found Controller: ${this.currentClassName}`);
                    if(ctx.children?.classBody?.[0]?.children?.classBodyDeclaration) {
                            const declarations = ctx.children.classBody[0].children.classBodyDeclaration;
                            console.log(`[AST Parser] Processing ${declarations.length} class body declarations`);
                            declarations.forEach((decl: any, index: number) => {
                                console.log(`[AST Parser] Processing class body declaration ${index+1}`);
                                this.visit(decl);
                            });
                    }
                    } else {
                        console.log(`[AST Parser] Class ${this.currentClassName} is not a controller`);
                    }
                } catch (error) {
                    console.error(`[AST Parser] Error processing class declaration:`, error);
                }
            }

            normalInterfaceDeclaration(ctx: any, _param?: any) {
                try {
                    const identifierToken = ctx.children?.typeIdentifier?.[0]?.children?.Identifier?.[0];
                 this.currentClassName = identifierToken ? CstNodeToString(identifierToken) : "UnknownInterface";
                 this.isFeignClient = false;
                 this.classLevelPaths = [''];
                    
                    console.log(`[AST Parser] Processing interface: ${this.currentClassName}`);
                    
                    if (ctx.children && ctx.children.annotation) {
                        const annotations = ctx.children.annotation;
                        console.log(`[AST Parser] Found ${annotations.length} annotations on interface ${this.currentClassName}`);
                        
                 if (annotations) {
                            annotations.forEach((anno: any, index: number) => {
                                console.log(`[AST Parser] Processing interface annotation ${index+1}`);
                                this.visit(anno);
                            });
                        }
                    } else {
                        console.log(`[AST Parser] No annotations found on interface ${this.currentClassName}`);
                 }
                    
                 if (this.isFeignClient) {
                     console.log(`[AST Parser] Found FeignClient: ${this.currentClassName}`);
                     if(ctx.children?.interfaceBody?.[0]?.children?.interfaceMemberDeclaration) {
                            const declarations = ctx.children.interfaceBody[0].children.interfaceMemberDeclaration;
                            console.log(`[AST Parser] Processing ${declarations.length} interface member declarations`);
                            declarations.forEach((decl: any, index: number) => {
                                console.log(`[AST Parser] Processing interface member declaration ${index+1}`);
                                this.visit(decl);
                            });
                     }
                    }
                } catch (error) {
                    console.error(`[AST Parser] Error processing interface declaration:`, error);
                 }
            }

            annotation(ctx: any, _param?: any) {
                try {
                    console.log(`[AST Parser] Processing annotation`);
                    
                    // Variant 1: Try the original path
                    let annotationName = "";
                    const identifierToken = ctx.children?.annotationName?.[0]?.children?.Identifier?.[0]; 
                    if (identifierToken) {
                        annotationName = CstNodeToString(identifierToken);
                        console.log(`[AST Parser] Found annotation name: ${annotationName}`);
                    } else {
                        console.log(`[AST Parser] Could not find annotation name using primary path`);
                    }
                
                    // Variant 2: Try alternative paths if the first approach failed
                    if (!annotationName && ctx.children) {
                        // Recursive function to search for Identifier nodes
                        const findIdentifier = (node: any): string | null => {
                            if (!node) return null;
                            
                            // Check if this is an Identifier node
                            if (node.image && node.tokenType && node.tokenType.name === 'Identifier') {
                                return node.image;
                            }
                            
                            // Check children
                            if (node.children) {
                                for (const key in node.children) {
                                    const child = node.children[key];
                                    if (Array.isArray(child)) {
                                        for (const item of child) {
                                            const result = findIdentifier(item);
                                            if (result) return result;
                                        }
                                } else {
                                        const result = findIdentifier(child);
                                        if (result) return result;
                                }
                                }
                            }
                            
                            return null;
                        };
                        
                        annotationName = findIdentifier(ctx) || "";
                        if (annotationName) {
                            console.log(`[AST Parser] Found annotation name using alternative approach: ${annotationName}`);
                        }
                    }
                    
                    if (!annotationName) {
                        console.log(`[AST Parser] Failed to extract annotation name`);
                        return;
                    }

                    // Case-insensitive comparison for better matching
                    const lowerName = annotationName.toLowerCase();
                    
                    if (lowerName === 'controller' || lowerName === 'restcontroller') { 
                        console.log(`[AST Parser] Found Controller annotation`);
                        this.isController = true; 
                    }

                    if (lowerName === 'feignclient') {
                        console.log(`[AST Parser] Found FeignClient annotation`);
                        this.isFeignClient = true;
                    }
                    
                    if ((lowerName === 'requestmapping') && (this.isController || this.isFeignClient)) {
                        console.log(`[AST Parser] Found RequestMapping annotation`);
                     let extractedPath: string | null = null;
                        
                        // Try to extract path directly
                        if (ctx.children?.elementValue?.[0]) {
                            console.log(`[AST Parser] Trying to extract path from elementValue`);
                            extractedPath = extractStringLiteral(ctx.children.elementValue[0]);
                            if (extractedPath) {
                                console.log(`[AST Parser] Extracted path from elementValue: ${extractedPath}`);
                            }
                        }
                        
                        // Try to extract path from elementValuePairList
                        if (!extractedPath && ctx.children?.elementValuePairList?.[0]?.children?.elementValuePair) {
                            console.log(`[AST Parser] Trying to extract path from elementValuePairList`);
                         const pairs = ctx.children.elementValuePairList[0].children.elementValuePair;
                            
                            for (const pair of pairs) {
                             const keyToken = pair.children?.Identifier?.[0];
                             const key = keyToken ? CstNodeToString(keyToken) : "";
                                console.log(`[AST Parser] Found key in elementValuePair: ${key}`);
                                
                                if (key && (key === 'value' || key === 'path') && pair.children?.elementValue?.[0]) {
                                    extractedPath = extractStringLiteral(pair.children.elementValue[0]);
                                    if (extractedPath) {
                                        console.log(`[AST Parser] Extracted path from ${key}: ${extractedPath}`);
                                        break;
                                    }
                                }
                            }
                        }
                        
                        // Set class level paths if found
                     if (extractedPath !== null) {
                         this.classLevelPaths = [extractedPath];
                         console.log(`[AST Parser] Found RequestMapping class path(s): ${this.classLevelPaths.join(', ')}`);
                        } else {
                            console.log(`[AST Parser] Failed to extract RequestMapping path`);
                        }
                     }
                } catch (error) {
                    console.error(`[AST Parser] Error processing annotation:`, error);
                }
            }

            methodDeclaration(ctx: any, _param?: any) {
                try {
                    console.log(`[AST Parser] Processing method declaration`);
                    
                    const methodHeader = ctx.children?.methodHeader?.[0]?.children;
                    if (!methodHeader) {
                        console.log(`[AST Parser] Method has no header`);
                        return;
                    }
                    
                    // Get method name
                    let methodName = "unknownMethod";
                    
                    // Try multiple paths to find the method name
                    if (methodHeader.identifier?.[0]) {
                        methodName = CstNodeToString(methodHeader.identifier[0]);
                    } else if (methodHeader.methodDeclarator?.[0]?.children?.identifier?.[0]) {
                        methodName = CstNodeToString(methodHeader.methodDeclarator[0].children.identifier[0]);
                    }
                    
                    console.log(`[AST Parser] Found method: ${methodName}`);
                    
                    // Get method location (作为备用位置信息，当无法获取注解位置时使用)
                const methodHeaderLocation = ctx.children?.methodHeader?.[0]?.location;
                    if (!methodHeaderLocation) {
                        console.log(`[AST Parser] Method has no location information`);
                        return;
                    }
                    
                const methodStartLine = methodHeaderLocation.startLine ?? 1;
                const methodStartColumn = methodHeaderLocation.startColumn ?? 1;
                const methodEndLine = methodHeaderLocation.endLine ?? methodStartLine;
                const methodEndColumn = methodHeaderLocation.endColumn ?? 1;
                    
                let hasMappingAnnotation = false;
                let methodPaths: string[] = [''];
                let httpMethod: string = 'ANY';
                let annotationLocation: any = null; // 用于保存找到的注解位置信息
                    
                    // Process method annotations
                    if (ctx.children && ctx.children.annotation) {
                        const annotations = ctx.children.annotation;
                        console.log(`[AST Parser] Found ${annotations.length} annotations on method ${methodName}`);
                        
                        for (const anno of annotations) {
                            // Get annotation name
                            let annotationName = "";
                            const annotationIdentifier = anno.children?.annotationName?.[0]?.children?.Identifier?.[0];
                            
                            if (annotationIdentifier) {
                                annotationName = CstNodeToString(annotationIdentifier);
                            } else {
                                // Try to find annotation name using a recursive approach
                                const findAnnotationName = (node: any): string => {
                                    if (!node || typeof node !== 'object') return "";
                                    
                                    if (node.name === 'Identifier' && node.image) {
                                        return node.image;
                                    }
                                    
                                    if (node.children) {
                                        for (const key in node.children) {
                                            const children = node.children[key];
                                            if (Array.isArray(children)) {
                                                for (const child of children) {
                                                    const result = findAnnotationName(child);
                                                    if (result) return result;
                                                }
                                            } else {
                                                const result = findAnnotationName(children);
                                                if (result) return result;
                                            }
                                        }
                                    }
                                    
                                    return "";
                                };
                                
                                annotationName = findAnnotationName(anno);
                            }
                            
                            if (!annotationName) {
                                console.log(`[AST Parser] Failed to extract annotation name on method ${methodName}`);
                                continue;
                            }
                            
                            console.log(`[AST Parser] Found annotation on method ${methodName}: ${annotationName}`);
                            
                            // Process based on annotation type
                            let specificHttpMethod: string | null = null;
                        let extractedPath: string | null = null;
                            
                            // Use lowercase comparison for better matching
                            const lowerName = annotationName.toLowerCase();
                            
                            switch (lowerName) {
                                case 'getmapping': specificHttpMethod = 'GET'; break;
                                case 'postmapping': specificHttpMethod = 'POST'; break;
                                case 'putmapping': specificHttpMethod = 'PUT'; break;
                                case 'deletemapping': specificHttpMethod = 'DELETE'; break;
                                case 'patchmapping': specificHttpMethod = 'PATCH'; break;
                                case 'requestmapping': specificHttpMethod = 'ANY'; break;
                                default: 
                                    console.log(`[AST Parser] Not a mapping annotation: ${annotationName}`);
                                    continue;
                        }
                            
                        hasMappingAnnotation = true;
                        httpMethod = specificHttpMethod;
                        
                        // 保存找到的RequestMapping注解的位置信息
                        if (anno.location) {
                            annotationLocation = anno.location;
                            console.log(`[AST Parser] Found annotation location: line ${annotationLocation.startLine}`);
                        }
                            
                            console.log(`[AST Parser] Found HTTP method: ${httpMethod}`);
                            
                            // Try to extract path from annotation
                            // Check for value in elementValuePairList
                         if (anno.children?.elementValuePairList?.[0]?.children?.elementValuePair) {
                             const pairs = anno.children.elementValuePairList[0].children.elementValuePair;
                                
                                for (const pair of pairs) {
                                 const keyToken = pair.children?.Identifier?.[0];
                                 const key = keyToken ? CstNodeToString(keyToken) : "";
                                    
                                    if (key && (key === 'value' || key === 'path') && pair.children?.elementValue?.[0]) {
                                        extractedPath = extractStringLiteral(pair.children.elementValue[0]);
                                        if (extractedPath) {
                                            console.log(`[AST Parser] Extracted path from ${key}: ${extractedPath}`);
                                            break;
                                        }
                                    }
                                    
                                    if (key === 'method' && lowerName === 'requestmapping' && pair.children?.elementValue?.[0]) {
                                        // Try multiple ways to extract method value
                                        const methodValueToken = pair.children.elementValue[0].children?.expression?.[0]?.children?.primary?.[0]?.children?.fqnOrRefType?.[0]?.children?.fqnOrRefTypePartFirst?.[0]?.children?.Identifier?.[0];
                                        
                                        if (methodValueToken) {
                                            const methodValue = CstNodeToString(methodValueToken);
                                            if (methodValue) {
                                                httpMethod = methodValue;
                                                console.log(`[AST Parser] Found HTTP method from annotation: ${httpMethod}`);
                                            }
                                        }
                                        
                                        // 增强对RequestMethod.XXX形式的识别
                                        if (httpMethod === 'ANY') {
                                            // 尝试递归查找RequestMethod枚举中的方法名
                                            const findRequestMethodEnum = (node: any): string | null => {
                                                if (!node || typeof node !== 'object') return null;
                                                
                                                // 在表达式中查找形如RequestMethod.GET的标识符
                                                if (node.image && typeof node.image === 'string') {
                                                    // 直接检查常见的HTTP方法
                                                    const methodMap: {[key: string]: string} = {
                                                        'GET': 'GET',
                                                        'POST': 'POST',
                                                        'PUT': 'PUT',
                                                        'DELETE': 'DELETE',
                                                        'PATCH': 'PATCH',
                                                        'HEAD': 'HEAD',
                                                        'OPTIONS': 'OPTIONS'
                                                    };
                                                    
                                                    const upperImage = node.image.toUpperCase();
                                                    if (methodMap[upperImage]) {
                                                        return methodMap[upperImage];
                                                    }
                                                }
                                                
                                                // 递归检查子节点
                                                if (node.children) {
                                                    for (const key in node.children) {
                                                        const children = node.children[key];
                                                        if (Array.isArray(children)) {
                                                            for (const child of children) {
                                                                const result = findRequestMethodEnum(child);
                                                                if (result) return result;
                                                            }
                                                        } else {
                                                            const result = findRequestMethodEnum(children);
                                                            if (result) return result;
                                                        }
                                                    }
                                                }
                                                
                                                return null;
                                            };
                                            
                                            const foundMethod = findRequestMethodEnum(pair.children.elementValue[0]);
                                            if (foundMethod) {
                                                httpMethod = foundMethod;
                                                console.log(`[AST Parser] Found HTTP method from RequestMethod enum: ${httpMethod}`);
                                            }
                                        }
                                    }
                                }
                            }
                            
                            // Check for direct value in elementValue
                            if (!extractedPath && anno.children?.elementValue?.[0]) {
                                extractedPath = extractStringLiteral(anno.children.elementValue[0]);
                                if (extractedPath) {
                                    console.log(`[AST Parser] Extracted path from direct elementValue: ${extractedPath}`);
                                }
                            }
                            
                            if (extractedPath !== null) {
                                methodPaths = [extractedPath];
                                console.log(`[AST Parser] Found method path(s): ${methodPaths.join(', ')}`);
                            }
                        }
                    } else {
                        console.log(`[AST Parser] No annotations found on method ${methodName}`);
                }
                    
                    // Create endpoint if it has mapping annotation
                 if (hasMappingAnnotation) {
                    const finalClassPaths = this.classLevelPaths.length > 0 ? this.classLevelPaths : [''];
                    const finalMethodPaths = methodPaths.length > 0 ? methodPaths : [''];
                        
                    for (const classPath of finalClassPaths) {
                        for (const methodPath of finalMethodPaths) {
                            const fullPath = joinPaths(classPath, methodPath);
                            
                            // 确定使用的位置信息 - 优先使用注解位置，如果没有则使用方法位置
                            const startLine = annotationLocation?.startLine ?? methodStartLine;
                            const startColumn = annotationLocation?.startColumn ?? methodStartColumn;
                            const endLine = annotationLocation?.endLine ?? methodEndLine;
                            const endColumn = annotationLocation?.endColumn ?? methodEndColumn;
                            
                            // 保存原始路径数据
                            const rawPath = methodPath ? (classPath ? `${classPath}${methodPath.startsWith('/') ? '' : '/'}${methodPath}` : methodPath) : classPath;
                            
                            // Create endpoint
                            const endpoint: EndpointInfo = {
                                fullPath,
                                originalClassPath: classPath, 
                                originalMethodPath: methodPath,
                                rawPath,
                                httpMethod,
                                method: httpMethod,
                                className: this.currentClassName, 
                                methodName, 
                                filePath: this.currentFilePath, 
                                startLine: startLine,
                                startColumn: startColumn,
                                line: startLine,
                                column: startColumn,
                                endLine, 
                                endColumn 
                            };
                                
                            this.endpoints.push(endpoint);
                                console.log(`[AST Parser] Created endpoint: ${JSON.stringify(endpoint)}`);
                            }
                        }
                    } else {
                        console.log(`[AST Parser] Method ${methodName} has no mapping annotations`);
                    }
                } catch (error) {
                    console.error(`[AST Parser] Error processing method declaration:`, error);
                }
            }
            
            // Add additional visit methods as needed for other constructs
        };
        
        console.log("[AST Parser] EndpointVisitor class defined successfully");
    } catch (error) {
        console.error("[AST Parser] Error defining EndpointVisitor class:", error);
        EndpointVisitor = null;
    }
}

// Fallback parser using regular expressions
function parseJavaFileWithRegex(filePath: string, fileContent: string): EndpointInfo[] {
    console.log(`[AST Parser] Using regex fallback parser for file: ${filePath}`);
    const endpoints: EndpointInfo[] = [];
    
    try {
        // First try to extract class info
        const className = extractClassName(fileContent);
        let classPath = '';
        
        // Extract class level RequestMapping
        const classRequestMappingRegex = /@RequestMapping\s*(?:\(\s*(?:value\s*=)?\s*)?["]([^"]*)["]|@RequestMapping\s*(?:\(\s*(?:value\s*=)?\s*)?[']([^']*)[']|@RequestMapping\s*\(\s*path\s*=\s*["]([^"]*)["]|@RequestMapping\s*\(\s*path\s*=\s*[']([^']*)[']|@RequestMapping\([^)]*\)/g;
        
        // Check if class has @Controller or @RestController
        const isControllerClass = /@Controller|@RestController/i.test(fileContent);
        
        if (isControllerClass) {
            console.log(`[Regex Parser] Found Controller class: ${className}`);
            
            // 1. 先获取类声明的位置
            const classDeclarationRegex = /\bclass\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+(?:\w+(?:,\s*\w+)*))?/;
            const classMatch = classDeclarationRegex.exec(fileContent);
            const classPosition = classMatch ? classMatch.index : 0;
            
            // 2. 识别类级别的RequestMapping注解位置，避免后续重复处理
            let classRequestMappingPosition = -1;
            // Extract class level path
            let match;
            while ((match = classRequestMappingRegex.exec(fileContent)) !== null) {
                // 确保这个注解在类声明之前 - 即它是类级别的注解
                if (match.index < classPosition) {
                    classRequestMappingPosition = match.index;
                    // Get the first non-undefined group
                    classPath = match[1] || match[2] || match[3] || match[4] || '';
                    console.log(`[Regex Parser] Found class level path: ${classPath} at position ${classRequestMappingPosition}`);
                    break;
                }
            }
            
            // Find method level request mappings
            // 修改正则表达式，捕获整个注解包括类型和参数
            const methodRegex = /@((?:Get|Post|Put|Delete|Patch)Mapping|RequestMapping)(\s*\([^)]*\)|\s*)/g;
            const methodNameRegex = /\s*(public|private|protected)?\s*(?:<[^>]*>)?\s*\w+\s+(\w+)\s*\(/g;
            
            let methodMatch;
            let lastIndex = 0;
            
            while ((methodMatch = methodRegex.exec(fileContent)) !== null) {
                const annotationPosition = methodMatch.index;
                
                // 3. 跳过类级别的RequestMapping注解 - 关键修复
                if (annotationPosition === classRequestMappingPosition) {
                    console.log(`[Regex Parser] Skipping class level RequestMapping annotation at position ${annotationPosition}`);
                    continue;
                }
                
                const annotationType = methodMatch[1] || '';  // Get, Post, RequestMapping等
                const annotationParams = methodMatch[2] || ''; // 参数部分，包括括号
                
                console.log(`[Regex Parser] Found annotation: ${annotationType} with params: ${annotationParams}`);
                
                // 确定HTTP方法 - 根据注解类型初步判断
                let httpMethod = 'ANY';
                if (annotationType !== 'RequestMapping') {
                    // 对GetMapping, PostMapping等直接确定HTTP方法
                    httpMethod = annotationType.replace('Mapping', '').toUpperCase();
                    console.log(`[Regex Parser] HTTP method determined from annotation type: ${httpMethod}`);
                }
                
                // 提取路径和其他参数
                let methodPath = '';
                
                // 处理不同形式的路径
                if (annotationParams) {
                    // 1. 处理带参数的情况如 @RequestMapping(value="/path", method=RequestMethod.GET)
                    if (annotationParams.includes('(') && annotationParams.includes(')')) {
                        // 提取完整参数内容，移除括号
                        const paramsContent = annotationParams.substring(
                            annotationParams.indexOf('(') + 1, 
                            annotationParams.lastIndexOf(')')
                        ).trim();
                        
                        console.log(`[Regex Parser] Annotation params content: ${paramsContent}`);
                        
                        // 处理参数内容
                        if (paramsContent) {
                            // 2. 查找value或path参数 - 形式: value="/path" 或 path="/path"
                            const valuePathRegex = /(?:value|path)\s*=\s*["']([^"']*)["']/i;
                            const valueMatch = valuePathRegex.exec(paramsContent);
                            if (valueMatch && valueMatch[1]) {
                                methodPath = valueMatch[1];
                                console.log(`[Regex Parser] Path extracted from value/path param: ${methodPath}`);
                            } 
                            // 3. 查找直接字符串 - 形式: "/path"
                            else if (/^["'][^"']*["']$/.test(paramsContent.trim())) {
                                methodPath = paramsContent.trim().replace(/^["']|["']$/g, '');
                                console.log(`[Regex Parser] Path extracted from direct string: ${methodPath}`);
                            }
                            // 4. 查找直接字符串(带引号但有额外空格) - 形式: "  /path  "
                            else if (/^\s*["'][^"']*["']\s*$/.test(paramsContent)) {
                                methodPath = paramsContent.trim().replace(/^["']|["']$/g, '');
                                console.log(`[Regex Parser] Path extracted from quoted string with spaces: ${methodPath}`);
                            }
                            // 5. 查找method参数 - 对RequestMapping处理方法参数
                            if (httpMethod === 'ANY' && annotationType === 'RequestMapping' && 
                                paramsContent.includes('method')) {
                                
                                // 匹配形如 method=RequestMethod.GET 或 method = RequestMethod.GET 的模式
                                const methodParamRegex = /method\s*=\s*(?:RequestMethod\.)?([A-Z_]+)/i;
                                const methodParamMatch = methodParamRegex.exec(paramsContent);
                                
                                if (methodParamMatch && methodParamMatch[1]) {
                                    const extractedMethod = methodParamMatch[1].toUpperCase();
                                    // 验证提取的方法是否有效
                                    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(extractedMethod)) {
                                        httpMethod = extractedMethod;
                                        console.log(`[Regex Parser] HTTP method extracted from method param: ${httpMethod}`);
                                    }
                                }
                            }
                        }
                    }
                    // 6. 处理无参数带引号的直接形式 - @RequestMapping("/path")，但被上面正则捕获为整体
                    else if (annotationParams.includes('"') || annotationParams.includes("'")) {
                        // 尝试提取引号中的内容作为路径
                        const directPathRegex = /["']([^"']*)["']/;
                        const directMatch = directPathRegex.exec(annotationParams);
                        if (directMatch && directMatch[1]) {
                            methodPath = directMatch[1];
                            console.log(`[Regex Parser] Path extracted from direct annotation: ${methodPath}`);
                        }
                    }
                }
                
                // Find method name (search forward from annotation position)
                methodNameRegex.lastIndex = annotationPosition;
                const methodNameMatch = methodNameRegex.exec(fileContent);
                
                if (methodNameMatch) {
                    const methodName = methodNameMatch[2];
                    console.log(`[Regex Parser] Found method: ${methodName}, path: ${methodPath}, HTTP method: ${httpMethod}`);
                    
                    // Construct full path
                    const fullPath = joinPaths(classPath, methodPath);
                    
                    // 保存原始路径数据
                    const rawPath = methodPath ? (classPath ? `${classPath}${methodPath.startsWith('/') ? '' : '/'}${methodPath}` : methodPath) : classPath;
                    
                    // 使用注解的位置，转换为行号
                    const contentBeforeAnnotation = fileContent.substring(0, annotationPosition);
                    const annotationLine = (contentBeforeAnnotation.match(/\n/g) || []).length + 1;
                    
                    // Create endpoint
                    const endpoint: EndpointInfo = {
                        fullPath,
                        originalClassPath: classPath, 
                        originalMethodPath: methodPath,
                        rawPath,
                        httpMethod,
                        method: httpMethod,
                        className,
                        methodName,
                        filePath,
                        startLine: annotationLine,
                        startColumn: 1,
                        line: annotationLine,
                        column: 1,
                        endLine: annotationLine + 1,
                        endColumn: 1
                    };
                    
                    endpoints.push(endpoint);
                    console.log(`[Regex Parser] Created endpoint: ${httpMethod} ${fullPath} (${className}.${methodName})`);
                }
                
                // Update last position to avoid repeats
                lastIndex = methodMatch.index + methodMatch[0].length;
                methodRegex.lastIndex = lastIndex;
            }
        } else {
            console.log(`[Regex Parser] Class is not a Controller: ${className}`);
        }
    } catch (error) {
        console.error(`[Regex Parser] Error parsing file with regex:`, error);
    }
    
    return endpoints;
}

// Helper function to extract class name
function extractClassName(fileContent: string): string {
    const classDeclarationRegex = /\bclass\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+(?:\w+(?:,\s*\w+)*))?/;
    const match = fileContent.match(classDeclarationRegex);
    return match ? match[1] : "UnknownClass";
}

export class AstJavaParser {
  // 预先加载模块
  constructor() {
    console.log("[AST Parser] Initializing AstJavaParser");
    // 尝试提前加载模块以避免首次解析延迟
    loadModules();
  }
  
  /**
   * 使用Java解析器解析Java文件
   * @param filePath 文件路径
   * @param fileContent 文件内容
   * @returns 解析出的端点信息
   */
  async parseJavaFile(filePath: string, fileContent: string): Promise<EndpointInfo[]> {
    console.log(`[GoToEndpoint] Parsing Java file: ${filePath}`);
    
    // 快速预检查，如果文件内容不包含任何相关注解，直接跳过AST解析以提高性能
    if (!this.hasRelevantAnnotations(fileContent)) {
      console.log(`[GoToEndpoint] File ${filePath} does not contain any relevant annotations, skipping.`);
      return [];
    }
    
    // 首先尝试使用正则表达式解析，这通常更快
    // 如果失败才使用AST解析，由于AST解析对很大的文件可能会很慢
    try {
      const regexEndpoints = parseJavaFileWithRegex(filePath, fileContent);
      if (regexEndpoints.length > 0) {
        console.log(`[GoToEndpoint] Successfully parsed ${regexEndpoints.length} endpoints using regex parser from ${filePath}`);
        return regexEndpoints;
      }
      
      // 正则表达式没有找到端点，尝试使用AST解析
      console.log(`[GoToEndpoint] No endpoints found with regex parser, trying AST parser for ${filePath}`);
      const astEndpoints = await this.parseJavaFileWithAst(filePath, fileContent);
      console.log(`[GoToEndpoint] AST parser found ${astEndpoints.length} endpoints from ${filePath}`);
      return astEndpoints;
    } catch (error) {
      console.error(`[GoToEndpoint] Error parsing Java file ${filePath}:`, error);
      // 出错时仍然尝试AST解析作为备选
      try {
        const astEndpoints = await this.parseJavaFileWithAst(filePath, fileContent);
        console.log(`[GoToEndpoint] Fallback AST parser found ${astEndpoints.length} endpoints from ${filePath}`);
        return astEndpoints;
      } catch (astError) {
        console.error(`[GoToEndpoint] AST parser also failed for ${filePath}:`, astError);
        return [];
      }
    }
  }
  
  /**
   * 使用AST解析器解析Java文件
   * @param filePath 文件路径
   * @param fileContent 文件内容
   * @returns 解析出的端点信息
   */
  private async parseJavaFileWithAst(filePath: string, fileContent: string): Promise<EndpointInfo[]> {
    console.log(`[GoToEndpoint AST Parser] Parsing file: ${filePath}`);
    
    try {
      // 确保模块已加载
      if (!loadModules()) {
        console.error("[AST Parser] Failed to load required modules, failing");
        return [];
      }
      
      // 再次检查关键依赖
      if (!parse || !EndpointVisitor) {
        console.error("[AST Parser] Required components not available");
        if (!parse) console.error("[AST Parser] parse function is not defined");
        if (!EndpointVisitor) console.error("[AST Parser] EndpointVisitor class is not defined");
        return [];
      }

      // 进行解析
      console.log(`[AST Parser] Starting to parse file content (size: ${fileContent.length})`);
      
      let cst;
      try {
        cst = parse(fileContent);
        console.log(`[AST Parser] CST parsing successful`);
      } catch (parseError) {
        console.error(`[AST Parser] Error during CST parsing:`, parseError);
        return [];
      }
      
      // 创建访问者并处理AST
      console.log(`[AST Parser] Creating visitor...`);
      const visitor = new EndpointVisitor(filePath);
      
      console.log(`[AST Parser] Starting traversal...`);
      visitor.visit(cst);
      
      const endpointCount = visitor.endpoints.length;
      console.log(`[GoToEndpoint AST Parser] Found ${endpointCount} endpoints in ${filePath}`);
      
      return visitor.endpoints;
    } catch (error: any) {
      // 详细记录错误信息
      console.error(`[GoToEndpoint AST Parser] Error parsing file ${filePath}:`, error);
      console.error(`[GoToEndpoint AST Parser] Error name: ${error.name}, message: ${error.message}`);
      if (error.stack) {
        console.error(`[GoToEndpoint AST Parser] Stack trace: ${error.stack}`);
      }
      
      // 根据错误类型记录更多信息
      if (error.name === 'NotAllInputParsedException' || error.name === 'MismatchedTokenException' || error.name === 'NoViableAltException' || error.name === 'EarlyExitException') {
           console.error(`[GoToEndpoint AST Parser] Chevrotain Parsing Error in ${filePath}: ${error.message}`);
           if (error.token && isToken(error.token)) {
               console.error(`Error occurred near token: "${error.token.image}" at Line: ${error.token.startLine}, Col: ${error.token.startColumn}`);
           }
           if(error.context?.ruleStack) {
                console.error(`Parser Rule Stack: ${error.context.ruleStack.join(' -> ')}`);
           }
      }
      
      throw error; // 重新抛出错误，由调用方处理
    }
  }
  
  /**
   * 快速检查文件是否包含相关注解
   * @param fileContent 文件内容
   * @returns 是否包含相关注解
   */
  private hasRelevantAnnotations(fileContent: string): boolean {
    // 定义要检查的关键注解
    const relevantAnnotations = [
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
    
    // 使用简单的字符串搜索而不是正则表达式以提高性能
    for (const annotation of relevantAnnotations) {
      if (fileContent.includes(annotation)) {
        return true;
      }
    }
    
    return false;
  }
} 
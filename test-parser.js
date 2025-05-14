const fs = require('fs');
const javaParser = require('java-parser');
const path = require('path');

// 读取HelloController.java文件
const filePath = path.join(__dirname, 'java', 'HelloController.java');
console.log(`Reading file: ${filePath}`);
const fileContent = fs.readFileSync(filePath, 'utf-8');
console.log(`File content length: ${fileContent.length} bytes`);

// 尝试解析Java文件
try {
    console.log('Parsing Java file...');
    const cst = javaParser.parse(fileContent);
    console.log('Java file parsed successfully!');
    
    // 获取注解
    const annotations = [];
    
    // 简单递归遍历查找所有Identifier节点
    function findIdentifiers(node, path = []) {
        if (!node || typeof node !== 'object') return;
        
        if (node.name === 'Identifier') {
            console.log(`Found Identifier at ${path.join('.')} = "${node.image}"`);
            
            // 检查是否是注解标识符
            if (path.includes('annotationName')) {
                annotations.push(node.image);
            }
        }
        
        if (node.children) {
            for (const key in node.children) {
                const child = node.children[key];
                if (Array.isArray(child)) {
                    child.forEach((item, index) => {
                        findIdentifiers(item, [...path, key, index]);
                    });
                } else {
                    findIdentifiers(child, [...path, key]);
                }
            }
        }
    }
    
    // 递归查找注解
    function findAnnotations(node, path = []) {
        if (!node || typeof node !== 'object') return;
        
        if (node.name === 'annotation') {
            console.log(`Found annotation at ${path.join('.')}`);
            // 提取注解名称
            if (node.children && node.children.annotationName && 
                node.children.annotationName[0] && 
                node.children.annotationName[0].children && 
                node.children.annotationName[0].children.Identifier) {
                
                const annotationName = node.children.annotationName[0].children.Identifier[0].image;
                console.log(`\tAnnotation name: ${annotationName}`);
                annotations.push(annotationName);
                
                // 如果是RequestMapping，尝试提取路径
                if (annotationName === 'RequestMapping') {
                    // 尝试提取RequestMapping的值
                    extractRequestMappingPath(node);
                }
            }
        }
        
        if (node.children) {
            for (const key in node.children) {
                const child = node.children[key];
                if (Array.isArray(child)) {
                    child.forEach((item, index) => {
                        findAnnotations(item, [...path, key, index]);
                    });
                } else {
                    findAnnotations(child, [...path, key]);
                }
            }
        }
    }
    
    // 提取RequestMapping的路径值
    function extractRequestMappingPath(annotationNode) {
        if (!annotationNode.children) return;
        
        // 直接值，如 @RequestMapping("/path")
        if (annotationNode.children.elementValue && 
            annotationNode.children.elementValue[0] && 
            annotationNode.children.elementValue[0].children && 
            annotationNode.children.elementValue[0].children.expression) {
            
            const expr = annotationNode.children.elementValue[0].children.expression[0];
            if (expr.children && expr.children.primary && 
                expr.children.primary[0] && 
                expr.children.primary[0].children && 
                expr.children.primary[0].children.literal && 
                expr.children.primary[0].children.literal[0] && 
                expr.children.primary[0].children.literal[0].children && 
                expr.children.primary[0].children.literal[0].children.StringLiteral) {
                
                const literalNode = expr.children.primary[0].children.literal[0].children.StringLiteral[0];
                const pathValue = literalNode.image;
                console.log(`\tRequestMapping path: ${pathValue}`);
            }
        }
        
        // 键值对，如 @RequestMapping(value = "/path")
        if (annotationNode.children.elementValuePairList && 
            annotationNode.children.elementValuePairList[0] && 
            annotationNode.children.elementValuePairList[0].children && 
            annotationNode.children.elementValuePairList[0].children.elementValuePair) {
            
            const pairs = annotationNode.children.elementValuePairList[0].children.elementValuePair;
            pairs.forEach(pair => {
                if (pair.children && pair.children.Identifier && 
                    pair.children.Identifier[0] && 
                    pair.children.elementValue && 
                    pair.children.elementValue[0]) {
                    
                    const key = pair.children.Identifier[0].image;
                    if (key === 'value' || key === 'path') {
                        const valueNode = pair.children.elementValue[0];
                        if (valueNode.children && valueNode.children.expression && 
                            valueNode.children.expression[0] && 
                            valueNode.children.expression[0].children && 
                            valueNode.children.expression[0].children.primary && 
                            valueNode.children.expression[0].children.primary[0] && 
                            valueNode.children.expression[0].children.primary[0].children && 
                            valueNode.children.expression[0].children.primary[0].children.literal && 
                            valueNode.children.expression[0].children.primary[0].children.literal[0] && 
                            valueNode.children.expression[0].children.primary[0].children.literal[0].children && 
                            valueNode.children.expression[0].children.primary[0].children.literal[0].children.StringLiteral) {
                            
                            const literalNode = valueNode.children.expression[0].children.primary[0].children.literal[0].children.StringLiteral[0];
                            const pathValue = literalNode.image;
                            console.log(`\tRequestMapping ${key}: ${pathValue}`);
                        }
                    }
                }
            });
        }
    }
    
    // 查找顶层类声明
    function findClassDeclaration(cst) {
        if (!cst || !cst.children || !cst.children.ordinaryCompilationUnit || 
            !cst.children.ordinaryCompilationUnit[0] || 
            !cst.children.ordinaryCompilationUnit[0].children || 
            !cst.children.ordinaryCompilationUnit[0].children.typeDeclaration) {
            return null;
        }
        
        const typeDeclarations = cst.children.ordinaryCompilationUnit[0].children.typeDeclaration;
        for (const typeDecl of typeDeclarations) {
            if (typeDecl.children && typeDecl.children.classDeclaration && 
                typeDecl.children.classDeclaration[0] && 
                typeDecl.children.classDeclaration[0].children && 
                typeDecl.children.classDeclaration[0].children.normalClassDeclaration) {
                
                const classDecl = typeDecl.children.classDeclaration[0].children.normalClassDeclaration[0];
                if (classDecl.children && classDecl.children.typeIdentifier && 
                    classDecl.children.typeIdentifier[0] && 
                    classDecl.children.typeIdentifier[0].children && 
                    classDecl.children.typeIdentifier[0].children.Identifier) {
                    
                    const className = classDecl.children.typeIdentifier[0].children.Identifier[0].image;
                    console.log(`Found class: ${className}`);
                    
                    // 检查类注解
                    if (classDecl.children.annotation) {
                        const classAnnotations = classDecl.children.annotation;
                        console.log(`Found ${classAnnotations.length} annotations on class ${className}`);
                        
                        classAnnotations.forEach(annotation => {
                            findAnnotations(annotation);
                        });
                    }
                    
                    // 查找类方法
                    if (classDecl.children.classBody && 
                        classDecl.children.classBody[0] && 
                        classDecl.children.classBody[0].children && 
                        classDecl.children.classBody[0].children.classBodyDeclaration) {
                        
                        const bodyDeclarations = classDecl.children.classBody[0].children.classBodyDeclaration;
                        bodyDeclarations.forEach(bodyDecl => {
                            if (bodyDecl.children && bodyDecl.children.classMemberDeclaration && 
                                bodyDecl.children.classMemberDeclaration[0] && 
                                bodyDecl.children.classMemberDeclaration[0].children && 
                                bodyDecl.children.classMemberDeclaration[0].children.methodDeclaration) {
                                
                                const methodDecl = bodyDecl.children.classMemberDeclaration[0].children.methodDeclaration[0];
                                
                                // 获取方法名
                                if (methodDecl.children && methodDecl.children.methodHeader && 
                                    methodDecl.children.methodHeader[0] && 
                                    methodDecl.children.methodHeader[0].children && 
                                    methodDecl.children.methodHeader[0].children.methodDeclarator && 
                                    methodDecl.children.methodHeader[0].children.methodDeclarator[0] && 
                                    methodDecl.children.methodHeader[0].children.methodDeclarator[0].children && 
                                    methodDecl.children.methodHeader[0].children.methodDeclarator[0].children.identifier) {
                                    
                                    const methodName = methodDecl.children.methodHeader[0].children.methodDeclarator[0].children.identifier[0].image;
                                    console.log(`Found method: ${methodName}`);
                                    
                                    // 检查方法注解
                                    if (methodDecl.children.annotation) {
                                        console.log(`Found ${methodDecl.children.annotation.length} annotations on method ${methodName}`);
                                        methodDecl.children.annotation.forEach(annotation => {
                                            findAnnotations(annotation);
                                        });
                                    }
                                }
                            }
                        });
                    }
                    
                    return classDecl;
                }
            }
        }
        
        return null;
    }
    
    // 执行解析
    //findIdentifiers(cst);
    //findAnnotations(cst);
    findClassDeclaration(cst);
    
    console.log('\nFound annotations:', annotations);
    
} catch (error) {
    console.error('Error parsing Java file:', error);
} 
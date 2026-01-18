// 文件处理工具函数

/**
 * 读取文件为文本字符串
 * @param file - File 对象
 * @returns Promise<string>
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      resolve(text);
    };
    
    reader.onerror = (e) => {
      reject(new Error('文件读取失败'));
    };
    
    reader.readAsText(file, 'UTF-8');
  });
}

/**
 * 统计文本字数（中文字符 + 英文单词）
 * @param text - 文本内容
 * @returns 字数
 */
export function countWords(text: string): number {
  // 移除空白字符
  const trimmed = text.trim();
  if (!trimmed) return 0;
  
  // 统计中文字符
  const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g) || [];
  
  // 统计英文单词（连续的字母、数字、下划线）
  const englishWords = trimmed.match(/[a-zA-Z0-9_]+/g) || [];
  
  return chineseChars.length + englishWords.length;
}

/**
 * 验证文件类型
 * @param file - File 对象
 * @param allowedTypes - 允许的 MIME 类型或扩展名数组
 * @returns 是否合法
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  
  return allowedTypes.some(type => {
    if (type.startsWith('.')) {
      // 扩展名匹配
      return fileName.endsWith(type);
    } else {
      // MIME 类型匹配
      return fileType === type || fileType.startsWith(type + '/');
    }
  });
}

/**
 * 格式化文件大小
 * @param bytes - 字节数
 * @returns 格式化后的字符串（如 "1.5 MB"）
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * 验证文件大小
 * @param file - File 对象
 * @param maxSizeInMB - 最大文件大小（MB）
 * @returns 是否合法
 */
export function validateFileSize(file: File, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
}




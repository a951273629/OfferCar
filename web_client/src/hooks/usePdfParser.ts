import { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// 配置 PDF.js Worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

// 常量定义
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CONTENT_LENGTH = 10000; // 10000 字符

type FileType = 'pdf' | 'txt' | null;

interface UsePdfParserReturn {
  fileName: string | null;
  fileContent: string | null;
  parsing: boolean;
  progress: number;
  error: string | null;
  parseFile: (file: File) => Promise<void>;
  clearFile: () => void;
}

/**
 * 浏览器端文件解析 Hook
 * 支持 PDF 和 TXT 文件的文本提取
 */
export function usePdfParser(): UsePdfParserReturn {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // 验证文件大小
  const validateFileSize = useCallback((file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      setError('文件大小不能超过 10MB');
      return false;
    }
    return true;
  }, []);

  // 识别文件类型
  const getFileType = useCallback((file: File): FileType => {
    const fileName = file.name.toLowerCase();
    
    if (fileName.endsWith('.pdf')) {
      return 'pdf';
    }
    
    if (fileName.endsWith('.txt')) {
      return 'txt';
    }
    
    setError('不支持的文件格式，只支持 .pdf 和 .txt');
    return null;
  }, []);

  // 限制内容长度
  const limitContentLength = useCallback((content: string): string => {
    if (content.length <= MAX_CONTENT_LENGTH) {
      return content;
    }
    
    console.warn(`[PDF Parser] 内容过长 (${content.length} 字符)，截断至 ${MAX_CONTENT_LENGTH}`);
    return content.substring(0, MAX_CONTENT_LENGTH) + '\n\n[内容已截断...]';
  }, []);

  // 解析 PDF 文件
  const parsePdfFile = useCallback(async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();

    let pdf;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      pdf = await loadingTask.promise;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '加载 PDF 失败';
      throw new Error(errorMessage);
    }

    const totalPages = pdf.numPages;
    let extractedText = '';

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => ('str' in item ? item.str : ''))
        .join(' ');

      extractedText += pageText + '\n';

      const currentProgress = Math.round((pageNum / totalPages) * 100);
      setProgress(currentProgress);
    }

    return extractedText.trim();
  }, []);

  // 解析 TXT 文件
  const parseTxtFile = useCallback(async (file: File): Promise<string> => {
    try {
      const text = await file.text();
      return text.trim();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '读取 TXT 失败';
      throw new Error(errorMessage);
    }
  }, []);

  // 根据文件类型解析
  const parseByType = useCallback(async (file: File, type: FileType): Promise<string> => {
    if (type === 'pdf') {
      return await parsePdfFile(file);
    }
    
    if (type === 'txt') {
      return await parseTxtFile(file);
    }
    
    return '';
  }, [parsePdfFile, parseTxtFile]);

  // 统一的文件解析入口
  const parseFile = useCallback(async (file: File): Promise<void> => {
    // Guard Clause: 重置状态
    setParsing(true);
    setProgress(0);
    setError(null);
    setFileName(null);
    setFileContent(null);

    // Guard Clause: 验证文件大小
    if (!validateFileSize(file)) {
      setParsing(false);
      return;
    }

    // Guard Clause: 识别文件类型
    const fileType = getFileType(file);
    if (!fileType) {
      setParsing(false);
      return;
    }

    // 解析文件内容
    let content = '';
    try {
      content = await parseByType(file, fileType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '文件解析失败';
      setError(errorMessage);
      setParsing(false);
      setProgress(0);
      return;
    }

    // Guard Clause: 验证内容是否为空
    if (!content || content.length === 0) {
      setError('无法从文件中提取文本内容');
      setParsing(false);
      setProgress(0);
      return;
    }

    // 限制内容长度
    const limitedContent = limitContentLength(content);

    // 保存结果
    setFileName(file.name);
    setFileContent(limitedContent);
    setParsing(false);
    setProgress(100);

    console.log(`[PDF Parser] 解析成功: ${file.name}, 字符数: ${limitedContent.length}`);
  }, [validateFileSize, getFileType, parseByType, limitContentLength]);

  // 清除所有状态
  const clearFile = useCallback(() => {
    setFileName(null);
    setFileContent(null);
    setParsing(false);
    setProgress(0);
    setError(null);
  }, []);

  return {
    fileName,
    fileContent,
    parsing,
    progress,
    error,
    parseFile,
    clearFile,
  };
}


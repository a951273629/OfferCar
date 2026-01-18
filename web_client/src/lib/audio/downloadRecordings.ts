/**
 * IndexedDB 录音下载工具
 * 提供便捷的 API 来管理和下载 WAV 录音文件
 */

import { listRecordings, getRecording, deleteRecording as deleteRecordingFromDB, clearAllRecordings as clearAllRecordingsFromDB } from './indexedDB';
import type { AudioRecording } from './indexedDB';

/**
 * 触发浏览器下载文件
 * @param blob Blob 数据
 * @param fileName 文件名
 */
function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();

  // 清理 DOM 和 Blob URL
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * 列出所有录音
 * @returns 录音列表
 */
export async function listAllRecordings(): Promise<AudioRecording[]> {
  try {
    const recordings = await listRecordings();

    console.log(`[下载工具] 找到 ${recordings.length} 个录音文件`);
    console.table(recordings.map(r => ({
      文件名: r.fileName,
      角色: r.role === 'interviewee' ? '面试者' : '面试官',
      大小: `${(r.size / 1024).toFixed(2)} KB`,
      时间: new Date(r.timestamp).toLocaleString()
    })));

    return recordings;
  } catch (error) {
    console.error('[下载工具] 列出录音失败:', error);
    throw error;
  }
}

/**
 * 下载单个录音
 * @param fileName 文件名
 */
export async function downloadRecording(fileName: string): Promise<void> {
  try {
    console.log(`[下载工具] 开始下载: ${fileName}`);

    const recording = await getRecording(fileName);

    if (!recording) {
      console.error(`[下载工具] 未找到录音: ${fileName}`);
      throw new Error(`未找到录音: ${fileName}`);
    }

    triggerDownload(recording.blob, fileName);
    console.log(`[下载工具] ✅ 下载完成: ${fileName}`);
  } catch (error) {
    console.error(`[下载工具] 下载失败: ${fileName}`, error);
    throw error;
  }
}

/**
 * 下载所有录音
 */
export async function downloadAllRecordings(): Promise<void> {
  try {
    const recordings = await listRecordings();

    if (recordings.length === 0) {
      console.log('[下载工具] 没有可下载的录音');
      return;
    }

    console.log(`[下载工具] 开始批量下载 ${recordings.length} 个录音...`);

    for (let i = 0; i < recordings.length; i++) {
      const recording = recordings[i];
      console.log(`[下载工具] 下载进度: ${i + 1}/${recordings.length} - ${recording.fileName}`);
      
      triggerDownload(recording.blob, recording.fileName);

      // 添加延迟避免浏览器阻止多个下载
      if (i < recordings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[下载工具] ✅ 全部下载完成！共 ${recordings.length} 个文件`);
  } catch (error) {
    console.error('[下载工具] 批量下载失败:', error);
    throw error;
  }
}

/**
 * 按角色下载录音
 * @param role 角色（interviewee 或 interviewer）
 */
export async function downloadRecordingsByRole(role: 'interviewee' | 'interviewer'): Promise<void> {
  try {
    const allRecordings = await listRecordings();
    const recordings = allRecordings.filter(r => r.role === role);

    if (recordings.length === 0) {
      console.log(`[下载工具] 没有找到 ${role === 'interviewee' ? '面试者' : '面试官'} 的录音`);
      return;
    }

    const roleName = role === 'interviewee' ? '面试者' : '面试官';
    console.log(`[下载工具] 开始下载 ${roleName} 的 ${recordings.length} 个录音...`);

    for (let i = 0; i < recordings.length; i++) {
      const recording = recordings[i];
      console.log(`[下载工具] 下载进度: ${i + 1}/${recordings.length} - ${recording.fileName}`);
      
      triggerDownload(recording.blob, recording.fileName);

      // 添加延迟避免浏览器阻止多个下载
      if (i < recordings.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    console.log(`[下载工具] ✅ ${roleName} 录音下载完成！共 ${recordings.length} 个文件`);
  } catch (error) {
    console.error(`[下载工具] 按角色下载失败:`, error);
    throw error;
  }
}

/**
 * 删除单个录音
 * @param fileName 文件名
 */
export async function deleteRecording(fileName: string): Promise<void> {
  try {
    console.log(`[下载工具] 删除录音: ${fileName}`);
    await deleteRecordingFromDB(fileName);
    console.log(`[下载工具] ✅ 删除成功: ${fileName}`);
  } catch (error) {
    console.error(`[下载工具] 删除失败: ${fileName}`, error);
    throw error;
  }
}

/**
 * 清空所有录音
 * @param confirm 是否需要确认（默认 true）
 */
export async function clearAllRecordings(confirm: boolean = true): Promise<void> {
  try {
    if (confirm) {
      const recordings = await listRecordings();
      const confirmMsg = `确定要删除所有 ${recordings.length} 个录音吗？此操作不可恢复！`;
      
      if (!window.confirm(confirmMsg)) {
        console.log('[下载工具] 用户取消了清空操作');
        return;
      }
    }

    console.log('[下载工具] 开始清空所有录音...');
    await clearAllRecordingsFromDB();
    console.log('[下载工具] ✅ 已清空所有录音');
  } catch (error) {
    console.error('[下载工具] 清空录音失败:', error);
    throw error;
  }
}

/**
 * 导出所有功能（便于在浏览器控制台使用）
 */
export const AudioRecordingsManager = {
  list: listAllRecordings,
  download: downloadRecording,
  downloadAll: downloadAllRecordings,
  downloadByRole: downloadRecordingsByRole,
  delete: deleteRecording,
  clear: clearAllRecordings,
};

// 在开发模式下将管理器挂载到全局对象，方便控制台调用
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).AudioRecordings = AudioRecordingsManager;
  console.log('[下载工具] 已挂载到 window.AudioRecordings，可在控制台直接使用');
}


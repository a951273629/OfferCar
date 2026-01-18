/**
 * IndexedDB 音频存储工具
 * 用于在开发模式下保存测试音频数据
 */

const DB_NAME = 'AudioTestDB';
const DB_VERSION = 1;
const STORE_NAME = 'recordings';

/**
 * 初始化 IndexedDB 数据库
 */
function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('无法打开 IndexedDB'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建对象存储（如果不存在）
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'fileName' });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });
        objectStore.createIndex('role', 'role', { unique: false });
        console.log('[IndexedDB] 创建对象存储:', STORE_NAME);
      }
    };
  });
}

/**
 * 录音记录接口
 */
export interface AudioRecording {
  fileName: string;
  blob: Blob;
  timestamp: number;
  role: 'interviewee' | 'interviewer';
  size: number;
  duration?: number;
}

/**
 * 保存音频文件到 IndexedDB
 * @param fileName 文件名
 * @param blob 音频 Blob 数据
 * @param role 角色（interviewee 或 interviewer）
 */
export async function saveAudioToIndexedDB(
  fileName: string,
  blob: Blob,
  role: 'interviewee' | 'interviewer'
): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    const recording: AudioRecording = {
      fileName,
      blob,
      timestamp: Date.now(),
      role,
      size: blob.size,
    };

    const request = objectStore.put(recording);

    request.onsuccess = () => {
      console.log(`[IndexedDB] 保存成功: ${fileName}`);
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`保存失败: ${fileName}`));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 列出所有录音
 */
export async function listRecordings(): Promise<AudioRecording[]> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onsuccess = () => {
      resolve(request.result as AudioRecording[]);
    };

    request.onerror = () => {
      reject(new Error('获取录音列表失败'));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 删除指定录音
 * @param fileName 文件名
 */
export async function deleteRecording(fileName: string): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(fileName);

    request.onsuccess = () => {
      console.log(`[IndexedDB] 删除成功: ${fileName}`);
      resolve();
    };

    request.onerror = () => {
      reject(new Error(`删除失败: ${fileName}`));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 获取指定录音
 * @param fileName 文件名
 */
export async function getRecording(fileName: string): Promise<AudioRecording | null> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.get(fileName);

    request.onsuccess = () => {
      resolve(request.result as AudioRecording | null);
    };

    request.onerror = () => {
      reject(new Error(`获取录音失败: ${fileName}`));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * 清空所有录音
 */
export async function clearAllRecordings(): Promise<void> {
  const db = await initDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.clear();

    request.onsuccess = () => {
      console.log('[IndexedDB] 已清空所有录音');
      resolve();
    };

    request.onerror = () => {
      reject(new Error('清空录音失败'));
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
}


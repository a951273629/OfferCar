# 音频测试存储功能使用说明

## 功能概述

在开发模式下，系统会自动将 WebSocket 会话期间的音频流保存到浏览器 IndexedDB，用于测试音频传输完整性。

## 自动触发

- **触发条件**: `NODE_ENV === 'development'`
- **保存时机**: 调用 `stopRecognition()` 时自动保存（通常在用户停止会话时）
- **存储位置**: 浏览器 IndexedDB（数据库名：`AudioTestDB`）
- **文件格式**: WAV（无损 PCM 格式）
- **文件命名**: `{role}_{timestamp}.wav`
  - `role`: `interviewee` 或 `interviewer`
  - `timestamp`: Unix 时间戳（毫秒）

## 查看和下载保存的音频

### 方法 1: 使用工具函数（推荐）

项目已提供便捷的工具函数来管理录音，在浏览器控制台中直接使用：

```javascript
// 全局对象已自动挂载（开发模式）
// 可直接使用 window.AudioRecordings

// 1. 列出所有录音
await AudioRecordings.list();

// 2. 下载单个录音
await AudioRecordings.download('interviewer_1764580574934.wav');

// 3. 下载所有录音
await AudioRecordings.downloadAll();

// 4. 仅下载面试官的录音
await AudioRecordings.downloadByRole('interviewer');

// 5. 仅下载面试者的录音
await AudioRecordings.downloadByRole('interviewee');

// 6. 删除单个录音
await AudioRecordings.delete('interviewer_1764580574934.wav');

// 7. 清空所有录音（会弹出确认）
await AudioRecordings.clear();
```

### 方法 2: 在组件中使用

```typescript
import { 
  listAllRecordings, 
  downloadRecording, 
  downloadAllRecordings,
  downloadRecordingsByRole 
} from '@/lib/audio/downloadRecordings';

function MyComponent() {
  const handleDownload = async () => {
    // 列出所有录音
    const recordings = await listAllRecordings();
    
    // 下载第一个录音
    if (recordings.length > 0) {
      await downloadRecording(recordings[0].fileName);
    }
  };
  
  return <button onClick={handleDownload}>下载录音</button>;
}
```

### 方法 3: 通过浏览器开发者工具

1. 打开浏览器开发者工具（F12）
2. 切换到 **Application** 标签页
3. 左侧导航栏找到 **IndexedDB** → **AudioTestDB** → **recordings**
4. 查看已保存的录音列表
5. 右键点击某条记录，选择查看详情
6. 可以看到 `blob` 字段，右键保存为文件

### 方法 4: 通过手动控制台脚本

在浏览器控制台执行以下脚本：

```javascript
// 列出所有录音
async function listAudioRecordings() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('AudioTestDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = db.transaction(['recordings'], 'readonly');
  const store = transaction.objectStore('recordings');
  const recordings = await new Promise((resolve) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
  });

  console.table(recordings.map(r => ({
    fileName: r.fileName,
    role: r.role,
    size: `${(r.size / 1024).toFixed(2)} KB`,
    timestamp: new Date(r.timestamp).toLocaleString()
  })));

  db.close();
  return recordings;
}

// 下载指定录音
async function downloadAudioRecording(fileName) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('AudioTestDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = db.transaction(['recordings'], 'readonly');
  const store = transaction.objectStore('recordings');
  const recording = await new Promise((resolve) => {
    const request = store.get(fileName);
    request.onsuccess = () => resolve(request.result);
  });

  if (recording) {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log(`已下载: ${fileName}`);
  } else {
    console.error(`未找到录音: ${fileName}`);
  }

  db.close();
}

// 使用示例
await listAudioRecordings();
// 复制上面列表中的 fileName，然后下载
// await downloadAudioRecording('interviewee_1733043024567.wav');
```

## 控制台日志说明

### 启动识别时

```
[Tencent Speech] ✅ 双流识别已全部启动
[Audio Test] 🎙️ 开发模式：将保存音频到 IndexedDB
```

### 停止识别时（stopRecognition 调用）

```
[Tencent Speech] 手动停止识别
[Audio Test] 准备保存音频到 IndexedDB...
[Audio Test] 开始保存 interviewee 音频...
[Audio Test] PCM 数据总长度: 192000 样本, 时长: 12.00秒
[PCM to WAV] 开始转换，样本数: 192000, 时长: 12.00秒
[PCM to WAV] 转换完成，WAV 大小: 375.04 KB
[IndexedDB] 保存成功: interviewee_1733043024567.wav
[Audio Test] ✅ 已保存 interviewee 音频: interviewee_1733043024567.wav
  - 大小: 375.04 KB
  - 时长: 12.00秒
[Audio Test] 开始保存 interviewer 音频...
[Audio Test] PCM 数据总长度: 160000 样本, 时长: 10.00秒
[PCM to WAV] 开始转换，样本数: 160000, 时长: 10.00秒
[PCM to WAV] 转换完成，WAV 大小: 312.54 KB
[IndexedDB] 保存成功: interviewer_1733043024789.wav
[Audio Test] ✅ 已保存 interviewer 音频: interviewer_1733043024789.wav
  - 大小: 312.54 KB
  - 时长: 10.00秒
[Audio Test] 已清空全局音频缓冲区
```

## 数据结构

### AudioRecording 接口

```typescript
interface AudioRecording {
  fileName: string;        // 文件名（主键）
  blob: Blob;             // MP3 音频数据
  timestamp: number;      // 保存时间戳
  role: 'interviewee' | 'interviewer'; // 角色
  size: number;           // 文件大小（字节）
  duration?: number;      // 时长（可选）
}
```

## 技术细节

### 音频参数

- **采样率**: 16kHz
- **声道**: 单声道
- **原始格式**: PCM Int16
- **编码格式**: WAV (无损 PCM)
- **位深度**: 16-bit

### 实现逻辑

1. **数据采集**: 在 `startSendTimer` 中，每 40ms 将发送的 PCM 数据复制到全局缓冲区
2. **数据合并**: `stopRecognition` 调用时，合并所有 PCM 片段
3. **格式转换**: 添加 WAV 文件头，将 PCM 转换为 WAV 格式
4. **持久化存储**: 将 WAV Blob 保存到 IndexedDB
5. **清理缓冲**: 保存完成后清空全局缓冲区

### 文件说明

- `src/lib/audio/indexedDB.ts` - IndexedDB 操作工具
- `src/lib/audio/pcmToWav.ts` - PCM 到 WAV 转换工具
- `src/lib/audio/downloadRecordings.ts` - 录音下载和管理工具
- `src/hooks/useTencentAudioRecognition.ts` - 集成音频保存逻辑

## 注意事项

1. **仅在开发模式启用** - 生产环境不会保存音频
2. **存储空间** - WAV 文件较大（16kHz 单声道约 1.92MB/分钟），IndexedDB 通常有约 50MB 的限制，请定期清理
3. **隐私安全** - 音频仅保存在本地浏览器，不会上传到服务器
4. **性能影响** - WAV 转换非常快速（仅添加文件头），在 `stopRecognition` 调用时执行，不影响实时识别性能

## 工具函数 API 参考

### listAllRecordings()

列出所有录音，返回录音列表并在控制台显示表格。

```typescript
const recordings = await listAllRecordings();
// 返回: AudioRecording[]
```

### downloadRecording(fileName: string)

下载指定的录音文件。

```typescript
await downloadRecording('interviewer_1764580574934.wav');
```

### downloadAllRecordings()

批量下载所有录音（每个文件间隔 300ms，避免浏览器阻止）。

```typescript
await downloadAllRecordings();
```

### downloadRecordingsByRole(role)

仅下载指定角色的录音。

```typescript
// 下载所有面试官的录音
await downloadRecordingsByRole('interviewer');

// 下载所有面试者的录音
await downloadRecordingsByRole('interviewee');
```

### deleteRecording(fileName: string)

删除指定的录音文件。

```typescript
await deleteRecording('interviewer_1764580574934.wav');
```

### clearAllRecordings(confirm?: boolean)

清空所有录音（默认会弹出确认框）。

```typescript
// 弹出确认框
await clearAllRecordings();

// 跳过确认框
await clearAllRecordings(false);
```

## 清理数据

### 通过控制台清空所有录音

```javascript
async function clearAllAudioRecordings() {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('AudioTestDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  const transaction = db.transaction(['recordings'], 'readwrite');
  const store = transaction.objectStore('recordings');
  await new Promise((resolve) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
  });

  console.log('已清空所有录音');
  db.close();
}

await clearAllAudioRecordings();
```

### 删除整个数据库

```javascript
indexedDB.deleteDatabase('AudioTestDB');
console.log('已删除 AudioTestDB 数据库');
```

## 故障排查

### 问题 1: 控制台没有 [Audio Test] 日志

**原因**: 未运行在开发模式  
**解决**: 确认 `NODE_ENV === 'development'`

### 问题 2: IndexedDB 中没有数据

**原因**: `stopRecognition()` 可能未被调用  
**解决**: 确保完整结束会话，调用 `stopRecognition()` 函数

### 问题 3: WAV 文件无法播放

**原因**: PCM 数据可能为空或损坏  
**解决**: 检查控制台日志中的 PCM 数据长度和时长

## 开发调试技巧

1. **实时监控缓冲区大小**:
   ```javascript
   // 在浏览器控制台执行
   setInterval(() => {
     console.log('缓冲区状态:', {
       interviewee: window.intervieweeFullAudioRef?.current?.length || 0,
       interviewer: window.interviewerFullAudioRef?.current?.length || 0
     });
   }, 5000);
   ```

2. **验证音频完整性**:
   - 下载保存的 WAV 文件
   - 使用音频播放器播放
   - 检查是否有丢帧、爆音等问题

3. **对比原始传输**:
   - 录制原始音频
   - 对比 IndexedDB 中的音频
   - 验证传输链路的完整性


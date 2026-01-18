# Web 端语音识别说明

## 架构

Web 端**不进行语音识别**，仅接收 Electron 端识别后的文字。

```
Web 端: WebRTC 接收文字 → 显示 → AI 对话
```

## 实现

### 接收文字

通过 `useWebRTCReceiver` Hook 接收：
- `recognition-text` DataChannel
- JSON 格式消息（文字 + 状态）

### 消息格式

```typescript
{
  role: 'interviewee' | 'interviewer',
  text: string,
  type: 'recognizing' | 'recognized',
  status: 'pending' | 'received',
  timestamp: number
}
```

### 音量接收

同样通过 `recognition-text` DataChannel：

```typescript
{
  type: 'volume',
  role: 'interviewee' | 'interviewer',
  volume: number,
  timestamp: number
}
```

## 性能优势

- 带宽消耗: <1 KB/s（仅文字）
- CPU 占用: 低（无音频处理）
- 无需语音识别服务配置


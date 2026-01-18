import { clipboard, BrowserWindow } from 'electron';

let clipboardMonitorInterval: NodeJS.Timeout | null = null;
let lastClipboardText = '';
let lastClipboardImageHash = '';
let mainWindow: BrowserWindow | null = null;

// 简单的图片哈希函数
function getImageHash(image: Electron.NativeImage): string {
  const buffer = image.toPNG();
  return buffer.toString('base64').substring(0, 100); // 取前100字符作为简单哈希
}

// 启动剪贴板监听
export function startClipboardMonitor(window: BrowserWindow) {
  mainWindow = window;
  
  // 初始化当前剪贴板内容
  lastClipboardText = clipboard.readText();
  const image = clipboard.readImage();
  if (!image.isEmpty()) {
    lastClipboardImageHash = getImageHash(image);
  }

  // 每500ms检查一次剪贴板
  clipboardMonitorInterval = setInterval(() => {
    // 检查文本变化
    const currentText = clipboard.readText();
    if (currentText && currentText !== lastClipboardText) {
      lastClipboardText = currentText;
      // 通知渲染进程
      mainWindow?.webContents.send('clipboard-text-changed', currentText);
      console.log('剪贴板文本已变化');
    }

    // 检查图片变化
    const currentImage = clipboard.readImage();
    if (!currentImage.isEmpty()) {
      const currentHash = getImageHash(currentImage);
      if (currentHash !== lastClipboardImageHash) {
        lastClipboardImageHash = currentHash;
        // 通知渲染进程
        mainWindow?.webContents.send('clipboard-image-changed', {
          dataURL: currentImage.toDataURL()
        });
        console.log('剪贴板图片已变化');
      }
    }
  }, 500);

  console.log('剪贴板监听已启动');
}

// 停止剪贴板监听
export function stopClipboardMonitor() {
  if (clipboardMonitorInterval) {
    clearInterval(clipboardMonitorInterval);
    clipboardMonitorInterval = null;
    console.log('剪贴板监听已停止');
  }
}

// 获取当前剪贴板状态
export function getClipboardStatus(): boolean {
  return clipboardMonitorInterval !== null;
}


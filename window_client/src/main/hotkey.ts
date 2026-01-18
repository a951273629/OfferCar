import { globalShortcut, BrowserWindow } from 'electron';
import { captureScreenshotAsBase64 } from './screenshot';
import { getConfig, updateConfig } from './config';

let mainWindow: BrowserWindow | null = null;

// 注册全局热键
export function registerHotkeys(window: BrowserWindow) {
  mainWindow = window;

  // 注册 Ctrl+Shift+T 切换托盘图标显示
  const ret1 = globalShortcut.register('CommandOrControl+Shift+T', () => {
    const config = getConfig();
    const newValue = !config.trayIconVisible;
    updateConfig({ trayIconVisible: newValue });
    
    // 通知渲染进程
    mainWindow?.webContents.send('tray-visibility-changed', newValue);
    
    console.log(`托盘图标显示已${newValue ? '启用' : '禁用'}`);
  });

  if (!ret1) {
    console.log('热键 Ctrl+Shift+T 注册失败');
  }

  // 注册 Ctrl+Shift+Space 笔试截图快捷键
  const ret2 = globalShortcut.register('CommandOrControl+Shift+Space', async () => {
    console.log('[Hotkey] Ctrl+Shift+Space 按下，开始截图...');
    const base64 = await captureScreenshotAsBase64();
    if (base64) {
      // 发送截图到渲染进程
      mainWindow?.webContents.send('exam-screenshot-captured', base64);
      console.log('[Hotkey] 截图已发送到渲染进程');
    } else {
      console.error('[Hotkey] 截图失败');
    }
  });

  if (!ret2) {
    console.log('热键 Ctrl+Shift+Space 注册失败');
  }

  // 注册 Ctrl+Shift+Enter 快速回答快捷键
  const ret3 = globalShortcut.register('CommandOrControl+Shift+Return', () => {
    console.log('[Hotkey] Ctrl+Shift+Enter 按下，触发快速回答');
    mainWindow?.webContents.send('exam-quick-answer-triggered');
  });

  if (!ret3) {
    console.log('热键 Ctrl+Shift+Enter 注册失败');
  }

  // 注册 Ctrl+Shift+I 切换开发者工具
  const ret4 = globalShortcut.register('CommandOrControl+Shift+I+O', () => {
    console.log('[Hotkey] Ctrl+Shift+I 按下，切换开发者工具');
    mainWindow?.webContents.toggleDevTools();
  });

  if (!ret4) {
    console.log('热键 Ctrl+Shift+I 注册失败');
  }

  // 注册 Ctrl+Up 向上翻页快捷键
  const ret5 = globalShortcut.register('CommandOrControl+Up', () => {
    console.log('[Hotkey] Ctrl+Up 按下，触发向上翻页');
    mainWindow?.webContents.send('exam-scroll-up');
  });

  if (!ret5) {
    console.log('热键 Ctrl+Up 注册失败');
  }

  // 注册 Ctrl+Down 向下翻页快捷键
  const ret6 = globalShortcut.register('CommandOrControl+Down', () => {
    console.log('[Hotkey] Ctrl+Down 按下，触发向下翻页');
    mainWindow?.webContents.send('exam-scroll-down');
  });

  if (!ret6) {
    console.log('热键 Ctrl+Down 注册失败');
  }

  console.log('全局热键已注册');
}

// 注销所有热键
export function unregisterHotkeys() {
  globalShortcut.unregisterAll();
  console.log('全局热键已注销');
}

// 检查热键是否已注册
export function isHotkeyRegistered(accelerator: string): boolean {
  return globalShortcut.isRegistered(accelerator);
}


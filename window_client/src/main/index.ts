import { app, BrowserWindow, ipcMain, desktopCapturer, session, shell } from 'electron';
import * as path from 'path';
import { createTray } from './tray';
import { registerHotkeys, unregisterHotkeys } from './hotkey';
import { startClipboardMonitor, stopClipboardMonitor } from './clipboard';
import { initConfig, getConfig } from './config';
import { bytedanceRecognitionService } from './recognition/bytedanceService';

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

// 创建主窗口
function createWindow() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  mainWindow = new BrowserWindow({
    width: 600,
    height: 480,

    resizable: isDevelopment ? true : false, // 禁止缩放窗口
    frame: false, // 无边框，使用自定义标题栏
    show: false,
    backgroundColor: '#ffffff',
    webPreferences: {
      contextIsolation: true, // 启用上下文隔离
      nodeIntegration: false, // 禁用 nodeIntegration
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY
    },
    // 图标路径：在打包后使用 process.resourcesPath
    icon: path.join(process.resourcesPath || __dirname, 'build/icon.ico')
  });

  // 加载渲染进程：使用 Webpack 生成的入口 URL
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // 关闭时隐藏窗口而不是退出
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用启动
app.whenReady().then(async () => {
  // 初始化配置
  await initConfig();
  
  // 配置 CSP（Content Security Policy）响应头
  // 根据环境设置不同的安全策略
  const isProduction = process.env.NODE_ENV === 'production';
  const cspPolicy = isProduction
    ? // 生产环境：仅允许必要的域名连接
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://www.offercar.cn https://offercar.cn wss://www.offercar.cn wss://offercar.cn;"
    : // 开发环境：允许本地开发所需的所有连接
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* wss://localhost:* http://localhost:* https://localhost:* https://www.offercar.cn https://offercar.cn wss://www.offercar.cn wss://offercar.cn;";
  
  console.log(`[Electron] 构建模式: ${isProduction ? 'production' : 'development'}`);
  // console.log(`[Electron] CSP 策略: ${isProduction ? '生产模式（严格）' : '开发模式（宽松）'}`);
  
  // 拦截所有响应头，动态设置 CSP
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [cspPolicy]
      }
    });
  });
  
  // 配置 DisplayMedia 请求处理器（支持系统音频捕获）
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    desktopCapturer.getSources({ types: ['screen'] }).then((sources) => {
      // 只返回屏幕源，不返回窗口源
      // audio: 'loopback' 启用系统音频回环捕获（Windows）
      callback({ video: sources[0], audio: 'loopback' });
    });
  });
  
  // 创建主窗口
  createWindow();
  
  // 设置识别服务的主窗口引用
  bytedanceRecognitionService.setMainWindow(mainWindow!);
  
  // 创建托盘图标
  createTray(mainWindow!);
  
  // 注册全局热键
  registerHotkeys(mainWindow!);
  
  // 根据配置启动剪贴板监听
  const config = getConfig();
  if (config.clipboardMonitorEnabled) {
    startClipboardMonitor(mainWindow!);
  }
});

// macOS: 点击dock图标时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

// 退出前的清理
app.on('before-quit', () => {
  isQuitting = true;
  unregisterHotkeys();
  stopClipboardMonitor();
});

// 所有窗口关闭时退出 (Windows & Linux)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC 处理器
// 窗口控制
ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  mainWindow?.hide();
});

// 应用控制
ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
});

ipcMain.handle('app:get-version', () => {
  return app.getVersion();
});

// 配置管理
import { getConfig as getConfigData, updateConfig as updateConfigData, resetConfig } from './config';

ipcMain.handle('config:get', () => {
  return getConfigData();
});

ipcMain.handle('config:update', (_event, updates) => {
  updateConfigData(updates);
  return getConfigData();
});

ipcMain.handle('config:reset', () => {
  resetConfig();
  return getConfigData();
});

// 音频设备
import { getSystemAudioSources } from './audio/system-audio';

ipcMain.handle('audio:get-microphone-devices', async () => {
  // 这需要在渲染进程中调用 navigator.mediaDevices.enumerateDevices()
  return [];
});

ipcMain.handle('audio:get-system-audio-sources', async () => {
  return await getSystemAudioSources();
});

ipcMain.handle('audio:start-capture', async (_event, config) => {
  console.log('开始音频捕获', config);
  // 实际捕获在渲染进程中进行
  return { success: true };
});

ipcMain.handle('audio:stop-capture', () => {
  console.log('停止音频捕获');
  return { success: true };
});

// 截图
import { captureScreenshot as takeScreenshot, captureWindowScreenshot } from './screenshot';

ipcMain.handle('screenshot:capture', async () => {
  await takeScreenshot();
  return { success: true };
});

ipcMain.handle('screenshot:capture-window', async (_event, title) => {
  await captureWindowScreenshot(title);
  return { success: true };
});

// 剪贴板
import { getClipboardStatus } from './clipboard';

ipcMain.handle('clipboard:start', () => {
  if (mainWindow) {
    startClipboardMonitor(mainWindow);
  }
  return { success: true };
});

ipcMain.handle('clipboard:stop', () => {
  stopClipboardMonitor();
  return { success: true };
});

ipcMain.handle('clipboard:get-status', () => {
  return { active: getClipboardStatus() };
});

/**
 * 统一的 IPC 错误处理包装器
 */
function handleRecognitionIPC<T>(
  operation: () => T,
  logPrefix: string
): T | { success: false; error: string } {
  console.log(`[IPC] 收到${logPrefix}请求`);
  
  try {
    const result = operation();
    console.log(`[IPC] ${logPrefix}结果:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error(`[IPC] ${logPrefix}异常:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// 语音识别（火山引擎）
ipcMain.handle('recognition:start', () => {
  return handleRecognitionIPC(
    () => bytedanceRecognitionService.startRecognition(),
    '启动语音识别'
  );
});

ipcMain.handle('recognition:stop', () => {
  return handleRecognitionIPC(
    () => bytedanceRecognitionService.stopRecognition(),
    '停止语音识别'
  );
});

ipcMain.handle('recognition:send-audio', (_event, role: 'interviewee' | 'interviewer', audioData: number[]) => {
  // 接收渲染进程的音频数据并转发给识别服务
  const success = bytedanceRecognitionService.sendAudioData(role, audioData);
  return { success };
});

ipcMain.handle('recognition:get-status', () => {
  return bytedanceRecognitionService.getStatus();
});

// Shell 操作
ipcMain.handle('shell:open-external', async (_event, url: string) => {
  await shell.openExternal(url);
  return { success: true };
});

export { mainWindow };



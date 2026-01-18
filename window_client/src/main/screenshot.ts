import { desktopCapturer, clipboard, nativeImage } from 'electron';

// 捕获屏幕截图并返回 NativeImage
export async function captureScreenshot(): Promise<Electron.NativeImage | null> {
  try {
    // 获取所有屏幕源
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: 1920 * 2, // 支持高分辨率屏幕
        height: 1080 * 2
      }
    });

    if (sources.length === 0) {
      console.error('未找到可用的屏幕源');
      return null;
    }

    // 获取主屏幕（第一个）
    const primaryScreen = sources[0];
    const screenshot = primaryScreen.thumbnail;

    // 将截图保存到剪贴板
    clipboard.writeImage(screenshot);
    console.log('截图已保存到剪贴板');
    
    return screenshot;
  } catch (error) {
    console.error('截图失败:', error);
    return null;
  }
}

// 捕获屏幕截图并返回 Base64（用于 WebRTC 传输）
export async function captureScreenshotAsBase64(): Promise<string | null> {
  const screenshot = await captureScreenshot();
  if (!screenshot) {
    return null;
  }
  
  // 转换为 data URL (Base64)
  const dataURL = screenshot.toDataURL();
  console.log('[Screenshot] 截图转换为 Base64，大小:', `${(dataURL.length / 1024).toFixed(2)} KB`);
  
  return dataURL;
}

// 捕获特定窗口的截图
export async function captureWindowScreenshot(windowTitle?: string): Promise<void> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: {
        width: 1920,
        height: 1080
      }
    });

    let targetWindow = sources[0];
    
    if (windowTitle) {
      const found = sources.find(source => source.name.includes(windowTitle));
      if (found) {
        targetWindow = found;
      }
    }

    const screenshot = targetWindow.thumbnail;
    clipboard.writeImage(screenshot);
    console.log('窗口截图已保存到剪贴板');

  } catch (error) {
    console.error('窗口截图失败:', error);
  }
}

// 获取所有可用的屏幕源
export async function getAvailableScreens(): Promise<Electron.DesktopCapturerSource[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: 150,
        height: 150
      }
    });
    return sources;
  } catch (error) {
    console.error('获取屏幕源失败:', error);
    return [];
  }
}


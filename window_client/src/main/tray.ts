import { Tray, Menu, BrowserWindow, nativeImage } from 'electron';
import * as path from 'path';

let tray: Tray | null = null;

export function createTray(mainWindow: BrowserWindow) {
  // 创建托盘图标：在打包后使用 process.resourcesPath
  const iconPath = path.join(process.resourcesPath || __dirname, 'build/icon.ico');
  const icon = nativeImage.createFromPath(iconPath);
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('OfferCar AI');

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: '隐藏主窗口',
      click: () => {
        mainWindow.hide();
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        mainWindow.destroy();
        process.exit(0);
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  // 单击托盘图标显示/隐藏窗口
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  return tray;
}

export function getTray(): Tray | null {
  return tray;
}

export function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}



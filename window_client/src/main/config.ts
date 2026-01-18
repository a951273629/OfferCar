import Store from 'electron-store';

// 配置接口
interface AppConfig {
  microphoneDeviceId: string;
  systemAudioDeviceId: string;
  clipboardMonitorEnabled: boolean;
  trayIconVisible: boolean;
  hotkeys: {
    toggleTray: string;
    screenshot: string;
  };
  version: string;
}

// 默认配置
const defaultConfig: AppConfig = {
  microphoneDeviceId: 'default',
  systemAudioDeviceId: 'default',
  clipboardMonitorEnabled: true,
  trayIconVisible: true,
  hotkeys: {
    toggleTray: 'CommandOrControl+Shift+T',
    screenshot: 'PrintScreen'
  },
  version: '1.0.1'
};

// 创建配置存储
const store = new Store<AppConfig>({
  defaults: defaultConfig,
  name: 'config'
});

// 初始化配置
export async function initConfig(): Promise<void> {
  // 检查版本更新
  const currentVersion = (store as any).get('version');
  if (currentVersion !== defaultConfig.version) {
    console.log(`配置版本更新: ${currentVersion} -> ${defaultConfig.version}`);
    (store as any).set('version', defaultConfig.version);
  }
  
  console.log('配置已初始化');
}

// 获取完整配置
export function getConfig(): AppConfig {
  return (store as any).store;
}

// 获取单个配置项
export function getConfigValue<K extends keyof AppConfig>(key: K): AppConfig[K] {
  return (store as any).get(key);
}

// 更新配置
export function updateConfig(updates: Partial<AppConfig>): void {
  Object.entries(updates).forEach(([key, value]) => {
    (store as any).set(key as keyof AppConfig, value);
  });
  console.log('配置已更新:', updates);
}

// 重置配置为默认值
export function resetConfig(): void {
  (store as any).clear();
  (store as any).store = defaultConfig;
  console.log('配置已重置为默认值');
}

// 导出配置到文件
export function exportConfig(): string {
  return JSON.stringify((store as any).store, null, 2);
}

// 从 JSON 导入配置
export function importConfig(jsonString: string): boolean {
  try {
    const config = JSON.parse(jsonString);
    (store as any).store = { ...defaultConfig, ...config };
    console.log('配置已导入');
    return true;
  } catch (error) {
    console.error('导入配置失败:', error);
    return false;
  }
}


import { desktopCapturer } from 'electron';

// 系统音频设备接口
export interface SystemAudioDevice {
  id: string;
  name: string;
  type: 'screen' | 'window';
}

// 获取系统音频源列表
export async function getSystemAudioSources(): Promise<SystemAudioDevice[]> {
  try {
    // 只获取屏幕源，不获取窗口源
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      fetchWindowIcons: false
    });

    return sources.map(source => ({
      id: source.id,
      name: source.name,
      type: 'screen' as const
    }));
  } catch (error) {
    console.error('获取系统音频源失败:', error);
    return [];
  }
}

// 获取系统音频流的配置
export interface SystemAudioStreamConfig {
  sourceId: string;
  audio: boolean;
  video: boolean;
}

// 创建系统音频流配置
export function createSystemAudioStreamConfig(sourceId: string): SystemAudioStreamConfig {
  return {
    sourceId,
    audio: true,
    video: false // 只需要音频
  };
}

// 验证音频源是否可用
export async function isAudioSourceAvailable(sourceId: string): Promise<boolean> {
  try {
    const sources = await getSystemAudioSources();
    return sources.some(source => source.id === sourceId);
  } catch (error) {
    return false;
  }
}

// 获取默认系统音频源（主屏幕）
export async function getDefaultSystemAudioSource(): Promise<SystemAudioDevice | null> {
  try {
    const sources = await getSystemAudioSources();
    // 返回第一个屏幕源
    const screenSource = sources.find(s => s.type === 'screen');
    return screenSource || sources[0] || null;
  } catch (error) {
    console.error('获取默认系统音频源失败:', error);
    return null;
  }
}


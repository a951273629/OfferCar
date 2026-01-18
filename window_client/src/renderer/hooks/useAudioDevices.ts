import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';

export interface AudioDevice {
  deviceId: string;
  label: string;
}

interface UseAudioDevicesResult {
  microphoneDevices: AudioDevice[];
  systemAudioSources: any[];
  outputDeviceType: 'headphone' | 'speaker' | 'unknown';
  selectedMicrophone: string;
  selectedSystemAudio: string;
  setSelectedMicrophone: (id: string) => void;
  setSelectedSystemAudio: (id: string) => void;
  refreshDevices: () => Promise<void>;
}

/**
 * 音频设备管理 Hook
 * 枚举音频输入设备和系统音频源
 */
export function useAudioDevices(): UseAudioDevicesResult {
  const [microphoneDevices, setMicrophoneDevices] = useState<AudioDevice[]>([]);
  const [systemAudioSources, setSystemAudioSources] = useState<any[]>([]);
  const [outputDeviceType, setOutputDeviceType] = useState<'headphone' | 'speaker' | 'unknown'>('unknown');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('default');
  const [selectedSystemAudio, setSelectedSystemAudio] = useState<string>('default');

  // 加载麦克风设备列表
  const loadMicrophoneDevices = useCallback(async () => {
    try {
      // 在浏览器环境中获取设备
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices
        .filter(device => device.kind === 'audioinput')
        .map(device => ({
          deviceId: device.deviceId,
          label: device.label || `麦克风 ${device.deviceId.substring(0, 5)}`
        }));
      
      setMicrophoneDevices(audioInputs);
      
      if (audioInputs.length > 0 && selectedMicrophone === 'default') {
        setSelectedMicrophone(audioInputs[0].deviceId);
      }
    } catch (error) {
      console.error('[useAudioDevices] 获取麦克风设备失败:', error);
      message.error('获取麦克风设备失败');
    }
  }, [selectedMicrophone]);

  // 加载系统音频源
  const loadSystemAudioSources = useCallback(async () => {
    try {
      const sources = await window.electronAPI.audio.getSystemAudioSources();
      setSystemAudioSources(sources);
      
      if (sources.length > 0 && selectedSystemAudio === 'default') {
        setSelectedSystemAudio(sources[0].id);
      }
    } catch (error) {
      console.error('[useAudioDevices] 获取系统音频源失败:', error);
      message.error('获取系统音频源失败');
    }
  }, [selectedSystemAudio]);

  // 检测音频输出设备类型
  const detectOutputDeviceType = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputs = devices.filter(d => d.kind === 'audiooutput');
      
      console.log('[useAudioDevices] 可用输出设备:', audioOutputs.map(d => ({ id: d.deviceId, label: d.label })));
      
      if (audioOutputs.length === 0) {
        setOutputDeviceType('unknown');
        return;
      }
      
      // 检查是否有耳机设备
      const hasHeadphones = audioOutputs.some(d => {
        const label = d.label.toLowerCase();
        return label.includes('headphone') || 
               label.includes('headset') || 
               label.includes('耳机') ||
               label.includes('耳麦');
      });
      
      if (hasHeadphones) {
        setOutputDeviceType('headphone');
        console.log('[useAudioDevices] 检测到耳机设备');
      } else {
        setOutputDeviceType('speaker');
        console.log('[useAudioDevices] 未检测到耳机，当前使用扬声器');
      }
    } catch (error) {
      console.error('[useAudioDevices] 检测输出设备失败:', error);
      setOutputDeviceType('unknown');
    }
  }, []);

  // 刷新所有设备
  const refreshDevices = useCallback(async () => {
    await Promise.all([
      loadMicrophoneDevices(),
      loadSystemAudioSources(),
      detectOutputDeviceType()
    ]);
    message.success('设备列表已刷新');
  }, [loadMicrophoneDevices, loadSystemAudioSources, detectOutputDeviceType]);

  // 初始化加载设备
  useEffect(() => {
    const initDevices = async () => {
      await loadMicrophoneDevices();
      await loadSystemAudioSources();
      await detectOutputDeviceType();
    };
    initDevices();
    
    // 监听设备变化事件
    const handleDeviceChange = () => {
      console.log('[useAudioDevices] 检测到设备变化');
      detectOutputDeviceType();
      loadMicrophoneDevices();
      loadSystemAudioSources();
    };
    
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [loadMicrophoneDevices, loadSystemAudioSources, detectOutputDeviceType]);

  return {
    microphoneDevices,
    systemAudioSources,
    outputDeviceType,
    selectedMicrophone,
    selectedSystemAudio,
    setSelectedMicrophone,
    setSelectedSystemAudio,
    refreshDevices
  };
}


/**
 * Redux Slice: 用户设置
 * 管理全局用户设置，包括 AI 消息范围控制
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';
import type { GlobalConfig } from '@/types';
import { DEFAULT_GLOBAL_CONFIG } from '@/types';

// 定义设置状态接口
export interface SettingsState {
  globalConfig: GlobalConfig; // 全局显示/交互配置
}

// 初始状态
const initialState: SettingsState = {
  globalConfig: DEFAULT_GLOBAL_CONFIG,
};

// 创建 settings slice
export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    // 覆盖设置全量 globalConfig
    setGlobalConfig: (state, action: PayloadAction<GlobalConfig>) => {
      state.globalConfig = action.payload;
      console.log('[Redux] globalConfig 已更新');
    },

    // 局部更新 globalConfig（只更新传入的字段）
    updateGlobalConfig: (state, action: PayloadAction<Partial<GlobalConfig>>) => {
      state.globalConfig = {
        ...state.globalConfig,
        ...action.payload,
      };
      console.log('[Redux] globalConfig 已局部更新');
    },
  },
});

// 导出 actions
export const {
  setGlobalConfig,
  updateGlobalConfig,
} = settingsSlice.actions;

// 导出 selectors
export const selectGlobalConfig = (state: RootState) => state.settings.globalConfig;

// 导出 reducer
export default settingsSlice.reducer;


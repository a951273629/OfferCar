/**
 * Redux Store 配置
 * 使用 Redux Toolkit 配置全局状态管理
 */

import { configureStore } from '@reduxjs/toolkit';
import settingsReducer from './settingsSlice';

// 配置 store
export const store = configureStore({
  reducer: {
    settings: settingsReducer,
  },
  // 开发环境下启用 Redux DevTools
  devTools: process.env.NODE_ENV !== 'production',
});

// 导出 RootState 和 AppDispatch 类型
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


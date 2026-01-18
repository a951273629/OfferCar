/**
 * Redux Hooks
 * 提供类型化的 useDispatch 和 useSelector hooks
 */

import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from './index';

// 导出类型化的 hooks
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();


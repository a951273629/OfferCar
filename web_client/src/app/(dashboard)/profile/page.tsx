'use client';

import { useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Loading } from '@/components/common/Loading';
import { useAuth } from '@/hooks/useAuth';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { store } from '@/store';
import { selectGlobalConfig, updateGlobalConfig, setGlobalConfig } from '@/store/settingsSlice';
import { api } from '@/lib/utils/api';
import { ProfilePageContent } from '@/components/profile/ProfilePageContent';

export default function ProfilePage() {
  const { user, isLoading, mutate } = useAuth();
  const dispatch = useAppDispatch();
  const globalConfig = useAppSelector(selectGlobalConfig);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef(false);

  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, []);

  // 自动保存配置：落库到 /api/user/settings，成功后同步 localStorage 并刷新 /auth/me
  const saveGlobalConfigLatest = useCallback(async () => {
    if (savingRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    savingRef.current = true;

    const latest = store.getState().settings.globalConfig;
    try {
      const result = await api.put<{ globalConfig: typeof latest }>('/user/settings', {
        globalConfig: latest,
      });

      const merged = result?.globalConfig || latest;
      dispatch(setGlobalConfig(merged));
      localStorage.setItem('globalConfig', JSON.stringify(merged));
      await mutate();
      message.success({
        content: '已自动保存',
        key: 'globalConfigAutoSave',
        duration: 1,
      });
    } catch (error) {
      console.warn('[Profile] 保存 globalConfig 失败:', error);
      message.error(error instanceof Error ? error.message : '保存失败，请稍后重试');
    } finally {
      savingRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        void saveGlobalConfigLatest();
      }
    }
  }, [dispatch, mutate]);

  const handleUpdateGlobalConfig = useCallback(
    (patch: Parameters<typeof updateGlobalConfig>[0]) => {
      dispatch(updateGlobalConfig(patch));

      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }

      autosaveTimerRef.current = setTimeout(() => {
        void saveGlobalConfigLatest();
      }, 500);
    },
    [dispatch, saveGlobalConfigLatest],
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <Loading />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ProfilePageContent
        user={user}
        globalConfig={globalConfig}
        onUpdateGlobalConfig={handleUpdateGlobalConfig}
      />
    </DashboardLayout>
  );
}


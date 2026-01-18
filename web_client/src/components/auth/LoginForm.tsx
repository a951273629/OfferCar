'use client';

import { useState, useEffect } from 'react';
import { Form, Input, Button, message, Alert, Divider } from 'antd';
import { MailOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthActions } from '@/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth/auth-client';
import type { UserLoginDto } from '@/types';

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [sendingOTP, setSendingOTP] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [form] = Form.useForm();
  const { login, sendOTP } = useAuthActions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/interview';
  const invitationCode = searchParams.get('ic'); // 邀请码（从URL参数获取）

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 将邀请码写入 Cookie，供 Better-Auth hooks 在首次登录时读取（ic）
  useEffect(() => {
    if (!invitationCode) {
      return;
    }

    try {
      const encoded = encodeURIComponent(String(invitationCode));
      document.cookie = `ic=${encoded}; Path=/; Max-Age=86400; SameSite=Lax`;
    } catch {
      // ignore
    }
  }, [invitationCode]);

  // 发送验证码
  const handleSendOTP = async () => {
    try {
      const email = form.getFieldValue('email');
      if (!email) {
        message.warning('请先输入邮箱');
        return;
      }

      // 验证邮箱格式
      await form.validateFields(['email']);

      setSendingOTP(true);
      await sendOTP({ email });
      message.success('验证码已发送，请查收邮件');
      setCountdown(60);
    } catch (error: any) {
      if (error.errorFields) {
        // 表单验证错误
        return;
      }
      message.error(error instanceof Error ? error.message : '发送验证码失败');
      // 发送失败时重置倒计时，允许用户立即重试
      setCountdown(0);
    } finally {
      setSendingOTP(false);
    }
  };

  const handleGithubLogin = async () => {
    try {
      setLoading(true);
      const result: any = await authClient.signIn.social({
        provider: 'github',
        callbackURL: redirect,
      });

      if (result?.error) {
        throw new Error(String(result.error?.message || 'GitHub 登录失败'));
      }

      // 某些实现会返回 url（需要手动跳转）；如果已自动跳转，这里不会执行到后面
      const url = result?.data?.url || result?.url;
      if (typeof url === 'string' && url) {
        window.location.href = url;
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'GitHub 登录失败');
      setLoading(false);
    }
  };

  // 登录
  const onFinish = async (values: UserLoginDto) => {
    setLoading(true);
    try {
      await login(values);
      message.success('登录成功');
      
      // 使用硬跳转确保触发服务器端中间件验证
      window.location.href = redirect;
    } catch (error) {
      message.error(error instanceof Error ? error.message : '登录失败');
      setLoading(false);
    }
  };

  return (
    <Form
      form={form}
      name="login"
      onFinish={onFinish}
      autoComplete="off"
      size="large"
    >
      {invitationCode && (
        <Alert
          message={
            <>
              受 <strong>{invitationCode}</strong> 邀请
            </>
          }
          type="info"
          showIcon
          style={{ marginBottom: '16px' }}
        />
      )}
      
      <Form.Item
        name="email"
        rules={[
          { required: true, message: '请输入邮箱' },
          { type: 'email', message: '请输入有效的邮箱地址' },
        ]}
      >
        <Input prefix={<MailOutlined />} placeholder="邮箱地址" />
      </Form.Item>

      <Form.Item
        name="code"
        rules={[
          { required: true, message: '请输入验证码' },
          // { len: 6, message: '验证码必须是6位数字' },
          { pattern: /^\d{6}$/, message: '验证码必须是6位数字' },
        ]}
      >
        <Input
          prefix={<SafetyOutlined />}
          placeholder="6位验证码"
          maxLength={6}
          suffix={
            <Button
              type="link"
              size="small"
              onClick={handleSendOTP}
              loading={sendingOTP}
              disabled={countdown > 0}
              style={{ padding: 0 }}
            >
              {countdown > 0 ? `${countdown}秒后重试` : '获取验证码'}
            </Button>
          }
        />
      </Form.Item>

      <Form.Item>
        <Button type="primary" htmlType="submit" loading={loading} block>
          登录
        </Button>
      </Form.Item>

      <Divider plain>或</Divider>

      <Form.Item style={{ marginBottom: 0 }}>
        <Button
          onClick={handleGithubLogin}
          loading={loading}
          block
        >
          使用 GitHub 登录
        </Button>
      </Form.Item>
    </Form>
  );
}


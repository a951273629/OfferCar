'use client';

import { Card, Divider, InputNumber, Slider, Space, Switch, Typography } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import type { GlobalConfig } from '@/types';

const { Title } = Typography;

interface ConfigPageProps {
  config: GlobalConfig;
  onChange: (patch: Partial<GlobalConfig>) => void;
}

export function ConfigPage({
  config,
  onChange,
}: ConfigPageProps) {
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <SettingOutlined style={{ fontSize: 20, marginRight: 8 }} />
        <Title level={4} style={{ margin: 0 }}>
           设置
        </Title>
      </div>

      <Divider style={{ margin: '16px 0' }} />



      {/* <Divider style={{ margin: '16px 0' }} /> */}

      {/* <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
        <SettingOutlined style={{ fontSize: 20, marginRight: 8 }} />
        <Title level={4} style={{ margin: 0 }}>
          显示与交互设置
        </Title>
      </div> */}

      {/* <Divider style={{ margin: '16px 0' }} /> */}

      <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>消息范围控制</div>
          <div style={{ color: '#666', fontSize: 14 }}>
            {config.scopeCharacter
              ? '当前仅发送【面试官】的消息给 AI（推荐）'
              : '当前发送 【面试官】 和 【面试者】 的消息给 AI'}
          </div>
        </div>
        <Switch checked={config.scopeCharacter} onChange={(checked) => onChange({ scopeCharacter: checked })} />
      </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>显示面试者消息</div>
            <div style={{ color: '#666', fontSize: 14 }}>关闭后：实时接入的面试者消息不会加入对话，也不会发送给 AI</div>
          </div>
          <Switch checked={config.showIntervieweeMessages} onChange={(checked) => onChange({ showIntervieweeMessages: checked })} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>开启手势（移动端）</div>
            <div style={{ color: '#666', fontSize: 14 }}>左滑删除消息；右滑仅发送该条给 AI</div>
          </div>
          <Switch checked={config.gestureEnabled} onChange={(checked) => onChange({ gestureEnabled: checked })} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 4 }}>启用双语回答</div>
            <div style={{ color: '#666', fontSize: 14 }}>开启后：AI 回答将按“中文 + English”逐句对照输出</div>
          </div>
          <Switch checked={config.bilingualEnable} onChange={(checked) => onChange({ bilingualEnable: checked })} />
        </div>

        <div>
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 12 }}>字体大小（px）</div>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 120 }}>AI</div>
              <Slider
                min={9}
                max={24}
                value={config.aiFontSize}
                onChange={(v) => onChange({ aiFontSize: Number(v || 0) })}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={9}
                max={24}
                value={config.aiFontSize}
                onChange={(v) => onChange({ aiFontSize: Number(v || 0) })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 120 }}>面试官</div>
              <Slider
                min={9}
                max={24}
                value={config.interviewerFontSize}
                onChange={(v) => onChange({ interviewerFontSize: Number(v || 0) })}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={9}
                max={24}
                value={config.interviewerFontSize}
                onChange={(v) => onChange({ interviewerFontSize: Number(v || 0) })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 120 }}>面试者</div>
              <Slider
                min={9}
                max={24}
                value={config.intervieweeFontSize}
                onChange={(v) => onChange({ intervieweeFontSize: Number(v || 0) })}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={9}
                max={24}
                value={config.intervieweeFontSize}
                onChange={(v) => onChange({ intervieweeFontSize: Number(v || 0) })}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 120 }}>笔试/用户</div>
              <Slider
                min={9}
                max={24}
                value={config.userFontSize}
                onChange={(v) => onChange({ userFontSize: Number(v || 0) })}
                style={{ flex: 1 }}
              />
              <InputNumber
                min={9}
                max={24}
                value={config.userFontSize}
                onChange={(v) => onChange({ userFontSize: Number(v || 0) })}
              />
            </div>
          </Space>
        </div>

      </Space>
    </Card>
  );
}



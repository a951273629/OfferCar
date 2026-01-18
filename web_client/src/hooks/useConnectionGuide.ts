import { useState, useEffect } from 'react';

interface UseConnectionGuideProps {
  isModalVisible: boolean;
}

// 使用 any 类型绕过类型检查，因为 byte-guide 的类型定义可能不完全导出
type GuideStep = any;

/**
 * 连接设备引导 Hook
 * 管理首次访问时的设备连接引导流程
 */
export function useConnectionGuide({ isModalVisible }: UseConnectionGuideProps) {
  const [guideVisible, setGuideVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // 检查是否首次访问
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const isCompleted = localStorage.getItem('connection-guide-completed');
    
    // Early Return: 如果已经完成过引导，不再显示
    if (isCompleted === 'true') {
      return;
    }

    // 首次访问，显示引导
    setGuideVisible(true);
  }, []);

  // 监听 Modal 状态，自动进入 Step 2
  useEffect(() => {
    if (!guideVisible) {
      return;
    }

    // 当 Modal 打开且当前在 Step 1 时，自动进入 Step 2
    if (isModalVisible && currentStep === 0) {
      // 延迟一点，确保 Modal 完全渲染
      setTimeout(() => {
        setCurrentStep(1);
      }, 300);
    }
  }, [isModalVisible, currentStep, guideVisible]);

  // 配置引导步骤
  const steps: GuideStep[] = [
    {
      selector: '#connect-device-button',
      title: '连接设备',
      content: '首先需要连接客户端设备，点击此按钮生成配对码',
      placement: 'bottom',
      visible: true,
    },
    {
      selector: '#pairing-code-input',
      title: '输入配对码',
      content: '请将此配对码输入到客户端应用中完成连接',
      placement: 'bottom',
      visible: isModalVisible,
    },
  ];

  // 关闭引导
  const handleClose = () => {
    setGuideVisible(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('connection-guide-completed', 'true');
    }
  };

  // 步骤变化前的回调
  const beforeStepChange = (nextIndex: number) => {
    // Early Return: 如果是从 Step 1 到 Step 2，但 Modal 未打开，阻止步骤切换
    if (nextIndex === 1 && !isModalVisible) {
      return false;
    }
    return true;
  };

  // 步骤变化后的回调
  const afterStepChange = (nextIndex: number) => {
    setCurrentStep(nextIndex);
  };

  return {
    guideVisible,
    steps,
    handleClose,
    beforeStepChange,
    afterStepChange,
  };
}


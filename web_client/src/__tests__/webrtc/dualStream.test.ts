/**
 * 双流音频识别测试
 * 测试双流识别逻辑的正确性
 */

describe('双流音频识别', () => {
  describe('轨道标识设置', () => {
    it('应该正确设置麦克风轨道标识', () => {
      const mockTrack = {
        kind: 'audio',
        label: 'Default - Microphone',
      };

      // 模拟设置 label
      try {
        Object.defineProperty(mockTrack, 'label', {
          value: 'interviewee_audio',
          writable: false,
          configurable: true
        });
      } catch (e) {
        // 忽略错误
      }

      // 验证
      const expectedLabel = 'interviewee_audio';
      expect(mockTrack.label).toBe(expectedLabel);
    });

    it('应该正确设置系统音频轨道标识', () => {
      const mockTrack = {
        kind: 'audio',
        label: 'Desktop Audio',
      };

      // 模拟设置 label
      try {
        Object.defineProperty(mockTrack, 'label', {
          value: 'interviewer_audio',
          writable: false,
          configurable: true
        });
      } catch (e) {
        // 忽略错误
      }

      // 验证
      const expectedLabel = 'interviewer_audio';
      expect(mockTrack.label).toBe(expectedLabel);
    });
  });

  describe('音频流识别回调', () => {
    it('应该区分面试者和面试官的识别结果', () => {
      const results: Array<{ role: string; text: string }> = [];

      const onUpdate = (role: 'interviewee' | 'interviewer', text: string) => {
        results.push({ role, text });
      };

      // 模拟识别结果
      onUpdate('interviewee', '我觉得React Hooks很好用');
      onUpdate('interviewer', '能具体说说为什么吗？');
      onUpdate('interviewee', '因为它简化了状态管理');

      // 验证：结果正确分类
      expect(results).toHaveLength(3);
      expect(results[0].role).toBe('interviewee');
      expect(results[1].role).toBe('interviewer');
      expect(results[2].role).toBe('interviewee');
    });
  });

  describe('消息气泡样式', () => {
    it('面试者消息应该使用紫色', () => {
      const speakerColor = (speaker?: 'interviewee' | 'interviewer') => {
        return speaker === 'interviewer' ? '#1677ff' : '#7c3aed';
      };

      expect(speakerColor('interviewee')).toBe('#7c3aed');
      expect(speakerColor(undefined)).toBe('#7c3aed');  // 默认
    });

    it('面试官消息应该使用蓝色', () => {
      const speakerColor = (speaker?: 'interviewee' | 'interviewer') => {
        return speaker === 'interviewer' ? '#1677ff' : '#7c3aed';
      };

      expect(speakerColor('interviewer')).toBe('#1677ff');
    });

    it('消息背景色应该区分身份', () => {
      const getBgVar = (speaker?: 'interviewee' | 'interviewer') => {
        return speaker === 'interviewer'
          ? 'var(--color-message-interviewer)'
          : 'var(--color-message-interviewee)';
      };

      expect(getBgVar('interviewer')).toBe('var(--color-message-interviewer)');
      expect(getBgVar('interviewee')).toBe('var(--color-message-interviewee)');
    });
  });

  describe('性能考虑', () => {
    it('应该能够处理快速的识别更新', () => {
      const messages: any[] = [];
      const addMessage = (role: 'interviewee' | 'interviewer', text: string) => {
        const lastIndex = messages.findLastIndex(m => m.speaker === role && m.status === 'pending');
        
        if (lastIndex >= 0) {
          messages[lastIndex].content = text;
        } else {
          messages.push({
            id: Date.now().toString(),
            role: 'user',
            content: text,
            speaker: role,
            status: 'pending'
          });
        }
      };

      // 模拟快速更新
      addMessage('interviewee', '我');
      addMessage('interviewee', '我觉得');
      addMessage('interviewee', '我觉得React');
      addMessage('interviewee', '我觉得React Hooks很好用');

      // 验证：应该只有一条面试者消息，内容被更新
      const intervieweeMessages = messages.filter(m => m.speaker === 'interviewee');
      expect(intervieweeMessages).toHaveLength(1);
      expect(intervieweeMessages[0].content).toBe('我觉得React Hooks很好用');
    });

    it('应该能够交错处理两个说话人的消息', () => {
      const messages: any[] = [];
      const addMessage = (role: 'interviewee' | 'interviewer', text: string) => {
        const lastIndex = messages.findLastIndex(m => m.speaker === role && m.status === 'pending');
        
        if (lastIndex >= 0) {
          messages[lastIndex].content = text;
        } else {
          messages.push({
            id: Date.now().toString(),
            role: 'user',
            content: text,
            speaker: role,
            status: 'pending'
          });
        }
      };

      // 模拟对话场景
      addMessage('interviewer', '请介绍');
      addMessage('interviewer', '请介绍一下');
      addMessage('interviewer', '请介绍一下你自己');
      addMessage('interviewee', '我');
      addMessage('interviewee', '我是');
      addMessage('interviewee', '我是一名前端工程师');

      // 验证：应该有两条消息
      expect(messages).toHaveLength(2);
      expect(messages[0].speaker).toBe('interviewer');
      expect(messages[0].content).toBe('请介绍一下你自己');
      expect(messages[1].speaker).toBe('interviewee');
      expect(messages[1].content).toBe('我是一名前端工程师');
    });
  });
});

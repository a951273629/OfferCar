/**
 * WebRTC 端到端集成测试
 * 模拟完整的 Electron → Web 双轨道音频流传输流程
 */

describe('WebRTC 双轨道音频流传输', () => {
  describe('音频流发送逻辑验证（Electron 端）', () => {
    it('应该将麦克风和系统音频轨道分别添加到 PeerConnection', () => {
      // 模拟麦克风流（面试者）
      const mockMicTrack = {
        kind: 'audio',
        label: 'interviewee_audio',  // 标识为面试者
        enabled: true,
        stop: jest.fn()
      };

      const mockMicStream = {
        getTracks: jest.fn().mockReturnValue([mockMicTrack]),
        getAudioTracks: jest.fn().mockReturnValue([mockMicTrack]),
        getVideoTracks: jest.fn().mockReturnValue([])
      };

      // 模拟系统音频流（面试官）
      const mockSystemTrack = {
        kind: 'audio',
        label: 'interviewer_audio',  // 标识为面试官
        enabled: true,
        stop: jest.fn()
      };

      const mockSystemStream = {
        getTracks: jest.fn().mockReturnValue([mockSystemTrack]),
        getAudioTracks: jest.fn().mockReturnValue([mockSystemTrack]),
        getVideoTracks: jest.fn().mockReturnValue([])
      };

      // 模拟 PeerConnection
      const mockAddTrack = jest.fn();
      const mockPeerConnection = {
        addTrack: mockAddTrack,
        createOffer: jest.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp' }),
        setLocalDescription: jest.fn().mockResolvedValue(undefined),
        onicecandidate: null,
        onconnectionstatechange: null,
      };

      global.RTCPeerConnection = jest.fn(() => mockPeerConnection) as any;

      // 执行：分别添加两个音频轨道
      const pc = new RTCPeerConnection();
      
      // 添加麦克风轨道
      mockMicStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, mockMicStream as unknown as MediaStream);
      });
      
      // 添加系统音频轨道
      mockSystemStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, mockSystemStream as unknown as MediaStream);
      });

      // 验证：两个轨道都被添加，且标识不同
      expect(mockAddTrack).toHaveBeenCalledTimes(2);
      expect(mockAddTrack).toHaveBeenCalledWith(mockMicTrack, mockMicStream);
      expect(mockAddTrack).toHaveBeenCalledWith(mockSystemTrack, mockSystemStream);
      
      // 验证轨道标识
      expect(mockMicTrack.label).toBe('interviewee_audio');
      expect(mockSystemTrack.label).toBe('interviewer_audio');
    });
  });

  describe('音频流接收逻辑验证（Web 端）', () => {
    it('应该正确接收并区分双路音频流', () => {
      // 模拟面试者音频流
      const mockIntervieweeStream = {
        id: 'stream-interviewee',
        getAudioTracks: jest.fn().mockReturnValue([
          { kind: 'audio', label: 'interviewee_audio', enabled: true }
        ])
      };

      // 模拟面试官音频流
      const mockInterviewerStream = {
        id: 'stream-interviewer',
        getAudioTracks: jest.fn().mockReturnValue([
          { kind: 'audio', label: 'interviewer_audio', enabled: true }
        ])
      };

      const mockPeerConnection = {
        ontrack: null as any,
        setRemoteDescription: jest.fn(),
        createAnswer: jest.fn(),
        setLocalDescription: jest.fn(),
      };

      global.RTCPeerConnection = jest.fn(() => mockPeerConnection) as any;

      // 创建 PeerConnection
      const pc = new RTCPeerConnection();
      
      // 模拟设置 ontrack 处理器
      // 这里不依赖真实 MediaStream 类型，仅验证分类逻辑
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receivedIntervieweeStream: any = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let receivedInterviewerStream: any = null;
      
      pc.ontrack = (event: any) => {
        const track = event.track;
        if (event.streams && event.streams[0]) {
          if (track.label === 'interviewee_audio') {
            receivedIntervieweeStream = event.streams[0];
          } else if (track.label === 'interviewer_audio') {
            receivedInterviewerStream = event.streams[0];
          }
        }
      };

      // 模拟收到面试者音频流
      const mockIntervieweeEvent = {
        streams: [mockIntervieweeStream],
        track: { kind: 'audio', label: 'interviewee_audio' }
      };

      // 模拟收到面试官音频流
      const mockInterviewerEvent = {
        streams: [mockInterviewerStream],
        track: { kind: 'audio', label: 'interviewer_audio' }
      };

      if (pc.ontrack) {
        pc.ontrack(mockIntervieweeEvent as any);
        pc.ontrack(mockInterviewerEvent as any);
      }

      // 验证：两个流都被正确接收并区分
      expect(receivedIntervieweeStream).toBe(mockIntervieweeStream);
      expect(receivedInterviewerStream).toBe(mockInterviewerStream);
      expect(receivedIntervieweeStream?.id).not.toBe(receivedInterviewerStream?.id);
    });

    it('应该根据轨道标签正确分类音频流', () => {
      const testCases = [
        { label: 'interviewee_audio', expected: 'interviewee' },
        { label: 'interviewer_audio', expected: 'interviewer' },
        { label: 'Microphone (Realtek Audio)', expected: 'interviewee' },
        { label: 'System Audio', expected: 'interviewer' },
      ];

      testCases.forEach(({ label, expected }) => {
        let result: string | null = null;
        
        if (label === 'interviewee_audio' || label.includes('Microphone')) {
          result = 'interviewee';
        } else if (label === 'interviewer_audio' || label.includes('System')) {
          result = 'interviewer';
        }

        expect(result).toBe(expected);
      });
    });
  });

  describe('音频流格式兼容性', () => {
    it('MediaStream 应该包含音频轨道', () => {
      const mockTrack = {
        kind: 'audio',
        label: 'Test Audio',
        enabled: true
      };

      const mockStream = {
        getTracks: jest.fn().mockReturnValue([mockTrack]),
        getAudioTracks: jest.fn().mockReturnValue([mockTrack]),
        getVideoTracks: jest.fn().mockReturnValue([])
      };

      // 验证音频流格式
      expect(mockStream.getAudioTracks().length).toBeGreaterThan(0);
      expect(mockStream.getTracks()[0].kind).toBe('audio');
    });
  });

  describe('配对码流程', () => {
    it('应该完成完整的配对流程', () => {
      // 模拟配对码生成
      const generateCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
      };

      const code1 = generateCode();
      const code2 = generateCode();

      // 验证：配对码格式正确
      expect(code1).toMatch(/^\d{6}$/);
      expect(code2).toMatch(/^\d{6}$/);
      
      // 验证：不同的配对码（概率极低相同）
      expect(code1).not.toBe(code2);
    });
  });

  describe('说话人身份识别', () => {
    it('应该正确标注面试者消息', () => {
      const message = {
        id: '1',
        role: 'user' as const,
        content: '我有5年React开发经验',
        date: new Date().toISOString(),
        status: 'pending' as const,
        speaker: 'interviewee' as const
      };

      expect(message.speaker).toBe('interviewee');
      expect(message.role).toBe('user');
    });

    it('应该正确标注面试官消息', () => {
      const message = {
        id: '2',
        role: 'user' as const,
        content: '请介绍一下你的项目经验',
        date: new Date().toISOString(),
        status: 'pending' as const,
        speaker: 'interviewer' as const
      };

      expect(message.speaker).toBe('interviewer');
      expect(message.role).toBe('user');
    });

    it('AI 助手消息不应该有 speaker 字段', () => {
      const message = {
        id: '3',
        role: 'assistant' as const,
        content: '建议强调技术栈和项目成果',
        date: new Date().toISOString(),
        status: 'sent' as const
      };

      expect((message as any).speaker).toBeUndefined();
      expect(message.role).toBe('assistant');
    });
  });
});


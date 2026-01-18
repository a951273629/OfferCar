/**
 * 全局/会话配置类型
 * - GlobalConfig：用户级默认配置（可跨设备持久化）
 * - SessionConfig：单次会话的配置（可覆盖全局默认）
 */

export interface GlobalConfig {
  // 字体大小（px）
  aiFontSize: number;
  interviewerFontSize: number;
  intervieweeFontSize: number;
  userFontSize: number;

  // AI 消息范围控制：true=仅发送面试官消息，false=发送所有消息
  scopeCharacter: boolean;

  // 是否显示面试者消息（默认显示）
  showIntervieweeMessages: boolean;

  // 是否启用手势（左滑删除、右滑发送单条给 AI）
  gestureEnabled: boolean;

  // 是否启用双语回答（中文 + English 对照）
  bilingualEnable: boolean;
}

export type SessionConfig = GlobalConfig;

export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  aiFontSize: 14,
  interviewerFontSize: 14,
  intervieweeFontSize: 14,
  userFontSize: 14,

  scopeCharacter: true,

  showIntervieweeMessages: true,
  gestureEnabled: false,
  bilingualEnable: false,
};



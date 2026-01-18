const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');
const CopyWebpackPlugin = require('copy-webpack-plugin');
require('dotenv').config();

// 根据环境设置信令服务器地址
const isProduction = process.env.NODE_ENV === 'production';
const signalingServerUrl = isProduction
  ? 'https://www.offercar.cn'
  : 'http://localhost:3001';

console.log(`构建模式: ${process.env.NODE_ENV || 'development'}`);
console.log(`信令服务器地址: ${signalingServerUrl}`);

module.exports = [
  new HtmlWebpackPlugin({
    template: './src/renderer/index.html',
    filename: 'index.html',
    // 注意：CSP 策略由 Electron 主进程（main/index.ts）中的 session API 管理
    // 不在此处配置 meta，避免与主进程配置冲突
  }),
  new webpack.DefinePlugin({
    'process.env.SIGNALING_SERVER_URL': JSON.stringify(signalingServerUrl),
    // 语音识别提供商配置
    'process.env.SPEECH_PROVIDER': JSON.stringify(process.env.SPEECH_PROVIDER || 'bytedance'),
    // 火山引擎配置
    'process.env.BYTEDANCE_APP_KEY': JSON.stringify(process.env.BYTEDANCE_APP_KEY),
    'process.env.BYTEDANCE_ACCESS_TOKEN': JSON.stringify(process.env.BYTEDANCE_ACCESS_TOKEN),
    // 腾讯云配置
    'process.env.TENCENT_SECRET_ID': JSON.stringify(process.env.TENCENT_SECRET_ID || ''),
    'process.env.TENCENT_SECRET_KEY': JSON.stringify(process.env.TENCENT_SECRET_KEY || ''),
    'process.env.TENCENT_APP_ID': JSON.stringify(process.env.TENCENT_APP_ID || ''),
    'process.env.TENCENT_ENGINE_MODEL_TYPE': JSON.stringify(process.env.TENCENT_ENGINE_MODEL_TYPE || '16k_zh'),
    // Azure 配置
    'process.env.AZURE_SPEECH_KEY': JSON.stringify(process.env.AZURE_SPEECH_KEY || ''),
    'process.env.AZURE_SPEECH_REGION': JSON.stringify(process.env.AZURE_SPEECH_REGION || ''),
  }),
  // 复制 mock 目录到输出目录（用于音频测试）
  new CopyWebpackPlugin({
    patterns: [
      {
        from: 'mock',
        to: 'mock',
        noErrorOnMissing: true
      }
    ]
  }),
];


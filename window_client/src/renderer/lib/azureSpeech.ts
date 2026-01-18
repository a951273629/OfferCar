import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

const AZURE_SPEECH_KEY = process.env.AZURE_SPEECH_KEY || '';
const AZURE_SPEECH_REGION = process.env.AZURE_SPEECH_REGION || '';

/**
 * 获取 Azure 语音配置
 */
export function getAzureSpeechConfig(): sdk.SpeechConfig {
  if (!AZURE_SPEECH_KEY || !AZURE_SPEECH_REGION) {
    throw new Error(
      'Azure 语音识别配置不完整，请检查环境变量: AZURE_SPEECH_KEY, AZURE_SPEECH_REGION'
    );
  }

  const speechConfig = sdk.SpeechConfig.fromSubscription(AZURE_SPEECH_KEY, AZURE_SPEECH_REGION);
  speechConfig.speechRecognitionLanguage = 'zh-CN';
  
  // 设置超时配置
  speechConfig.setProperty(
    'SpeechServiceConnection_InitialMessageDelayMs',
    '15000'
  );
  
  speechConfig.setProperty(
    'Speech_InitialSilenceTimeoutMs',
    '300000'
  );
  
  speechConfig.setProperty(
    'Speech_EndSilenceTimeoutMs',
    '10000'
  );
  
  return speechConfig;
}

/**
 * 创建 PushAudioInputStream
 */
export function createPushAudioInputStream(): sdk.PushAudioInputStream {
  // 16kHz, 16bit, 单声道
  const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
  return sdk.AudioInputStream.createPushStream(format);
}


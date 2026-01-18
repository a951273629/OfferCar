module.exports = [
  // TypeScript/TSX 规则
  {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    use: {
      loader: 'ts-loader',
    },
  },
  // CSS 规则
  {
    test: /\.css$/,
    use: ['style-loader', 'css-loader'],
  },
  // 音频文件规则（MP3, WAV 等）
  {
    test: /\.(mp3|wav|ogg|m4a)$/,
    type: 'asset/resource',
    generator: {
      filename: 'assets/audio/[name][ext]'
    }
  },
];


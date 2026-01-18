module.exports = {
  /**
   * 主进程入口点
   */
  entry: './src/main/index.ts',
  // 将 src 目录放入 .webpack/main，以便后续引用
  module: {
    rules: require('./webpack.rules'),
  },
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
  // 根据环境设置 webpack mode
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  // Production 模式下不生成 source map，development 保留
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
};


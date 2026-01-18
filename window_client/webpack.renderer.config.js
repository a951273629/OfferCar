const rules = require('./webpack.rules');
const plugins = require('./webpack.plugins');

module.exports = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
  // 根据环境设置 webpack mode
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  // Production 模式下不生成 source map，development 保留
  devtool: process.env.NODE_ENV === 'production' ? false : 'source-map',
};


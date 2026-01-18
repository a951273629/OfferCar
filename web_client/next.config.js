/** @type {import('next').NextConfig} */
const nextConfig = {
  // 启用 Standalone 输出模式以优化 Docker 镜像体积
  output: 'standalone',
  
  reactStrictMode: true,
  
  // 禁用构建时的 ESLint 检查
  eslint: {
    // Warning: 这将在生产构建时完全禁用 ESLint
    ignoreDuringBuilds: true,
  },


  // 环境变量配置
  // env: {
  //   NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  // },

  // 图片优化配置
  images: {
    domains: [],
    // 禁用图像优化以避免在 standalone 模式下需要 sharp 依赖
    unoptimized: true,
  },

  // Webpack 配置
  webpack: (config, { isServer }) => {
    // 添加对 node 模块的支持
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // 服务器端配置，忽略 canvas 模块（pdfjs-dist 依赖）
    if (isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        canvas: false,
      };
    }
    
    return config;
  },
};

module.exports = nextConfig;


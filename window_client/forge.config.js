const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'OfferCar AI',
    executableName: 'OfferCar-AI',
    // 图标配置（后续添加图标文件时取消注释）
    // icon: './build/icon', // 不需要扩展名，Forge 会自动添加 .ico 或 .icns
    // 将 build 目录复制到打包输出的 resources 目录
    extraResource: [
      './build'
    ]
  },
  rebuildConfig: {},
  makers: [
    // Windows WiX MSI 安装程序（推荐用于正式发布）
    {
      name: '@electron-forge/maker-wix',
      config: {
        language: 2052, // 简体中文
        manufacturer: 'OfferCar',
        name: 'OfferCar AI',
        description: 'OfferCar AI Windows Client',
        exe: 'OfferCar-AI',
        // 图标配置（后续添加图标文件时取消注释）
        programFilesFolderName: 'OfferCar AI',
        ui: {
          enabled: true,
          chooseDirectory: true,
        },
        // 图标配置（后续添加图标文件时取消注释）
        icon: './build/icon.ico',
      },
      platforms: ['win32'],
    },
    // Windows Squirrel 安装程序（用于快速迭代开发测试）
    // {
    //   name: '@electron-forge/maker-squirrel',
    //   config: {
    //     name: 'OfferCar-AI',
    //     authors: 'OfferCar',
    //     description: 'OfferCar AI Windows Client',
    //     // 图标配置（后续添加图标文件时取消注释）
    //     setupIcon: './build/icon.ico',
    //     iconUrl: 'https://www.offercar.cn/icon.ico',
    //   },
    //   platforms: ['win32'],
    // },
    // macOS DMG 安装程序
    {
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'OfferCar AI',
        // 图标配置（后续添加图标文件时取消注释）
        // icon: './build/icon.icns',
        format: 'ULFO',
      },
      platforms: ['darwin'],
    },
    // macOS 和 Linux ZIP 压缩包
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux'],
    },
  ],
  plugins: [
    // Webpack 插件 - 用于打包主进程和渲染进程
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        // 开发服务器端口（避免与主项目端口 3000 冲突）
        port: 3010,
        // 主进程 Webpack 配置
        mainConfig: './webpack.main.config.js',
        icon: './build/icon.ico',
        // 渲染进程 Webpack 配置
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              name: 'main_window',
              html: './src/renderer/index.html',
              js: './src/renderer/index.tsx',
              preload: {
                js: './src/preload/index.ts',
              },
            },
          ],
        },
      },
    },
    // 自动解压原生模块（如 clipboardy）
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses 用于在打包时启用/禁用 Electron 功能
    // 这些配置在代码签名之前应用
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

// Webpack 魔法常量类型声明
// 这些常量由 @electron-forge/plugin-webpack 在构建时自动注入

// 渲染进程入口 URL (对应 forge.config.js 中 entryPoints 的 name: 'main_window')
declare const MAIN_WINDOW_WEBPACK_ENTRY: string;

// Preload 脚本路径
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;


import { ChatMessage } from '@/types/api';
import { nanoid } from 'nanoid';

/**
 * 模拟的面试聊天消息数据
 * 用于开发环境中测试 UI 效果
 */
export const mockInterviewMessages: ChatMessage[] = [
    // 1. 面试官的第一个问题（已识别，未发送）
//     {
//         id: nanoid(),
//         role: 'user',
//         content: '请先做一下自我介绍，包括你的教育背景和工作经历。',
//         date: new Date(Date.now() - 600000).toISOString(), // 10分钟前
//         status: 'sent',
//         speaker: 'interviewer',
//     },

//     // 2. AI 助手的第一个回答（已发送）
//     {
//         id: nanoid(),
//         role: 'assistant',
//         content: `
// - 本科毕业于**清华大学计算机科学与技术专业**
// - 研究生就读于**北京大学软件工程专业**
// - 在校期间多次获得奖学金，参与过多个科研项目

// ### 工作经历
// 1. **字节跳动** - 高级前端工程师（2021-2023）
//    - 负责抖音直播间核心功能开发
//    - 优化页面性能，首屏加载时间降低40%
//    - 带领团队完成了多个重要项目

// 2. **腾讯** - 前端工程师（2019-2021）
//    - 参与微信小程序开发
//    - 使用 React/Vue 构建企业级应用


// - 精通 \`React\`、\`Vue\`、\`TypeScript\` 等前端技术栈
// - 熟悉前端工程化和性能优化
// - 具备良好的团队协作能力

// 期待能为贵公司贡献我的专业能力！`,
//         date: new Date(Date.now() - 590000).toISOString(),
//         status: 'sent',
//     },

//     // 3. 面试者的补充（识别中...）
//     {
//         id: nanoid(),
//         role: 'user',
//         content: '另外，我还参加过多个开源项目...',
//         date: new Date(Date.now() - 580000).toISOString(),
//         status: 'sent',
//         speaker: 'interviewee',
//     },

//     // 4. 面试官追问技术问题（已识别）
//     {
//         id: nanoid(),
//         role: 'user',
//         content: '能说说你对 React Hooks 的理解吗？特别是 useEffect 的使用场景和注意事项。',
//         date: new Date(Date.now() - 400000).toISOString(),
//         status: 'sent',
//         speaker: 'interviewer',
//     },

//     // 5. AI 助手的技术回答（包含代码示例）
//     {
//         id: nanoid(),
//         role: 'assistant',
//         content: `关于 React Hooks 的理解，我可以从以下几个方面来回答：

// ## 一、React Hooks 基本概念

// React Hooks 是 React 16.8 引入的新特性，它允许你在**不编写 class 的情况下使用 state 和其他 React 特性**。

// ## 二、useEffect 的核心作用

// \`useEffect\` 用于处理副作用（side effects），比如：
// - 数据获取
// - 订阅/取消订阅
// - DOM 操作
// - 定时器

// ## 三、使用示例

// \`\`\`typescript
// import { useEffect, useState } from 'react';

// function UserProfile({ userId }: { userId: number }) {
//   const [user, setUser] = useState(null);
//   const [loading, setLoading] = useState(true);

//   useEffect(() => {
//     // 1. 副作用函数：获取用户数据
//     let isCancelled = false;
    
//     const fetchUser = async () => {
//       setLoading(true);
//       try {
//         const response = await fetch(\`/api/users/\${userId}\`);
//         const data = await response.json();
        
//         // 避免在组件卸载后更新状态
//         if (!isCancelled) {
//           setUser(data);
//         }
//       } catch (error) {
//         console.error('获取用户失败:', error);
//       } finally {
//         if (!isCancelled) {
//           setLoading(false);
//         }
//       }
//     };

//     fetchUser();

//     // 2. 清理函数：组件卸载时取消请求
//     return () => {
//       isCancelled = true;
//     };
//   }, [userId]); // 3. 依赖数组：userId 变化时重新执行

//   if (loading) return <div>加载中...</div>;
//   return <div>{user?.name}</div>;
// }
// \`\`\`

// ## 四、重要注意事项

// ### 1. 依赖数组的正确使用
// - **空数组 \`[]\`**: 只在组件挂载时执行一次
// - **不传**: 每次渲染都执行（谨慎使用）
// - **包含依赖**: 依赖变化时才执行

// ### 2. 清理函数的重要性
// \`\`\`typescript
// useEffect(() => {
//   // 订阅事件
//   const subscription = eventEmitter.subscribe();
  
//   // 返回清理函数
//   return () => {
//     subscription.unsubscribe(); // 避免内存泄漏
//   };
// }, []);
// \`\`\`

// ### 3. 避免无限循环
// \`\`\`typescript
// // ❌ 错误示例：会导致无限循环
// useEffect(() => {
//   setCount(count + 1); // 每次 count 变化都会触发
// }, [count]);

// // ✅ 正确示例：使用函数式更新
// useEffect(() => {
//   setCount(c => c + 1); // 不依赖 count
// }, []);
// \`\`\`

// ### 4. 异步处理
// \`\`\`typescript
// // ❌ 错误：useEffect 不能直接使用 async
// useEffect(async () => {
//   await fetchData();
// }, []);

// // ✅ 正确：在内部定义异步函数
// useEffect(() => {
//   const loadData = async () => {
//     await fetchData();
//   };
//   loadData();
// }, []);
// \`\`\`

// ## 五、常见使用场景

// 1. **数据获取**: API 请求
// 2. **事件监听**: window resize、scroll 等
// 3. **定时器**: setTimeout、setInterval
// 4. **第三方库集成**: 初始化图表库等
// 5. **localStorage 同步**: 持久化状态

// 以上就是我对 React Hooks 和 useEffect 的理解！`,
//         date: new Date(Date.now() - 390000).toISOString(),
//         status: 'sent',
//     },


    // 11. 面试官询问团队协作（新消息 - 已识别）
    {
        id: nanoid(),
        role: 'user',
        content: '在团队协作中，你遇到过哪些挑战？是如何解决的？',
        date: new Date(Date.now() - 30000).toISOString(),
        status: 'received',
        speaker: 'interviewer',
    },

    // 12. 面试官询问技术选型（新消息 - 已识别）
    {
        id: nanoid(),
        role: 'user',
        content: '在项目中，你是如何进行技术选型的？能举个具体的例子吗？你了解React Hooks吗？以及redux的实现原理？',
        date: new Date(Date.now() - 20000).toISOString(),
        status: 'received',
        speaker: 'interviewer',
    },

    // 13. 面试官询问职业规划（新消息 - 已识别）
    {
        id: nanoid(),
        role: 'user',
        content: '最后，能谈谈你未来3-5年的职业规划吗？',
        date: new Date(Date.now() - 10000).toISOString(),
        status: 'received',
        speaker: 'interviewer',
    },
];


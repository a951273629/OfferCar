// 状态选项
export const STATUS_OPTIONS = [
  { label: '待开始', value: 'pending' },
  { label: '进行中', value: 'in_progress' },
  { label: '已完成', value: 'completed' },
] as const;

// 语音识别和答题语言
export const LANGUAGE_OPTIONS = [
  { label: '中文', value: 'zh' },
  { label: '英语', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '法语', value: 'fr' },
  { label: '德语', value: 'de' },
] as const;

// 编程语言
export const PROGRAMMING_LANGUAGE_OPTIONS = [
  { label: 'JavaScript', value: 'javascript' },
  { label: 'TypeScript', value: 'typescript' },
  { label: 'Python', value: 'python' },
  { label: 'Java', value: 'java' },
  { label: 'C++', value: 'cpp' },
  { label: 'C#', value: 'csharp' },
  { label: 'Go', value: 'go' },
  { label: 'Rust', value: 'rust' },
  { label: 'PHP', value: 'php' },
  { label: 'Ruby', value: 'ruby' },
  { label: 'Swift', value: 'swift' },
  { label: 'Kotlin', value: 'kotlin' },
  { label: '其他', value: 'other' },
] as const;

// 面试类型
export const INTERVIEW_TYPE_OPTIONS = [
  { label: '技术面试', value: 'technical' },
  { label: '主管面试', value: 'managerial' },
  { label: 'HR面试', value: 'hr' },
] as const;

// 状态颜色
export const STATUS_COLORS = {
  pending: 'default',
  in_progress: 'processing',
  completed: 'success',
} as const;

// 状态中文
export const STATUS_TEXT = {
  pending: '待开始',
  in_progress: '进行中',
  completed: '已完成',
} as const;

// 语言中文
export const LANGUAGE_TEXT = {
  zh: '中文',
  en: '英语',
  ja: '日语',
  fr: '法语',
  de: '德语',
} as const;

// 编程语言中文
export const PROGRAMMING_LANGUAGE_TEXT = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  csharp: 'C#',
  go: 'Go',
  rust: 'Rust',
  php: 'PHP',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
  other: '其他',
} as const;

// 面试类型中文
export const INTERVIEW_TYPE_TEXT = {
  technical: '技术面试',
  managerial: '主管面试',
  hr: 'HR面试',
} as const;

// 知识库文件类型中文
export const KNOWLEDGE_FILE_TYPE_TEXT = {
  txt: 'TXT 文本',
  md: 'Markdown',
} as const;

// 知识库状态中文
export const KNOWLEDGE_STATUS_TEXT = {
  active: '启用',
  archived: '归档',
} as const;

// 知识库文件类型选项
export const KNOWLEDGE_FILE_TYPE_OPTIONS = [
  { label: 'TXT 文本', value: 'txt' },
  { label: 'Markdown', value: 'md' },
];

// 知识库状态选项
export const KNOWLEDGE_STATUS_OPTIONS = [
  { label: '启用', value: 'active' },
  { label: '归档', value: 'archived' },
] as const;


import { z } from 'zod';

// 发送验证码验证
export const sendOTPSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
});

// 用户登录验证（使用验证码）
export const loginSchema = z.object({
  email: z.string().email('请输入有效的邮箱地址'),
  code: z.string().length(6, '验证码必须是6位数字').regex(/^\d{6}$/, '验证码必须是6位数字'),
});

// 面试创建验证
export const interviewCreateSchema = z.object({
  title: z.string().min(1, '请输入标题').max(255, '标题最多255个字符'),
  description: z.string().max(2000, '描述最多2000个字符').optional().default(''),
  position: z.string().min(1, '请输入职位').max(100, '职位最多100个字符'),
  language: z.enum(['zh', 'en', 'ja', 'fr', 'de'], {
    errorMap: () => ({ message: '请选择有效的语言' }),
  }),
  programming_language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'other'], {
    errorMap: () => ({ message: '请选择有效的编程语言' }),
  }).optional(),
  interview_type: z.enum(['technical', 'managerial', 'hr'], {
    errorMap: () => ({ message: '请选择有效的面试类型' }),
  }),
  resume_url: z.string().optional(),  // TODO: 实现文件上传后改回 .url() 验证
  job_description: z.string().max(5000, '招聘信息最多5000个字符').optional(),
  default_session_config_json: z.string().max(50000, '配置过大').optional(),
});

// 面试更新验证
export const interviewUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  position: z.string().min(1).max(100).optional(),
  language: z.enum(['zh', 'en', 'ja', 'fr', 'de']).optional(),
  programming_language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'other']).optional(),
  interview_type: z.enum(['technical', 'managerial', 'hr']).optional(),
  resume_url: z.string().optional(),
  job_description: z.string().max(5000).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});

// 笔试创建验证
export const examCreateSchema = z.object({
  title: z.string().min(1, '请输入标题').max(255, '标题最多255个字符'),
  description: z.string().max(2000, '描述最多2000个字符').optional().default(''),
  position: z.string().min(1, '请输入职位').max(100, '职位最多100个字符'),
  language: z.enum(['zh', 'en', 'ja', 'fr', 'de'], {
    errorMap: () => ({ message: '请选择有效的回答语言' }),
  }),
  programming_language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'other'], {
    errorMap: () => ({ message: '请选择有效的编程语言' }),
  }).optional(),
  default_session_config_json: z.string().max(50000, '配置过大').optional(),
});

// 笔试更新验证
export const examUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  position: z.string().min(1).max(100).optional(),
  language: z.enum(['zh', 'en', 'ja', 'fr', 'de']).optional(),
  programming_language: z.enum(['javascript', 'typescript', 'python', 'java', 'cpp', 'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'other']).optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional(),
});


-- 创建数据库
CREATE DATABASE IF NOT EXISTS ai_interview DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE ai_interview;

-- account表 (better-auth)
CREATE TABLE `account` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accountId` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `providerId` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessToken` text COLLATE utf8mb4_unicode_ci,
  `refreshToken` text COLLATE utf8mb4_unicode_ci,
  `idToken` text COLLATE utf8mb4_unicode_ci,
  `accessTokenExpiresAt` timestamp(3) NULL DEFAULT NULL,
  `refreshTokenExpiresAt` timestamp(3) NULL DEFAULT NULL,
  `scope` text COLLATE utf8mb4_unicode_ci,
  `password` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `account_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- email_verification_codes表
CREATE TABLE `email_verification_codes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `code` varchar(6) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expires_at` timestamp NOT NULL,
  `used` tinyint(1) DEFAULT '0',
  `attempts` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_email` (`email`),
  KEY `idx_expires_at` (`expires_at`),
  KEY `idx_email_used` (`email`,`used`)
) ENGINE=InnoDB AUTO_INCREMENT=77 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- chat_histories表
CREATE TABLE `chat_histories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `interview_id` int NOT NULL COMMENT '关联的面试 ID',
  `question` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户提问内容',
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI 回答内容',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_interview_id` (`interview_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `chat_histories_ibfk_1` FOREIGN KEY (`interview_id`) REFERENCES `interviews` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_histories_user_id_auth_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=123 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- client_downloads表
CREATE TABLE `client_downloads` (
  `id` int NOT NULL AUTO_INCREMENT,
  `download_type` enum('local','external') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '下载类型：local=本地文件, external=外部链接',
  `download_url` varchar(2000) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '下载URL（本地：/downloads/xxx.msi，外部：https://...）',
  `file_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件名',
  `version` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '版本号',
  `is_active` tinyint(1) DEFAULT '1' COMMENT '是否为当前激活版本',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_at` (`created_at` DESC)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='客户端下载配置表';

-- exam_chat_histories表
CREATE TABLE `exam_chat_histories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL COMMENT '关联的笔试 ID',
  `question` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '用户问题内容',
  `question_image` longtext COLLATE utf8mb4_unicode_ci COMMENT '截图 Base64 数据（可选）',
  `answer` text COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'AI 回答内容',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `exam_chat_histories_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_exam_chat_histories_user_id_auth_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='笔试聊天历史记录表';

-- exam_knowledge_bases表
CREATE TABLE `exam_knowledge_bases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `knowledge_base_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_exam_kb` (`exam_id`,`knowledge_base_id`),
  KEY `idx_exam_id` (`exam_id`),
  KEY `idx_knowledge_base_id` (`knowledge_base_id`),
  CONSTRAINT `exam_knowledge_bases_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `exam_knowledge_bases_ibfk_2` FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='笔试-知识库关联表';

-- exam_sessions表
CREATE TABLE `exam_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `exam_id` int NOT NULL,
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `answers` text COLLATE utf8mb4_unicode_ci,
  `score` int DEFAULT NULL,
  `feedback` text COLLATE utf8mb4_unicode_ci,
  `session_config_json` text COLLATE utf8mb4_unicode_ci COMMENT '会话配置(JSON)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_exam_id` (`exam_id`),
  CONSTRAINT `exam_sessions_ibfk_1` FOREIGN KEY (`exam_id`) REFERENCES `exams` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- exams表
CREATE TABLE `exams` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `position` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` enum('zh','en','ja','fr','de') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'zh' COMMENT '回答语言',
  `programming_language` enum('javascript','typescript','python','java','cpp','csharp','go','rust','php','ruby','swift','kotlin','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '编程语言',
  `status` enum('pending','in_progress','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `default_session_config_json` text COLLATE utf8mb4_unicode_ci COMMENT '默认会话配置(JSON)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_exams_user_id_auth_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- interview_knowledge_bases表
CREATE TABLE `interview_knowledge_bases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `interview_id` int NOT NULL,
  `knowledge_base_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_interview_kb` (`interview_id`,`knowledge_base_id`),
  KEY `idx_interview_id` (`interview_id`),
  KEY `idx_knowledge_base_id` (`knowledge_base_id`),
  CONSTRAINT `interview_knowledge_bases_ibfk_1` FOREIGN KEY (`interview_id`) REFERENCES `interviews` (`id`) ON DELETE CASCADE,
  CONSTRAINT `interview_knowledge_bases_ibfk_2` FOREIGN KEY (`knowledge_base_id`) REFERENCES `knowledge_bases` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='面试-知识库关联表';

-- interview_sessions表
CREATE TABLE `interview_sessions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `interview_id` int NOT NULL,
  `start_time` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `end_time` timestamp NULL DEFAULT NULL,
  `transcript` text COLLATE utf8mb4_unicode_ci,
  `score` int DEFAULT NULL,
  `feedback` text COLLATE utf8mb4_unicode_ci,
  `session_config_json` text COLLATE utf8mb4_unicode_ci COMMENT '会话配置(JSON)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_interview_id` (`interview_id`),
  CONSTRAINT `interview_sessions_ibfk_1` FOREIGN KEY (`interview_id`) REFERENCES `interviews` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=197 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- interviews表
CREATE TABLE `interviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `position` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `language` enum('zh','en','ja','fr','de') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'zh' COMMENT '语音识别和答题语言',
  `programming_language` enum('javascript','typescript','python','java','cpp','csharp','go','rust','php','ruby','swift','kotlin','other') COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '编程语言',
  `interview_type` enum('technical','managerial','hr') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'technical' COMMENT '面试类型',
  `resume_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '简历文件URL',
  `resume_content` text COLLATE utf8mb4_unicode_ci COMMENT '简历文本内容',
  `job_description` text COLLATE utf8mb4_unicode_ci COMMENT '招聘信息',
  `status` enum('pending','in_progress','completed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'pending',
  `default_session_config_json` text COLLATE utf8mb4_unicode_ci COMMENT '默认会话配置(JSON)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_interviews_user_id_auth_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- knowledge_bases表
CREATE TABLE `knowledge_bases` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '知识库标题',
  `description` text COLLATE utf8mb4_unicode_ci COMMENT '知识库描述',
  `content` longtext COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '知识库内容（最多2万字）',
  `file_type` enum('txt','md') COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '文件类型',
  `tags` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '标签（JSON数组）',
  `is_official` tinyint(1) DEFAULT '0' COMMENT '是否为官方知识库',
  `word_count` int DEFAULT '0' COMMENT '字数统计',
  `status` enum('active','archived') COLLATE utf8mb4_unicode_ci DEFAULT 'active' COMMENT '状态',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_is_official` (`is_official`),
  KEY `idx_status` (`status`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `fk_knowledge_bases_user_id_auth_user` FOREIGN KEY (`user_id`) REFERENCES `user` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库表';

-- session表 (better-auth)
CREATE TABLE `session` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` timestamp(3) NOT NULL,
  `token` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL,
  `ipAddress` text COLLATE utf8mb4_unicode_ci,
  `userAgent` text COLLATE utf8mb4_unicode_ci,
  `userId` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `session_userId_idx` (`userId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user表 (better-auth)
CREATE TABLE `user` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `emailVerified` tinyint(1) NOT NULL,
  `image` text COLLATE utf8mb4_unicode_ci,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- user_profile表 (业务扩展，移除商业化字段)
CREATE TABLE `user_profile` (
  `auth_user_id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) DEFAULT '1' COMMENT '用户状态（启用/禁用）',
  `global_config_json` text CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT '用户全局配置(JSON)',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`auth_user_id`),
  KEY `idx_is_active` (`is_active`),
  CONSTRAINT `fk_user_profile_auth_user` FOREIGN KEY (`auth_user_id`) REFERENCES `user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='业务用户扩展表（以 better-auth.user 为主键）';

-- verification表 (better-auth)
CREATE TABLE `verification` (
  `id` varchar(36) COLLATE utf8mb4_unicode_ci NOT NULL,
  `identifier` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `value` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `expiresAt` timestamp(3) NOT NULL,
  `createdAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `verification_identifier_idx` (`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

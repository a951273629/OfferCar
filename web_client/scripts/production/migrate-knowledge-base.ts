// 知识库功能数据库迁移脚本
// 用法: npx tsx scripts/migrate-knowledge-base.ts

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config({ path: '.env.local' });

async function migrate() {
  console.log('🚀 开始迁移知识库表...\n');

  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'ai_interview',
  });

  try {
    console.log('✅ 已连接到数据库:', process.env.DATABASE_NAME);

    // 创建知识库表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS knowledge_bases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT COMMENT '用户ID（NULL表示官方知识库）',
        title VARCHAR(255) NOT NULL COMMENT '知识库标题',
        description TEXT COMMENT '知识库描述',
        content LONGTEXT NOT NULL COMMENT '知识库内容（最多2万字）',
        file_type ENUM('txt', 'md') NOT NULL COMMENT '文件类型',
        tags VARCHAR(500) COMMENT '标签（JSON数组）',
        is_official BOOLEAN DEFAULT FALSE COMMENT '是否为官方知识库',
        word_count INT DEFAULT 0 COMMENT '字数统计',
        status ENUM('active', 'archived') DEFAULT 'active' COMMENT '状态',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id),
        INDEX idx_is_official (is_official),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='知识库表';
    `);
    console.log('✅ 知识库表创建成功');

    // 创建面试-知识库关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS interview_knowledge_bases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        interview_id INT NOT NULL,
        knowledge_base_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (interview_id) REFERENCES interviews(id) ON DELETE CASCADE,
        FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        UNIQUE KEY unique_interview_kb (interview_id, knowledge_base_id),
        INDEX idx_interview_id (interview_id),
        INDEX idx_knowledge_base_id (knowledge_base_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='面试-知识库关联表';
    `);
    console.log('✅ 面试-知识库关联表创建成功');

    // 创建笔试-知识库关联表
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS exam_knowledge_bases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        exam_id INT NOT NULL,
        knowledge_base_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id) ON DELETE CASCADE,
        UNIQUE KEY unique_exam_kb (exam_id, knowledge_base_id),
        INDEX idx_exam_id (exam_id),
        INDEX idx_knowledge_base_id (knowledge_base_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='笔试-知识库关联表';
    `);
    console.log('✅ 笔试-知识库关联表创建成功');

    // 插入示例官方知识库（可选）
    const sampleKnowledgeBase = {
      title: 'OfferCar 使用指南',
      description: '关于 OfferCar 的常见问题和使用技巧',
      content: `
Q: 什么是 OfferCar？
A: OfferCar 是一款 AI 面试助手，帮助求职者更好地准备面试，提供实时的面试辅导和建议。

Q: 知识库有什么用？
A: 知识库可以为 AI 提供特定领域的知识，使 AI 的回答更加精准和有针对性。您可以上传面试相关资料、企业信息、专业知识等。

Q: 支持哪些文件格式？
A: 目前支持 TXT 和 Markdown（.md）格式的文件。

Q: 知识库内容有字数限制吗？
A: 建议控制在 5000 字左右，最多不超过 2 万字符，以获得最佳效果。

Q: 如何创建知识库？
A: 点击"新建知识库"或"上传文件"按钮，填写标题、描述和内容，或直接上传文本文件。

Q: 知识库如何与面试关联？
A: 在创建或编辑面试时，可以选择要使用的知识库。面试过程中，AI 会参考这些知识库提供更精准的建议。

Q: 什么是官方知识库？
A: 官方知识库由 OfferCar 团队维护，包含通用的面试技巧和最佳实践，所有用户均可使用。

Q: HTTP/2 的缺点有哪些？
A: HTTP/2 只解决了应用层的 HTTP 队头阻塞问题，没有解决传输层 TCP 的队头阻塞问题。TCP 处理帧的时候并不知道这些帧是跟谁一对的，还是按照自己的数据段来发送，所以当数据包丢失时，它会等待重传，导致 TCP 队头阻塞。
      `.trim(),
      file_type: 'txt',
      tags: JSON.stringify(['OfferCar', '使用指南', '面试技巧']),
      is_official: true,
      word_count: 300,
    };

    const [rows] = await connection.execute<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as count FROM knowledge_bases WHERE is_official = TRUE'
    );
    
    if (rows[0].count === 0) {
      await connection.execute(
        `INSERT INTO knowledge_bases 
        (user_id, title, description, content, file_type, tags, is_official, word_count) 
        VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sampleKnowledgeBase.title,
          sampleKnowledgeBase.description,
          sampleKnowledgeBase.content,
          sampleKnowledgeBase.file_type,
          sampleKnowledgeBase.tags,
          sampleKnowledgeBase.is_official,
          sampleKnowledgeBase.word_count,
        ]
      );
      console.log('✅ 示例官方知识库插入成功');
    } else {
      console.log('ℹ️  官方知识库已存在，跳过插入');
    }

    console.log('🎉 知识库功能迁移完成！');
  } catch (error) {
    console.error('\n❌ 迁移失败:', error);
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  } finally {
    await connection.end();
    console.log('\n🔌 数据库连接已关闭');
  }
}

// 执行迁移
migrate();


import mysql from 'mysql2/promise';

// 数据库连接配置
const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT),
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};
// DATABASE_USER=xiaoming
// DATABASE_PASSWORD=offermax
// DATABASE_NAME=ai_interview
// 创建连接池
let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

// 获取数据库连接
export async function getConnection(): Promise<mysql.PoolConnection> {
  const pool = getPool();
  return await pool.getConnection();
}

// 执行查询
export async function query<T = unknown>(
  sql: string,
  params?: unknown[]
): Promise<T> {
  const pool = getPool();
  const [rows] = await pool.execute(sql, params);
  return rows as T;
}

// 关闭连接池
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}


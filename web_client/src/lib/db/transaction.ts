import mysql from 'mysql2/promise';
import { getPool } from './index';

/**
 * 事务执行结果
 */
export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 执行数据库事务
 * 遵循 Early Return 原则和统一的错误处理
 * 
 * @param callback 事务回调函数，接收数据库连接作为参数
 * @returns 事务执行结果
 */
export async function executeTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    
    const result = await callback(connection);
    
    await connection.commit();
    
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * 在事务连接中执行查询
 * 
 * @param connection 数据库连接
 * @param sql SQL语句
 * @param params 参数
 * @returns 查询结果
 */
export async function queryInTransaction<T = unknown>(
  connection: mysql.PoolConnection,
  sql: string,
  params?: unknown[]
): Promise<T> {
  const [rows] = await connection.execute(sql, params);
  return rows as T;
}


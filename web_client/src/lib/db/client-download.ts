import { getPool } from './index';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

// 客户端下载配置接口
export interface ClientDownload {
  id: number;
  download_type: 'local' | 'external';
  download_url: string;
  file_name: string;
  version: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// 创建下载配置的参数接口
export interface CreateDownloadParams {
  download_type: 'local' | 'external';
  download_url: string;
  file_name: string;
  version: string;
}

/**
 * 获取当前激活的下载配置
 */
export async function getActiveDownload(): Promise<ClientDownload | null> {
  const pool = getPool();
  
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM client_downloads WHERE is_active = TRUE ORDER BY created_at DESC LIMIT 1'
    );

    if (rows.length === 0) {
      return null;
    }

    return rows[0] as ClientDownload;
  } catch (error) {
    console.error('获取激活的下载配置错误:', error);
    throw new Error('获取下载配置失败');
  }
}

/**
 * 创建新的下载配置（并停用旧配置）
 */
export async function createDownload(params: CreateDownloadParams): Promise<ClientDownload> {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 停用所有旧配置
    await connection.query(
      'UPDATE client_downloads SET is_active = FALSE WHERE is_active = TRUE'
    );

    // 创建新配置
    const [result] = await connection.query<ResultSetHeader>(
      `INSERT INTO client_downloads (download_type, download_url, file_name, version, is_active)
       VALUES (?, ?, ?, ?, TRUE)`,
      [params.download_type, params.download_url, params.file_name, params.version]
    );

    await connection.commit();

    // 查询新创建的记录
    const [rows] = await connection.query<RowDataPacket[]>(
      'SELECT * FROM client_downloads WHERE id = ?',
      [result.insertId]
    );

    return rows[0] as ClientDownload;
  } catch (error) {
    await connection.rollback();
    console.error('创建下载配置错误:', error);
    throw new Error('创建下载配置失败');
  } finally {
    connection.release();
  }
}

/**
 * 删除下载配置
 */
export async function deleteDownload(id: number): Promise<void> {
  const pool = getPool();

  try {
    await pool.query('DELETE FROM client_downloads WHERE id = ?', [id]);
  } catch (error) {
    console.error('删除下载配置错误:', error);
    throw new Error('删除下载配置失败');
  }
}

/**
 * 获取所有下载配置（包括历史记录）
 */
export async function getAllDownloads(): Promise<ClientDownload[]> {
  const pool = getPool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM client_downloads ORDER BY created_at DESC'
    );

    return rows as ClientDownload[];
  } catch (error) {
    console.error('获取所有下载配置错误:', error);
    throw new Error('获取下载配置列表失败');
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getActiveDownload } from '@/lib/db/client-download';
import { ApiResponse } from '@/types';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// GET - 获取下载链接并302重定向
export async function GET(request: NextRequest) {
  try {
    // 从数据库获取当前激活的下载配置
    const activeDownload = await getActiveDownload();

    if (!activeDownload) {
      // 如果数据库中没有配置，返回错误
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '客户端下载链接暂未配置，请联系管理员',
        },
        { status: 404 }
      );
    }

    // 记录下载日志
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';
    console.log(`客户端下载 - IP: ${ip}, User-Agent: ${userAgent}, 版本: ${activeDownload.version}, 类型: ${activeDownload.download_type}, 时间: ${new Date().toISOString()}`);

    // 构建完整的下载URL
    let downloadUrl = activeDownload.download_url;

    // 如果是本地文件，需要转换为完整URL
    if (activeDownload.download_type === 'local') {
      const protocol = request.headers.get('x-forwarded-proto') || 'http';
      const host = request.headers.get('host') || 'localhost:3000';
      downloadUrl = `${protocol}://${host}${activeDownload.download_url}`;
    }

    // 302重定向到下载地址
    return NextResponse.redirect(downloadUrl, 302);
  } catch (error) {
    console.error('获取下载链接错误:', error);
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '获取下载链接失败，请重试',
      },
      { status: 500 }
    );
  }
}

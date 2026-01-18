import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { getActiveDownload } from '@/lib/db/client-download';

// 强制动态渲染
export const dynamic = 'force-dynamic';

// GET - 下载客户端安装包
export async function GET(request: NextRequest) {
  try {
    const filePath = join(process.cwd(), 'public', 'downloads', 'OfferCar-AI.msi');

    // 检查文件是否存在
    if (!existsSync(filePath)) {
      console.error('客户端安装包不存在:', filePath);
      return NextResponse.json(
        {
          success: false,
          error: '客户端安装包暂未上传，请联系管理员',
        },
        { status: 404 }
      );
    }

    // 读取文件
    const fileBuffer = await readFile(filePath);

    // 记录下载日志
    const userAgent = request.headers.get('user-agent') || 'Unknown';
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Unknown';
    console.log(`客户端下载 - IP: ${ip}, User-Agent: ${userAgent}, 时间: ${new Date().toISOString()}`);

    // 返回文件流
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-msi',
        'Content-Disposition': 'attachment; filename="OfferCar-AI.msi"',
        'Content-Length': fileBuffer.length.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('下载客户端安装包错误:', error);
    return NextResponse.json(
      {
        success: false,
        error: '下载失败，请重试',
      },
      { status: 500 }
    );
  }
}

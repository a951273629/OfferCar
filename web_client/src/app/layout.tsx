import type { Metadata, Viewport } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'OfferCar AI - AI 面试笔试助手 | 智能面试模拟平台',
  description: 'OfferCar AI 是一款专业的 AI 驱动面试笔试平台，提供智能面试模拟、在线笔试、实时 AI 辅助，帮助求职者高效准备技术面试，提升面试通过率',
  keywords: ['AI面试', '面试助手', '笔试平台', '面试模拟', 'AI辅助', '技术面试', '求职准备', 'OfferCar', '在线面试', '智能面试'],
  authors: [{ name: 'OfferCar AI Team' }],
  creator: 'OfferCar AI',
  publisher: 'OfferCar AI',
  
  // 图标配置
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
  },
  
  // Open Graph 社交媒体分享配置
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    url: 'https://www.offerstar.cn',
    siteName: 'OfferCar AI',
    title: 'OfferCar AI - AI 面试笔试助手',
    description: 'AI 驱动的面试和笔试平台，助您高效准备求职面试，提升面试通过率',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'OfferCar AI 面试平台',
      },
    ],
  },
  
  // Twitter Card 配置
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'OfferCar AI - AI 面试笔试助手',
  //   description: 'AI 驱动的面试和笔试平台，助您高效准备求职面试',
  //   images: ['/og-image.png'],
  // },
  
  // 其他 SEO 优化
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
      </body>
    </html>
  );
}


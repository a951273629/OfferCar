'use client';

import { Button, Space } from 'antd';
import {
  VideoCameraOutlined,
  FileTextOutlined,
  RobotOutlined,
  ThunderboltOutlined,
  StarFilled,
  FireOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import Image from 'next/image';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import styles from './page.module.css';

export default function HomePage() {
  const features = [
    {
      icon: <VideoCameraOutlined />,
      title: 'AI 面试模式',
      description: '模拟真实面试场景，AI 面试官实时提问和反馈，支持多轮深度对话。',
    },
    {
      icon: <FileTextOutlined />,
      title: '海量笔试题库',
      description: '覆盖主流大厂真题，针对性强化薄弱环节。',
    },
    {
      icon: <RobotOutlined />,
      title: '多语言语音识别',
      description: '实时精准转录，支持中英日等多国语言自然交流。',
    },
    {
      icon: <ThunderboltOutlined />,
      title: '秒级智能反馈',
      description: '面试结束后即刻生成详细评估报告与改进建议。',
    },
  ];

  const platforms = [
    { name: 'Zoom', image: '/images/meeting_zoom.png' },
    { name: '腾讯会议', image: '/images/meeting_tencent.png' },
    { name: 'Microsoft Teams', image: '/images/meeting_teams.png' },
    { name: 'Google Meet', image: '/images/meeting_google_meet.png' },
    { name: 'Skype', image: '/images/meeting_skype.png' },
    { name: '飞书会议', image: '/images/meeting_feishu.png' },
    { name: '钉钉', image: '/images/dingding.png' },
    { name: '企业微信', image: '/images/qywx.png' },
    { name: 'Slack', image: '/images/slack.png' },
    { name: 'LeetCode', image: '/images/lk.png' },
  ];

  const testimonials = [
    {
      quote: '是真牛逼！八股文直接杀了，面试官问啥啥都能扯上点技术，但还是感觉有点虚，看自己怎么用吧，哈哈哈哈。',
      author: '匿名用户',
      role: '前端工程师',
      rating: 5,
    },
    {
      quote: '之前面试老紧张，靠这玩意是真的过了好几轮，连我自己都不敢相信，太强了。',
      author: '匿名用户',
      role: '转行 IT',
      rating: 5,
    },
    {
      quote: '比看网上那些乱七八糟的面试经强多了，用了个把周就拿了3个offer，我赚！',
      author: '匿名用户',
      role: '跳槽达人',
      rating: 5,
    },
    {
      quote: '应届校招，之前面试总是紧张说不出话，用这个练了练，自信多了。',
      author: '匿名用户',
      role: '应届生',
      rating: 5,
    },
  ];

  const stats = [
    { number: '10k+', label: '活跃用户' },
    { number: '50k+', label: '模拟面试' },
    { number: '1.2s', label: 'AI 响应速度' },
    { number: '90%', label: '面试通过率' },
  ];

  return (
    <div className={styles.pageContainer}>
      <Header />

      {/* Hero Section */}
      <div className={styles.heroSection}>
        <div className={styles.heroGlow} />
        <h1 className={styles.heroTitle}>
          OfferCar AI <br />
          <span className={styles.gradientText}>面试笔试直通车</span>
        </h1>
        <p className={styles.heroSubtitle}>
          全平台兼容的 AI 智能助手，秒杀八股文与算法题。<br />
          支持十国语言语音识别，助你轻松拿下 Offer。
        </p>
        
        <div className={styles.heroButtons}>
          <Link href="/interview">
            <Button 
              type="primary" 
              size="large" 
              style={{ 
                height: 56, 
                padding: '0 48px', 
                fontSize: '18px',
                background: 'var(--gradient-primary)',
                border: 'none',
                boxShadow: 'var(--shadow-button-primary)'
              }}
            >
              立即开始
            </Button>
          </Link>
          <Link href={`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/quick-start/intro`}>
            <Button 
              size="large" 
              ghost
              style={{ 
                height: 56, 
                padding: '0 48px',
                fontSize: '18px',
                color: 'var(--color-text-base)',
                borderColor: 'var(--color-border)'
              }}
            >
              使用文档
            </Button>
          </Link>
        </div>

        <p style={{ marginTop: 32, opacity: 0.6 }}>
          支持 Windows / macOS 客户端 
          <Link href= {`${process.env.NEXT_PUBLIC_DOCS_URL}/docs/installation`}target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-neon-blue)', marginLeft: 8 }}>
            点击下载 &gt;
          </Link>
          
        </p>
      </div>

      {/* Infinite Marquee Platforms */}
      <div className={styles.platformSection}>
        <div className={styles.marqueeContainer}>
          {/* Render twice for infinite loop effect */}
          {[...platforms, ...platforms, ...platforms].map((platform, index) => (
            <div key={`${platform.name}-${index}`} className={styles.platformItem}>
              <Image
                src={platform.image}
                alt={platform.name}
                width={48}
                height={48}
                style={{ objectFit: 'contain' }}
              />
              <span className={styles.platformName}>{platform.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section (Bento Grid) */}
      <div className={styles.featuresSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>核心功能</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>全方位辅助你的求职之路</p>
        </div>
        <div className={styles.bentoGrid}>
          {features.map((feature, index) => (
            <div 
              key={index} 
              className={styles.glassCard}
            >
              <div className={styles.featureIcon}>{feature.icon}</div>
              <h3 className={styles.featureTitle}>{feature.title}</h3>
              <p className={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Section */}
      <div className={styles.statsSection}>
        {stats.map((stat, index) => (
          <div key={index} className={styles.statCard}>
            <div className={styles.statNumber}>{stat.number}</div>
            <div className={styles.statLabel}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Testimonials Section */}
      <div className={styles.testimonialSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            <FireOutlined style={{ color: 'var(--color-error)', marginRight: 12 }} />
            用户反馈
          </h2>
        </div>
        <div className={styles.testimonialGrid}>
          {testimonials.map((testimonial, index) => (
            <div key={index} className={styles.glassCard}>
              <div className={styles.quoteText}>"{testimonial.quote}"</div>
              <div className={styles.authorInfo}>
                <div style={{ 
                  width: 40, height: 40, background: 'var(--avatar-bg)', borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--avatar-text)', fontWeight: 'bold'
                }}>
                  {testimonial.author[0]}
                </div>
                <div>
                  <div className={styles.authorName}>{testimonial.author}</div>
                  <div className={styles.authorRole}>{testimonial.role}</div>
                </div>
                <div style={{ marginLeft: 'auto', color: 'var(--star-rating)' }}>
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <StarFilled key={i} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className={styles.ctaSection}>
        <div className={styles.ctaBg} />
        <div className={styles.ctaContent}>
          <h2 style={{ fontSize: '36px', fontWeight: 800, marginBottom: '24px' }}>
            准备好拿下 Offer 了吗？
          </h2>
          <p style={{ fontSize: '18px', color: 'var(--color-text-secondary)', marginBottom: '48px' }}>
            立即加入 OfferCar AI，开启你的开挂面试之旅。
          </p>
          <Link href="/login">
            <Button 
              type="primary" 
              size="large"
              style={{ 
                height: 56, 
                padding: '0 64px',
                fontSize: '20px',
                fontWeight: 'bold'
              }}
            >
              免费注册
            </Button>
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}

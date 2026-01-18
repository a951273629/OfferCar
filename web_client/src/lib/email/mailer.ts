import nodemailer from 'nodemailer';

// 创建邮件传输器
const createTransporter = () => {
  // 开发环境：使用 ethereal.email 测试邮箱（如果没有配置真实邮箱）
  if (
    process.env.NODE_ENV !== 'production' &&
    !process.env.EMAIL_HOST
  ) {
    console.warn(
      '⚠️  未配置邮件服务，验证码将输出到控制台。请配置 EMAIL_* 环境变量以启用邮件发送。'
    );
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });
};

// 发送验证码邮件
export async function sendVerificationCode(
  email: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const transporter = createTransporter();

    // 如果没有配置邮件服务，在控制台输出验证码
    if (!transporter) {
      console.log('\n' + '='.repeat(50));
      console.log('📧 验证码邮件（开发模式）');
      console.log('='.repeat(50));
      console.log(`收件人: ${email}`);
      console.log(`验证码: ${code}`);
      console.log(`有效期: 10 分钟`);
      console.log('='.repeat(50) + '\n');
      return { success: true, messageId: 'dev-mode' };
    }

    // 发送邮件
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"OfferCar AI" <noreply@OfferCar.com>',
      to: email,
      subject: '您的 OfferCar AI 验证码',
      html: generateVerificationEmailHTML(code),
      text: generateVerificationEmailText(code),
    });

    console.log(`✅ 验证码已发送到 ${email}, MessageID: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ 邮件发送失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '邮件发送失败',
    };
  }
}

// 生成验证码邮件 HTML 模板
function generateVerificationEmailHTML(code: string): string {
  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>验证码</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f7; padding: 40px 0;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px 40px; text-align: center;">
                  <h1 style="color: #7c3aed; margin: 0; font-size: 28px;">OfferCar AI</h1>
                  <p style="color: #666; margin: 10px 0 0 0; font-size: 14px;">AI 面试笔试助手</p>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 20px 40px;">
                  <h2 style="color: #333; font-size: 20px; margin: 0 0 20px 0;">验证码登录</h2>
                  <p style="color: #666; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                    您正在登录 OfferCar AI 平台，您的验证码是：
                  </p>
                  
                  <!-- Verification Code -->
                  <div style="background-color: #f8f9fa; border: 2px dashed #7c3aed; border-radius: 8px; padding: 30px; text-align: center; margin: 0 0 30px 0;">
                    <span style="font-size: 36px; font-weight: bold; color: #7c3aed; letter-spacing: 8px;">${code}</span>
                  </div>
                  
                  <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                    • 验证码有效期为 <strong>10 分钟</strong>
                  </p>
                  <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0 0 10px 0;">
                    • 请勿将验证码透露给他人
                  </p>
                  <p style="color: #666; font-size: 14px; line-height: 1.6; margin: 0;">
                    • 如果这不是您的操作，请忽略此邮件
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 20px 40px 40px 40px; text-align: center; border-top: 1px solid #eee;">
                  <p style="color: #999; font-size: 12px; margin: 0;">
                    这是一封自动发送的邮件，请勿回复
                  </p>
                  <p style="color: #999; font-size: 12px; margin: 10px 0 0 0;">
                    © ${new Date().getFullYear()} OfferCar AI. All rights reserved.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// 生成验证码邮件纯文本版本
function generateVerificationEmailText(code: string): string {
  return `
OfferCar AI - 验证码登录

您正在登录 OfferCar AI 平台，您的验证码是：

${code}

• 验证码有效期为 10 分钟
• 请勿将验证码透露给他人
• 如果这不是您的操作，请忽略此邮件

---
这是一封自动发送的邮件，请勿回复
© ${new Date().getFullYear()} OfferCar AI. All rights reserved.
  `.trim();
}


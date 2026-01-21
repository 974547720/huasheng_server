const redis = require('../../config/redis');
const { transporter, from } = require('../../config/mail');

/**
 * 发送邮箱验证码 Action
 * 实现功能：
 * 1. 频率控制 (60秒内只能发送一次)
 * 2. 生成 6 位随机验证码
 * 3. 验证码存储在 Redis (有效期 5 分钟)
 * 4. 发送邮件
 */
class SendVerificationCodeAction {
    /**
     * 执行发送逻辑
     * @param {string} email 目标邮箱
     * @returns {Promise<{success: boolean, message: string}>}
     */
    async execute(email) {
        const lockKey = `vcode_lock:${email}`;
        const codeKey = `vcode:${email}`;

        // 1. 频率控制：检查 60 秒锁定
        const isLocked = await redis.get(lockKey);
        if (isLocked) {
            throw new Error('发送频率过快，请 60 秒后再试');
        }

        // 2. 生成 6 位随机数字验证码
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        try {
            // 3. 发送邮件
            await transporter.sendMail({
                from: from,
                to: email,
                subject: '【花生平台】验证码',
                text: `您的验证码是：${code}，有效期为 5 分钟。请勿泄露给他人。`,
                html: `
                    <div style="padding: 20px; background-color: #f8f9fa; font-family: sans-serif;">
                        <h2 style="color: #333;">验证码通知</h2>
                        <p style="font-size: 16px; color: #666;">您正在进行身份验证，验证码如下：</p>
                        <div style="background-color: #fff; padding: 15px; border-radius: 4px; display: inline-block; border: 1px solid #ddd;">
                            <span style="font-size: 24px; font-weight: bold; color: #007bff; letter-spacing: 5px;">${code}</span>
                        </div>
                        <p style="font-size: 14px; color: #999; margin-top: 20px;">
                            验证码有效期为 5 分钟。如果不是您本人操作，请忽略此邮件。
                        </p>
                    </div>
                `,
            });

            // 4. 存储到 Redis
            // 验证码有效期 5 分钟 (300秒)
            await redis.set(codeKey, code, 'EX', 300);
            
            // 发送频率锁定 60 秒
            await redis.set(lockKey, '1', 'EX', 60);

            return { success: true, message: '验证码已发送至您的邮箱' };
        } catch (error) {
            console.error('Email sending failed:', error);
            throw new Error('邮件发送失败，请稍后再试');
        }
    }
}

module.exports = new SendVerificationCodeAction();


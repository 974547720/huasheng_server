const redis = require('../../config/redis');

/**
 * 验证验证码 Action
 */
class VerifyVerificationCodeAction {
    /**
     * 验证验证码是否有效
     * @param {string} email 邮箱
     * @param {string} code 验证码
     * @param {boolean} keepAlive 验证后是否保留（默认验证即失效）
     * @returns {Promise<boolean>}
     */
    async execute(email, code, keepAlive = false) {
        if (!email || !code) return false;
        
        const codeKey = `vcode:${email}`;
        const storedCode = await redis.get(codeKey);

        if (storedCode && storedCode === code.toString()) {
            if (!keepAlive) {
                await redis.del(codeKey); // 验证成功即失效，防止复用
            }
            return true;
        }
        
        return false;
    }
}

module.exports = new VerifyVerificationCodeAction();


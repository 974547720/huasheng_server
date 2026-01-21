const db = require('../config/db');
const crypto = require('crypto');

class ActivationCode {
    /**
     * 生成随机 32 位激活码 (大写十六进制)
     */
    static generateRandomCode() {
        return crypto.randomBytes(16).toString('hex').toUpperCase();
    }

    /**
     * 创建单个激活码
     * @param {Object} data { value, adminId, expiredAt }
     */
    static async create({ value, adminId, expiredAt = null }) {
        const code = this.generateRandomCode();
        await db.execute(
            'INSERT INTO activation_codes (code, value, created_by_admin_id, expired_at) VALUES (?, ?, ?, ?)',
            [code, value, adminId, expiredAt]
        );
        return code;
    }

    /**
     * 获取所有激活码列表（带关联信息）
     */
    static async findAll() {
        const sql = `
            SELECT 
                ac.code, 
                ac.value, 
                ac.status, 
                ac.used_at, 
                ac.created_at, 
                ac.expired_at,
                admin.username as creator_name,
                user.email as used_by_email
            FROM activation_codes ac
            LEFT JOIN admins admin ON ac.created_by_admin_id = admin.id
            LEFT JOIN users user ON ac.used_by_user_id = user.id
            ORDER BY ac.created_at DESC
        `;
        const [rows] = await db.execute(sql);
        return rows;
    }

    /**
     * 根据代码查找激活码
     */
    static async findByCode(code) {
        const [rows] = await db.execute(
            'SELECT * FROM activation_codes WHERE code = ?',
            [code]
        );
        return rows[0];
    }

    /**
     * 兑换激活码 (原子操作)
     * @param {string} code 激活码
     * @param {number} userId 用户ID
     */
    static async redeem(code, userId) {
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. 锁行查询激活码，防止并发兑换
            const [codes] = await connection.execute(
                'SELECT * FROM activation_codes WHERE code = ? FOR UPDATE',
                [code]
            );
            const ac = codes[0];

            if (!ac) throw new Error('激活码不存在');
            if (ac.status === 1) throw new Error('激活码已被使用');
            if (ac.status === 2) throw new Error('激活码已作废');
            if (ac.status !== 0) throw new Error('无效的激活码状态');
            
            // 检查是否过期
            if (ac.expired_at && new Date(ac.expired_at) < new Date()) {
                throw new Error('激活码已过期');
            }

            // 2. 获取用户当前余额
            const [users] = await connection.execute(
                'SELECT balance FROM users WHERE id = ? FOR UPDATE',
                [userId]
            );
            if (!users[0]) throw new Error('用户不存在');
            const beforeBalance = users[0].balance;
            const afterBalance = beforeBalance + ac.value;

            // 3. 更新用户余额
            await connection.execute(
                'UPDATE users SET balance = ? WHERE id = ?',
                [afterBalance, userId]
            );

            // 4. 更新激活码状态
            await connection.execute(
                'UPDATE activation_codes SET status = 1, used_by_user_id = ?, used_at = NOW() WHERE code = ?',
                [userId, code]
            );

            // 5. 记录余额日志
            await connection.execute(
                'INSERT INTO balance_logs (user_id, change_amount, before_balance, after_balance, action_type, remark) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, ac.value, beforeBalance, afterBalance, 'recharge', `激活码兑换: ${code}`]
            );

            await connection.commit();
            return { success: true, value: ac.value, balance: afterBalance };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = ActivationCode;

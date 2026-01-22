const axios = require('axios');
const db = require('../../config/db');
const User = require('../../models/userModel');
const ParseTask = require('../../models/parseTaskModel');
const PlatformDetector = require('../../utils/PlatformDetector');

class SinglePostExtractAction {
    /**
     * 执行解析逻辑
     * @param {number} userId 
     * @param {string} targetUrl 
     */
    async execute(userId, targetUrl) {
        // 1. 识别平台
        const platformName = PlatformDetector.detect(targetUrl);
        const rule = await ParseTask.getPlatformRule(platformName);
        const cost = rule.single_deduction; // 单帖子解析扣费次数

        // 2. 检查用户余额及扣费 (开启事务)
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 获取用户信息并锁行
            const [users] = await connection.execute('SELECT id, balance FROM users WHERE id = ? FOR UPDATE', [userId]);
            const user = users[0];

            if (!user) throw new Error('用户不存在');
            if (user.balance < cost) {
                throw new Error(`余额不足。本次解析需要 ${cost} 次额度，您当前剩余 ${user.balance} 次`);
            }

            // 3. 调用第三方 API (MeowLoad)
            let apiResult;
            try {
                const response = await axios.post(
                    process.env.MEOW_POST_API,
                    { url: targetUrl },
                    {
                        headers: {
                            'x-api-key': process.env.MEOW_API_KEY,
                            'accept-language': 'zh',
                            'Content-Type': 'application/json'
                        },
                        timeout: 30000 // 30秒超时
                    }
                );
                apiResult = response.data;
            } catch (apiError) {
                // 如果是业务失败 (400 等)，API 依然会返回 message
                const message = apiError.response?.data?.message || '第三方解析服务暂时不可用';
                throw new Error(`解析失败: ${message}`);
            }

            // 4. 执行扣费
            const beforeBalance = user.balance;
            const afterBalance = beforeBalance - cost;
            
            await connection.execute(
                'UPDATE users SET balance = ? WHERE id = ?',
                [afterBalance, userId]
            );

            // 5. 记录余额日志
            await connection.execute(
                'INSERT INTO balance_logs (user_id, change_amount, before_balance, after_balance, action_type, remark) VALUES (?, ?, ?, ?, ?, ?)',
                [userId, -cost, beforeBalance, afterBalance, 'consume', `${platformName}单帖解析: ${targetUrl}`]
            );

            // 6. 记录解析任务
            await connection.execute(
                `INSERT INTO parse_tasks 
                (user_id, platform_type, parse_type, input_url, status, result_count, deducted_times) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, rule.category, 'single', targetUrl, 'success', apiResult.medias?.length || 0, cost]
            );

            await connection.commit();

            return {
                success: true,
                message: '解析成功',
                data: apiResult,
                usage: {
                    deducted: cost,
                    remaining: afterBalance
                }
            };

        } catch (error) {
            await connection.rollback();
            
            // 记录失败的任务记录 (非余额不足导致的错误才记录任务)
            if (!error.message.includes('余额不足')) {
                await ParseTask.create({
                    userId,
                    platformType: rule?.category || 'normal',
                    parseType: 'single',
                    inputUrl: targetUrl,
                    status: 'failed',
                    resultCount: 0,
                    deductedTimes: 0,
                    reason: error.message
                });
            }
            
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new SinglePostExtractAction();


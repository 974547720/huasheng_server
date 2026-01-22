const db = require('../config/db');

/**
 * 后台管理控制器
 */

// 1. 获取解析任务记录列表
exports.getParseTasks = async (req, res) => {
    const { page = 1, limit = 20, status, platform } = req.query;
    const offset = (page - 1) * limit;

    try {
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (status) {
            whereClause += ' AND pt.status = ?';
            params.push(status);
        }
        if (platform) {
            whereClause += ' AND pt.platform_type = ?';
            params.push(platform);
        }

        // 关联用户表查询名称和邮箱
        const sql = `
            SELECT 
                pt.id, 
                pt.platform_type, 
                pt.parse_type, 
                pt.input_url, 
                pt.status, 
                pt.result_count, 
                pt.deducted_times as cost, 
                pt.reason,
                pt.created_at, 
                pt.finished_at,
                u.username as user_name,
                u.email as user_email
            FROM parse_tasks pt
            LEFT JOIN users u ON pt.user_id = u.id
            ${whereClause}
            ORDER BY pt.created_at DESC
            LIMIT ? OFFSET ?
        `;
        
        const [rows] = await db.execute(sql, [...params, String(limit), String(offset)]);
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM parse_tasks pt ${whereClause}`, params);

        res.json({
            success: true,
            data: rows,
            pagination: { total, page: Number(page), limit: Number(limit) }
        });
    } catch (error) {
        console.error('Get Parse Tasks Error:', error);
        res.status(500).json({ success: false, message: '获取解析记录失败' });
    }
};

// 2. 获取余额流水记录列表
exports.getBalanceLogs = async (req, res) => {
    const { page = 1, limit = 20, type } = req.query;
    const offset = (page - 1) * limit;

    try {
        let whereClause = 'WHERE 1=1';
        const params = [];

        if (type) {
            whereClause += ' AND bl.action_type = ?';
            params.push(type);
        }

        // 关联查询：用户信息、操作人(管理员)、以及提取激活码
        const sql = `
            SELECT 
                bl.id, 
                bl.created_at as time, 
                bl.change_amount, 
                bl.before_balance, 
                bl.after_balance, 
                bl.action_type, 
                bl.remark,
                u.username as user_name,
                u.email as user_email,
                adm.username as operator_name,
                -- 尝试从备注中解析激活码（假设格式为：激活码兑换: XXX）
                CASE 
                    WHEN bl.remark LIKE '激活码兑换:%' THEN SUBSTRING_INDEX(bl.remark, ': ', -1)
                    ELSE NULL 
                END as related_code
            FROM balance_logs bl
            LEFT JOIN users u ON bl.user_id = u.id
            LEFT JOIN admins adm ON bl.admin_id = adm.id
            ${whereClause}
            ORDER BY bl.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [rows] = await db.execute(sql, [...params, String(limit), String(offset)]);
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM balance_logs bl ${whereClause}`, params);

        res.json({
            success: true,
            data: rows,
            pagination: { total, page: Number(page), limit: Number(limit) }
        });
    } catch (error) {
        console.error('Get Balance Logs Error:', error);
        res.status(500).json({ success: false, message: '获取余额流水失败' });
    }
};

/**
 * 人工调整用户余额
 */
exports.adjustUserBalance = async (req, res) => {
    const { userId, adminId, type, amount, remark } = req.body;

    // 1. 参数校验
    if (!userId || !adminId || !type || !amount || !remark) {
        return res.status(400).json({ success: false, message: '参数缺失（需提供用户ID、管理员ID、类型、数量、备注）' });
    }

    if (amount <= 0) {
        return res.status(400).json({ success: false, message: '调整数量必须大于 0' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // 2. 锁行查询用户当前余额
        const [users] = await connection.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (!users[0]) throw new Error('用户不存在');

        const beforeBalance = users[0].balance;
        let changeAmount = Number(amount);
        
        // 根据类型确定加减
        if (type === '扣除') {
            changeAmount = -changeAmount;
            if (beforeBalance + changeAmount < 0) {
                throw new Error('扣除失败：用户余额不足以完成此操作');
            }
        } else if (type !== '增加') {
            throw new Error('无效的调整类型，仅支持 "增加" 或 "扣除"');
        }

        const afterBalance = beforeBalance + changeAmount;

        // 3. 更新用户余额
        await connection.execute(
            'UPDATE users SET balance = ? WHERE id = ?',
            [afterBalance, userId]
        );

        // 4. 记录流水日志
        await connection.execute(
            'INSERT INTO balance_logs (user_id, admin_id, change_amount, before_balance, after_balance, action_type, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, adminId, changeAmount, beforeBalance, afterBalance, 'admin_adjustment', remark]
        );

        await connection.commit();

        res.json({
            success: true,
            message: '余额调整成功',
            data: {
                userId,
                beforeBalance,
                afterBalance,
                changeAmount
            }
        });
    } catch (error) {
        await connection.rollback();
        console.error('Adjust Balance Error:', error);
        res.status(400).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};


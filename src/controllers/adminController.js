const Admin = require('../models/adminModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const generateAdminToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1d' }); // 管理员 Token 有效期 1 天
};

/**
 * 获取当前管理员信息
 */
exports.getInfo = async (req, res) => {
    try {
        const admin = req.admin;

        res.json({
            success: true,
            data: {
                id: admin.id,
                username: admin.username,
                nickname: admin.username,
                avatar: null,
                email: admin.email || null,
                phone: admin.phone || null,
                role: admin.role,
                status: admin.status,
                created_at: admin.created_at
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取管理员信息失败' });
    }
};

/**
 * 管理员登录
 */
exports.login = async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: '请输入用户名和密码' });
    }

    try {
        const admin = await Admin.findByUsername(username);
        if (!admin) {
            return res.status(401).json({ success: false, message: '账号或密码错误' });
        }

        if (admin.status !== 1) {
            return res.status(403).json({ success: false, message: '账号已被冻结' });
        }

        const isMatch = await bcrypt.compare(password, admin.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: '账号或密码错误' });
        }

        // 更新登录信息
        await Admin.update(admin.id, { 
            last_login_at: new Date(), 
            last_login_ip: req.ip 
        });

        const token = generateAdminToken(admin.id);

        res.json({
            success: true,
            message: '登录成功',
            data: {
                id: admin.id,
                username: admin.username,
                role: admin.role,
                token
            }
        });
    } catch (error) {
        console.error('Admin Login Error:', error);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
};

/**
 * 管理员列表 (超级管理员)
 */
exports.listAdmins = async (req, res) => {
    try {
        const list = await Admin.findAll();
        res.json({ success: true, data: list });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取列表失败' });
    }
};

/**
 * 新增管理员 (超级管理员)
 */
exports.createAdmin = async (req, res) => {
    const { username, password, email, phone, role } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: '用户名和密码必填' });
    }

    try {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        const adminId = await Admin.create({
            username,
            passwordHash,
            email,
            phone,
            role: role || 'admin'
        });

        // 记录操作日志
        await Admin.logAction(req.admin.id, 'create_admin', 'admin', adminId, { username, role }, req.ip);

        res.status(201).json({ success: true, message: '管理员创建成功', id: adminId });
    } catch (error) {
        console.error('Create Admin Error:', error);
        res.status(400).json({ success: false, message: '创建失败，用户名可能已存在' });
    }
};

/**
 * 修改管理员 (超级管理员)
 */
exports.updateAdmin = async (req, res) => {
    const { id } = req.params;
    const { password, email, phone, role, status } = req.body;

    try {
        const updateData = {};
        if (password) {
            const salt = await bcrypt.genSalt(10);
            updateData.password_hash = await bcrypt.hash(password, salt);
        }
        if (email !== undefined) updateData.email = email;
        if (phone !== undefined) updateData.phone = phone;
        if (role) updateData.role = role;
        if (status !== undefined) updateData.status = status;

        await Admin.update(id, updateData);

        // 记录操作日志
        await Admin.logAction(req.admin.id, 'update_admin', 'admin', id, updateData, req.ip);

        res.json({ success: true, message: '管理员信息已更新' });
    } catch (error) {
        res.status(400).json({ success: false, message: '更新失败' });
    }
};

/**
 * 删除管理员 (超级管理员)
 */
exports.deleteAdmin = async (req, res) => {
    const { id } = req.params;

    if (Number(id) === req.admin.id) {
        return res.status(400).json({ success: false, message: '不能删除自己' });
    }

    try {
        await Admin.delete(id);
        await Admin.logAction(req.admin.id, 'delete_admin', 'admin', id, null, req.ip);
        res.json({ success: true, message: '管理员已删除' });
    } catch (error) {
        res.status(400).json({ success: false, message: '删除失败' });
    }
};

/**
 * 获取操作日志
 */
exports.getAdminLogs = async (req, res) => {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    try {
        const [rows] = await db.execute(
            `SELECT al.*, a.username as admin_name 
             FROM admin_logs al 
             LEFT JOIN admins a ON al.admin_id = a.id 
             ORDER BY al.created_at DESC 
             LIMIT ? OFFSET ?`,
            [String(limit), String(offset)]
        );
        const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM admin_logs`);

        res.json({ 
            success: true, 
            data: rows,
            pagination: { total, page: Number(page), limit: Number(limit) }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: '获取日志失败' });
    }
};

/**
 * 获取解析任务记录列表
 */
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

        const sql = `
            SELECT pt.*, u.username as user_name, u.email as user_email
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
        res.status(500).json({ success: false, message: '获取解析记录失败' });
    }
};

/**
 * 获取余额流水记录
 */
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

        const sql = `
            SELECT bl.*, u.username as user_name, u.email as user_email, adm.username as operator_name
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
        res.status(500).json({ success: false, message: '获取余额流水失败' });
    }
};

/**
 * 人工调整用户余额
 */
exports.adjustUserBalance = async (req, res) => {
    const { userId, type, amount, remark } = req.body;
    const adminId = req.admin.id;

    if (!userId || !type || !amount || !remark) {
        return res.status(400).json({ success: false, message: '参数缺失' });
    }

    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        const [users] = await connection.execute('SELECT balance FROM users WHERE id = ? FOR UPDATE', [userId]);
        if (!users[0]) throw new Error('用户不存在');

        const beforeBalance = users[0].balance;
        let changeAmount = Number(amount);
        if (type === '扣除') changeAmount = -changeAmount;

        const afterBalance = beforeBalance + changeAmount;
        if (afterBalance < 0) throw new Error('余额不足');

        await connection.execute('UPDATE users SET balance = ? WHERE id = ?', [afterBalance, userId]);
        await connection.execute(
            'INSERT INTO balance_logs (user_id, admin_id, change_amount, before_balance, after_balance, action_type, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [userId, adminId, changeAmount, beforeBalance, afterBalance, 'admin_adjustment', remark]
        );

        await connection.commit();

        // 审计日志
        await Admin.logAction(adminId, 'adjust_balance', 'user', userId, { type, amount, remark }, req.ip);

        res.json({ success: true, message: '调整成功' });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ success: false, message: error.message });
    } finally {
        connection.release();
    }
};

const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

/**
 * 管理员认证中间件
 */
const adminAuth = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '请先登录管理员账号' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // 查找管理员并确认状态
        const admin = await Admin.findById(decoded.id);
        if (!admin) {
            return res.status(401).json({ success: false, message: '管理员账号不存在' });
        }
        if (admin.status !== 1) {
            return res.status(403).json({ success: false, message: '您的账号已被冻结，请联系超级管理员' });
        }

        req.admin = admin; // 挂载管理员对象
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: '登录已过期或无效' });
    }
};

/**
 * 权限校验中间件：仅限超级管理员
 */
const superAdminOnly = (req, res, next) => {
    if (req.admin && req.admin.role === 'super_admin') {
        next();
    } else {
        res.status(403).json({ success: false, message: '权限不足：此操作仅限超级管理员' });
    }
};

module.exports = { adminAuth, superAdminOnly };


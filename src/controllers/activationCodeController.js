const ActivationCode = require('../models/activationCodeModel');
const Admin = require('../models/adminModel');

/**
 * 允许的解析次数面值枚举
 * 以后如需修改，只需在此更新数组即可
 */
const ALLOWED_VALUES = [5, 20, 100, 500];

/**
 * 生成激活码
 */
exports.generateCodes = async (req, res) => {
    const { value, count = 1 } = req.body;
    const adminId = req.admin.id; // 从 Token 中获取当前管理员ID

    // 1. 基础参数校验
    if (!value) {
        return res.status(400).json({ success: false, message: '请提供激活码面值' });
    }

    // 2. 面值枚举校验
    if (!ALLOWED_VALUES.includes(Number(value))) {
        return res.status(400).json({ 
            success: false, 
            message: `不支持的面值。当前允许的面值为: ${ALLOWED_VALUES.join(', ')}` 
        });
    }

    try {
        const createdCodes = [];
        // 循环生成指定数量的激活码
        for (let i = 0; i < count; i++) {
            const code = await ActivationCode.create({ 
                value: Number(value), 
                adminId: Number(adminId) 
            });
            createdCodes.push(code);
        }

        res.status(201).json({
            success: true,
            message: `成功生成 ${count} 个激活码`,
            data: createdCodes
        });

        // 记录操作日志
        await Admin.logAction(adminId, 'generate_code', 'activation_code', createdCodes.join(','), { value, count }, req.ip);
    } catch (error) {
        console.error('Generate Activation Codes Error:', error);
        res.status(500).json({ success: false, message: '生成失败，请检查管理员ID是否有效' });
    }
};

/**
 * 获取激活码列表
 */
exports.getAllCodes = async (req, res) => {
    try {
        const codes = await ActivationCode.findAll();
        res.json({
            success: true,
            data: codes
        });
    } catch (error) {
        console.error('Get Activation Codes Error:', error);
        res.status(500).json({ success: false, message: '获取列表失败' });
    }
};

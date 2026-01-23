const express = require('express');
const router = express.Router();
const activationCodeController = require('../controllers/activationCodeController');
const adminController = require('../controllers/adminController');
const { adminAuth, superAdminOnly } = require('../middlewares/adminAuthMiddleware');

/**
 * 认证
 */
router.post('/login', adminController.login);

// --- 以下所有接口均需要管理员登录认证 ---
router.use(adminAuth);

/**
 * 激活码管理
 */
router.post('/activation-codes/generate', activationCodeController.generateCodes);
router.get('/activation-codes', activationCodeController.getAllCodes);

/**
 * 审计与记录
 */
// 获取解析任务记录
router.get('/parse-tasks', adminController.getParseTasks);
// 获取用户余额流水记录
router.get('/balance-logs', adminController.getBalanceLogs);
// 获取管理员操作日志
router.get('/admin-logs', adminController.getAdminLogs);

/**
 * 管理员管理 (仅限超级管理员)
 */
router.get('/admins', superAdminOnly, adminController.listAdmins);
router.post('/admins', superAdminOnly, adminController.createAdmin);
router.put('/admins/:id', superAdminOnly, adminController.updateAdmin);
router.delete('/admins/:id', superAdminOnly, adminController.deleteAdmin);

/**
 * 用户管理
 */
// 人工调整余额
router.post('/users/adjust-balance', adminController.adjustUserBalance);

module.exports = router;

const express = require('express');
const router = express.Router();
const activationCodeController = require('../controllers/activationCodeController');
const adminController = require('../controllers/adminController');

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

// 获取余额流水记录
router.get('/balance-logs', adminController.getBalanceLogs);

module.exports = router;

const express = require('express');
const router = express.Router();
const activationCodeController = require('../controllers/activationCodeController');

/**
 * 激活码管理路由
 * 路径前缀: /api/admin
 */

// 生成激活码 (POST /api/admin/activation-codes/generate)
router.post('/activation-codes/generate', activationCodeController.generateCodes);

// 获取激活码列表 (GET /api/admin/activation-codes)
router.get('/activation-codes', activationCodeController.getAllCodes);

module.exports = router;

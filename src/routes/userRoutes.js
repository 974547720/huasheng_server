const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

// 认证相关路由
router.post('/send-vcode', userController.sendVCode);
router.post('/verify-vcode', userController.verifyVCode);
router.post('/register', userController.register);
router.post('/login', userController.login);

// 用户信息相关路由
router.get('/profile', authMiddleware, userController.getProfile);
router.get('/users', authMiddleware, userController.getAllUsers);

// 激活码兑换
router.post('/redeem-code', authMiddleware, userController.redeemCode);

module.exports = router;

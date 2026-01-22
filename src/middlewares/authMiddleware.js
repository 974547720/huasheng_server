const jwt = require('jsonwebtoken');
const redis = require('../config/redis');

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authorization header missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // 1. 核心增强：检查是否在黑名单中
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({ success: false, message: '该令牌已注销，请重新登录' });
    }

    // 2. 验证 Token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;

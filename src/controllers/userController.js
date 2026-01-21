const User = require('../models/userModel');
const ActivationCode = require('../models/activationCodeModel');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const sendVerificationCodeAction = require('../actions/auth/SendVerificationCodeAction');
const verifyVerificationCodeAction = require('../actions/auth/VerifyVerificationCodeAction');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

/**
 * 发送邮箱验证码
 */
exports.sendVCode = async (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ success: false, message: '请提供邮箱地址' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ success: false, message: '无效的邮箱格式' });
  }

  try {
    const result = await sendVerificationCodeAction.execute(email);
    res.json(result);
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 验证验证码有效性接口（供前端校验使用）
 */
exports.verifyVCode = async (req, res) => {
  const { email, code } = req.body || {};
  
  if (!email || !code) {
    return res.status(400).json({ success: false, message: '请提供邮箱和验证码' });
  }

  try {
    // 这里的验证不销毁验证码，因为注册时还需要用到
    const isValid = await verifyVerificationCodeAction.execute(email, code, true);
    if (isValid) {
      res.json({ success: true, message: '验证码有效' });
    } else {
      res.status(400).json({ success: false, message: '验证码错误或已过期' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

/**
 * 用户注册（包含验证码校验及初始额度赠送）
 */
exports.register = async (req, res) => {
  const { username, email, password, phone, code } = req.body || {};

  if (!username || !email || !password || !code) {
    return res.status(400).json({ success: false, message: '请提供必要字段（用户名、邮箱、密码、验证码）' });
  }

  try {
    // 1. 强制验证验证码（验证成功即销毁）
    const isCodeValid = await verifyVerificationCodeAction.execute(email, code, false);
    if (!isCodeValid) {
      return res.status(400).json({ success: false, message: '验证码无效或已过期' });
    }

    // 2. 检查用户是否已存在
    const userExists = await User.findByEmail(email);
    if (userExists) {
      return res.status(400).json({ success: false, message: '该邮箱已被注册' });
    }

    // 3. 密码加密
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. 创建用户并赠送额度
    const userId = await User.create(username, email, hashedPassword, phone);

    // 5. 记录余额日志
    await User.addBalanceLog(userId, 10, 0, 10, 'recharge', '新人体验额度赠送');

    const token = generateToken(userId);

    res.status(201).json({
      success: true,
      message: '注册成功，已赠送 10 次体验额度',
      data: { id: userId, username, email, phone, token }
    });
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

/**
 * 兑换激活码
 */
exports.redeemCode = async (req, res) => {
  const { code } = req.body || {};
  const userId = req.user.id;

  if (!code) {
    return res.status(400).json({ success: false, message: '请提供激活码' });
  }

  try {
    const result = await ActivationCode.redeem(code, userId);
    res.json({
      success: true,
      message: `兑换成功，已增加 ${result.value} 次解析额度`,
      data: {
        addedValue: result.value,
        currentBalance: result.balance
      }
    });
  } catch (error) {
    console.error('Redeem Code Error:', error);
    res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * 用户登录（支持邮箱、手机号、用户名）
 */
exports.login = async (req, res) => {
  const { identity, password } = req.body || {};

  if (!identity || !password) {
    return res.status(400).json({ success: false, message: '请提供登录账号和密码' });
  }

  try {
    // 使用 findByIdentity 支持多维度登录
    const user = await User.findByIdentity(identity);
    
    if (!user) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '账号或密码错误' });
    }

    const token = generateToken(user.id);

    res.json({
      success: true,
      message: '登录成功',
      data: { 
        id: user.id, 
        username: user.username, 
        email: user.email, 
        phone: user.phone,
        balance: user.balance,
        token 
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ success: false, message: '服务器错误' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();
    res.json({ success: true, data: users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

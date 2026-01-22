const db = require('../config/db');

class User {
  /**
   * 创建用户并赠送初始额度
   */
  static async create(username, email, password, phone = null) {
    // 根据 PRD 要求，注册即赠送 10 次额度，并标记已领取
    const [result] = await db.execute(
      'INSERT INTO users (username, email, phone, password_hash, balance, experience_quota_used) VALUES (?, ?, ?, ?, ?, ?)',
      [username, email, phone, password, 10, 1]
    );
    return result.insertId;
  }

  /**
   * 记录余额变动日志
   */
  static async addBalanceLog(userId, amount, before, after, type, remark) {
    await db.execute(
      'INSERT INTO balance_logs (user_id, change_amount, before_balance, after_balance, action_type, remark) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, amount, before, after, type, remark]
    );
  }

  /**
   * 扣除余额 (原子操作)
   */
  static async deductBalance(userId, amount, connection = null) {
    const conn = connection || db;
    const [result] = await conn.execute(
      'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?',
      [amount, userId, amount]
    );
    return result.affectedRows > 0;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    // 适配数据库设计文档中的 password_hash 字段名
    if (rows[0] && rows[0].password_hash) {
      rows[0].password = rows[0].password_hash;
    }
    return rows[0];
  }

  /**
   * 通过邮箱、手机号或用户名查找用户
   */
  static async findByIdentity(identity) {
    const [rows] = await db.execute(
      'SELECT * FROM users WHERE email = ? OR phone = ? OR username = ?',
      [identity, identity, identity]
    );
    if (rows[0] && rows[0].password_hash) {
      rows[0].password = rows[0].password_hash;
    }
    return rows[0];
  }

  static async findById(id) {
    const [rows] = await db.execute('SELECT id, username, email, phone, balance, created_at FROM users WHERE id = ?', [id]);
    return rows[0];
  }

  static async findAll() {
    const [rows] = await db.execute('SELECT id, username, email, phone, balance, created_at FROM users');
    return rows;
  }
}

module.exports = User;

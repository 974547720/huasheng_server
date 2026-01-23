const db = require('../config/db');

class Admin {
    /**
     * 根据用户名查找管理员
     */
    static async findByUsername(username) {
        const [rows] = await db.execute('SELECT * FROM admins WHERE username = ?', [username]);
        return rows[0];
    }

    /**
     * 根据 ID 查找管理员
     */
    static async findById(id) {
        const [rows] = await db.execute('SELECT id, username, email, phone, role, status, created_at FROM admins WHERE id = ?', [id]);
        return rows[0];
    }

    /**
     * 创建管理员
     */
    static async create(data) {
        const { username, passwordHash, email, phone, role } = data;
        const [result] = await db.execute(
            'INSERT INTO admins (username, password_hash, email, phone, role) VALUES (?, ?, ?, ?, ?)',
            [username, passwordHash, email, phone, role]
        );
        return result.insertId;
    }

    /**
     * 更新管理员信息
     */
    static async update(id, data) {
        const fields = [];
        const values = [];
        for (const [key, value] of Object.entries(data)) {
            fields.push(`${key} = ?`);
            values.push(value);
        }
        values.push(id);
        const [result] = await db.execute(`UPDATE admins SET ${fields.join(', ')} WHERE id = ?`, values);
        return result.affectedRows > 0;
    }

    /**
     * 删除管理员
     */
    static async delete(id) {
        const [result] = await db.execute('DELETE FROM admins WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    /**
     * 获取管理员列表
     */
    static async findAll() {
        const [rows] = await db.execute('SELECT id, username, email, phone, role, status, last_login_at, created_at FROM admins ORDER BY id ASC');
        return rows;
    }

    /**
     * 记录操作日志
     */
    static async logAction(adminId, action, targetType, targetId, details, ip) {
        await db.execute(
            'INSERT INTO admin_logs (admin_id, action, target_type, target_id, details, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [adminId, action, targetType, targetId, typeof details === 'object' ? JSON.stringify(details) : details, ip]
        );
    }
}

module.exports = Admin;


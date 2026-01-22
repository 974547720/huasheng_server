const db = require('../config/db');

class ParseTask {
    /**
     * 创建解析任务记录
     */
    static async create(data) {
        const { userId, platformType, parseType, inputUrl, status, resultCount, deductedTimes, reason = null } = data;
        const [result] = await db.execute(
            `INSERT INTO parse_tasks 
            (user_id, platform_type, parse_type, input_url, status, result_count, deducted_times, reason) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, platformType, parseType, inputUrl, status, resultCount, deductedTimes, reason]
        );
        return result.insertId;
    }

    /**
     * 获取平台规则
     */
    static async getPlatformRule(platformName) {
        const [rows] = await db.execute(
            'SELECT * FROM platform_rules WHERE platform_name = ?',
            [platformName]
        );
        // 如果找不到具体平台，返回默认规则
        if (!rows[0]) {
            const [defaultRows] = await db.execute('SELECT * FROM platform_rules WHERE platform_name = "普通平台"');
            return defaultRows[0];
        }
        return rows[0];
    }
}

module.exports = ParseTask;


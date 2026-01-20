-- 创建花生用户管理与解析服务平台数据库
CREATE DATABASE IF NOT EXISTS mydatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mydatabase;

-- 1. 用户信息表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE COMMENT '邮箱账号',
    phone VARCHAR(20) UNIQUE COMMENT '手机号',
    password_hash TEXT NOT NULL COMMENT '加密密码',
    balance INT DEFAULT 0 COMMENT '当前余额（解析次数）',
    experience_quota_used BOOLEAN DEFAULT FALSE COMMENT '是否已领取新人体验额度',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    
    INDEX idx_email (email),
    INDEX idx_phone (phone)
) ENGINE=InnoDB COMMENT='用户基本信息表';

-- 2. 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    code CHAR(32) PRIMARY KEY COMMENT '激活码',
    value INT NOT NULL COMMENT '对应解析次数',
    is_used BOOLEAN DEFAULT FALSE COMMENT '是否已使用',
    used_by_user_id BIGINT UNSIGNED NULL COMMENT '使用者用户ID',
    used_at DATETIME NULL COMMENT '使用时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    expired_at DATETIME NULL COMMENT '过期时间',
    
    INDEX idx_used_status (is_used),
    INDEX idx_used_by_user (used_by_user_id),
    FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='激活码管理表';

-- 3. 解析任务记录表
CREATE TABLE IF NOT EXISTS parse_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL COMMENT '发起用户ID',
    platform_type ENUM('普通平台', '高消耗平台', '动态计费平台') NOT NULL COMMENT '平台分类',
    parse_type ENUM('单帖提取', '主页/批量提取') NOT NULL COMMENT '解析类型',
    input_url TEXT NOT NULL COMMENT '原始输入链接',
    status ENUM('待解析', '解析中', '成功', '失败') DEFAULT '待解析' COMMENT '任务状态',
    result_count INT DEFAULT 0 COMMENT '成功提取内容数量',
    deducted_times INT DEFAULT 0 COMMENT '实际扣除解析次数',
    reason TEXT COMMENT '失败原因',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
    finished_at DATETIME NULL COMMENT '任务完成时间',
    
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB COMMENT='解析任务记录表';

-- 4. 余额变动日志表
CREATE TABLE IF NOT EXISTS balance_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL COMMENT '关联用户ID',
    change_amount INT NOT NULL COMMENT '变化量（正为充值，负为消费）',
    before_balance INT NOT NULL COMMENT '变动前余额',
    after_balance INT NOT NULL COMMENT '变动后余额',
    action_type ENUM('充值', '解析消费', '管理员调整') NOT NULL COMMENT '行为类型',
    related_task_id BIGINT UNSIGNED NULL COMMENT '关联解析任务ID',
    remark TEXT COMMENT '备注说明',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '时间戳',
    
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_task_id) REFERENCES parse_tasks(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='余额变动日志表';

-- 5. 后台管理员表
CREATE TABLE IF NOT EXISTS admins (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE COMMENT '登录用户名',
    password_hash TEXT NOT NULL COMMENT '密码哈希',
    role ENUM('普通管理员', '超级管理员') NOT NULL DEFAULT '普通管理员' COMMENT '权限等级',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    last_login_at DATETIME NULL COMMENT '上次登录时间',
    
    INDEX idx_username (username),
    INDEX idx_role (role)
) ENGINE=InnoDB COMMENT='后台管理员表';

-- 6. 平台规则映射表
CREATE TABLE IF NOT EXISTS platform_rules (
    platform_name VARCHAR(100) PRIMARY KEY COMMENT '平台名称',
    category ENUM('普通平台', '高消耗平台', '动态计费平台') NOT NULL COMMENT '平台分类',
    single_deduction INT NOT NULL DEFAULT 1 COMMENT '单帖提取扣费次数',
    batch_deduction_fixed INT NOT NULL DEFAULT 2 COMMENT '批量提取固定扣费次数',
    batch_deduction_formula VARCHAR(255) COMMENT '批量提取动态计算公式'
) ENGINE=InnoDB COMMENT='平台计费规则配置表';

-- 插入初始平台规则数据
INSERT INTO platform_rules (platform_name, category, single_deduction, batch_deduction_fixed, batch_deduction_formula) VALUES
('Instagram', '高消耗平台', 2, 2, 'CEIL(posts / 3)'),
('Facebook', '高消耗平台', 2, 2, NULL),
('Sora', '高消耗平台', 2, 2, NULL),
('P站', '高消耗平台', 2, 2, NULL),
('YouTube', '动态计费平台', 1, 2, 'CEIL(posts / 3)'),
('Twitter', '动态计费平台', 1, 2, 'CEIL(posts / 3)'),
('普通平台', '普通平台', 1, 2, NULL)
ON DUPLICATE KEY UPDATE platform_name=platform_name;

-- 插入示例管理员数据（密码需要替换为真实hash）
INSERT INTO admins (username, password_hash, role) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '超级管理员'),
('operator', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '普通管理员');

-- 创建视图：用户解析统计
CREATE VIEW user_parse_statistics AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(pt.id) as total_tasks,
    SUM(CASE WHEN pt.status = '成功' THEN 1 ELSE 0 END) as successful_tasks,
    SUM(pt.deducted_times) as total_deducted_times,
    u.balance as current_balance
FROM users u
LEFT JOIN parse_tasks pt ON u.id = pt.user_id
GROUP BY u.id, u.email, u.balance;

-- 创建视图：每日解析统计
CREATE VIEW daily_parse_statistics AS
SELECT 
    DATE(created_at) as parse_date,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN status = '成功' THEN 1 ELSE 0 END) as successful_tasks,
    SUM(deducted_times) as total_deducted_times
FROM parse_tasks
GROUP BY DATE(created_at)
ORDER BY parse_date DESC;

-- 插入示例用户数据
INSERT INTO users (email, phone, password_hash, balance, experience_quota_used) VALUES
('zhangsan@example.com', '13800138001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 50, TRUE),
('lisi@example.com', '13800138002', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 25, TRUE),
('wangwu@example.com', '13800138003', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 100, FALSE),
('zhaoliu@example.com', NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 0, FALSE);

-- 插入示例激活码数据
INSERT INTO activation_codes (code, value, is_used, used_by_user_id, used_at, created_at, expired_at) VALUES
('ABC1234567890DEFGHIJKLMN012345', 10, FALSE, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)),
('XYZ9876543210ZYXWVUTSRQPONMLKJI', 20, TRUE, 1, DATE_ADD(NOW(), INTERVAL -1 DAY), DATE_ADD(NOW(), INTERVAL -2 DAY), DATE_ADD(NOW(), INTERVAL 28 DAY)),
('DEF4567891234GHIJKLMN0123456789', 50, FALSE, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY)),
('GHI7891234567JKLMNOPQRSTUVWXY', 5, FALSE, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY));

-- 插入示例解析任务数据
INSERT INTO parse_tasks (user_id, platform_type, parse_type, input_url, status, result_count, deducted_times, reason, created_at, finished_at) VALUES
(1, '普通平台', '单帖提取', 'https://example.com/video/123', '成功', 1, 1, NULL, DATE_ADD(NOW(), INTERVAL -3 HOUR), DATE_ADD(NOW(), INTERVAL -3 HOUR)),
(1, '高消耗平台', '主页/批量提取', 'https://instagram.com/user/profile', '成功', 7, 3, NULL, DATE_ADD(NOW(), INTERVAL -2 HOUR), DATE_ADD(NOW(), INTERVAL -2 HOUR)),
(2, '动态计费平台', '主页/批量提取', 'https://youtube.com/channel/abc123', '失败', 0, 0, '网络连接超时', DATE_ADD(NOW(), INTERVAL -1 HOUR), DATE_ADD(NOW(), INTERVAL -1 HOUR)),
(3, '普通平台', '单帖提取', 'https://example.com/image/456', '成功', 1, 1, NULL, DATE_ADD(NOW(), INTERVAL -30 MINUTE), DATE_ADD(NOW(), INTERVAL -30 MINUTE));

-- 插入示例余额变动日志数据
INSERT INTO balance_logs (user_id, change_amount, before_balance, after_balance, action_type, related_task_id, remark, created_at) VALUES
(1, -1, 50, 49, '解析消费', 1, '普通平台单帖提取', DATE_ADD(NOW(), INTERVAL -3 HOUR)),
(1, -3, 49, 46, '解析消费', 2, 'Instagram批量提取(7个帖子)', DATE_ADD(NOW(), INTERVAL -2 HOUR)),
(3, -1, 100, 99, '解析消费', 4, '普通平台单帖提取', DATE_ADD(NOW(), INTERVAL -30 MINUTE)),
(1, 20, 46, 66, '充值', NULL, '激活码: XYZ9876543210ZYXWVUTSRQPONMLKJI', DATE_ADD(NOW(), INTERVAL -1 DAY));

-- 插入更多管理员数据
INSERT INTO admins (username, password_hash, role, last_login_at) VALUES
('auditor', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '普通管理员', DATE_ADD(NOW(), INTERVAL -1 HOUR)),
('developer', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '超级管理员', DATE_ADD(NOW(), INTERVAL -2 HOUR));

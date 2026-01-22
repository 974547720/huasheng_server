-- 创建花生用户管理与解析服务平台数据库
CREATE DATABASE IF NOT EXISTS mydatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mydatabase;

-- 1. 用户信息表
CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL COMMENT '用户昵称',
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

-- 2. 后台管理员表
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

-- 3. 激活码表
CREATE TABLE IF NOT EXISTS activation_codes (
    code CHAR(32) PRIMARY KEY COMMENT '激活码',
    value INT NOT NULL COMMENT '对应解析次数',
    status TINYINT NOT NULL DEFAULT 0 COMMENT '状态: 0未使用, 1已使用, 2已作废',
    created_by_admin_id BIGINT UNSIGNED NOT NULL COMMENT '生成管理员ID',
    used_by_user_id BIGINT UNSIGNED NULL COMMENT '使用者用户ID',
    used_at DATETIME NULL COMMENT '使用时间',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    expired_at DATETIME NULL COMMENT '过期时间',
    
    INDEX idx_status (status),
    INDEX idx_creator (created_by_admin_id),
    INDEX idx_used_by_user (used_by_user_id),
    FOREIGN KEY (created_by_admin_id) REFERENCES admins(id),
    FOREIGN KEY (used_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='激活码管理表';

-- 4. 解析任务记录表
CREATE TABLE IF NOT EXISTS parse_tasks (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL COMMENT '发起用户ID',
    platform_type ENUM('normal', 'high_consumption', 'dynamic') NOT NULL COMMENT '平台分类',
    parse_type ENUM('single', 'batch') NOT NULL COMMENT '解析类型',
    input_url TEXT NOT NULL COMMENT '原始输入链接',
    status ENUM('pending', 'processing', 'success', 'failed') DEFAULT 'pending' COMMENT '任务状态',
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

-- 5. 余额变动日志表
CREATE TABLE IF NOT EXISTS balance_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL COMMENT '关联用户ID',
    change_amount INT NOT NULL COMMENT '变化量（正为充值，负为消费）',
    before_balance INT NOT NULL COMMENT '变动前余额',
    after_balance INT NOT NULL COMMENT '变动后余额',
    action_type ENUM('recharge', 'consume', 'admin_adjustment') NOT NULL COMMENT '行为类型',
    related_task_id BIGINT UNSIGNED NULL COMMENT '关联解析任务ID',
    admin_id BIGINT UNSIGNED NULL COMMENT '操作管理员ID（仅限人工调整）',
    remark TEXT COMMENT '备注说明',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '时间戳',
    
    INDEX idx_user_id (user_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (related_task_id) REFERENCES parse_tasks(id) ON DELETE SET NULL,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB COMMENT='余额变动日志表';

-- 6. 平台规则映射表
CREATE TABLE IF NOT EXISTS platform_rules (
    platform_name VARCHAR(100) PRIMARY KEY COMMENT '平台名称',
    category ENUM('normal', 'high_consumption', 'dynamic') NOT NULL COMMENT '平台分类',
    single_deduction INT NOT NULL DEFAULT 1 COMMENT '单帖提取扣费次数',
    batch_deduction_fixed INT NOT NULL DEFAULT 2 COMMENT '批量提取固定扣费次数',
    batch_deduction_formula VARCHAR(255) COMMENT '批量提取动态计算公式'
) ENGINE=InnoDB COMMENT='平台计费规则配置表';

-- 插入初始平台规则数据
INSERT INTO platform_rules (platform_name, category, single_deduction, batch_deduction_fixed, batch_deduction_formula) VALUES
('Instagram', 'high_consumption', 2, 2, 'CEIL(posts / 3)'),
('Facebook', 'high_consumption', 2, 2, NULL),
('Sora', 'high_consumption', 2, 2, NULL),
('P站', 'high_consumption', 2, 2, NULL),
('YouTube', 'dynamic', 1, 2, 'CEIL(posts / 3)'),
('Twitter', 'dynamic', 1, 2, 'CEIL(posts / 3)'),
('普通平台', 'normal', 1, 2, NULL)
ON DUPLICATE KEY UPDATE platform_name=platform_name;

-- 插入示例管理员数据
INSERT INTO admins (username, password_hash, role) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '超级管理员'),
('operator', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '普通管理员'),
('auditor', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '普通管理员'),
('developer', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '超级管理员')
ON DUPLICATE KEY UPDATE username=username;

-- 插入示例用户数据
INSERT INTO users (username, email, phone, password_hash, balance, experience_quota_used) VALUES
('张三', 'zhangsan@example.com', '13800138001', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 50, TRUE),
('李四', 'lisi@example.com', '13800138002', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 25, TRUE),
('王五', 'wangwu@example.com', '13800138003', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 100, FALSE),
('赵六', 'zhaoliu@example.com', NULL, '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 0, FALSE)
ON DUPLICATE KEY UPDATE email=email;

-- 插入示例激活码数据
INSERT INTO activation_codes (code, value, status, created_by_admin_id, used_by_user_id, used_at, created_at, expired_at) VALUES
('ABC1234567890DEFGHIJKLMN012345', 10, 0, 1, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY)),
('XYZ9876543210ZYXWVUTSRQPONMLKJI', 20, 1, 1, 1, DATE_ADD(NOW(), INTERVAL -1 DAY), DATE_ADD(NOW(), INTERVAL -2 DAY), DATE_ADD(NOW(), INTERVAL 28 DAY)),
('DEF4567891234GHIJKLMN0123456789', 50, 0, 2, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 60 DAY)),
('GHI7891234567JKLMNOPQRSTUVWXY', 5, 2, 2, NULL, NULL, NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY))
ON DUPLICATE KEY UPDATE code=code;

-- 创建视图：用户解析统计
CREATE OR REPLACE VIEW user_parse_statistics AS
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
CREATE OR REPLACE VIEW daily_parse_statistics AS
SELECT 
    DATE(created_at) as parse_date,
    COUNT(*) as total_tasks,
    SUM(CASE WHEN status = '成功' THEN 1 ELSE 0 END) as successful_tasks,
    SUM(deducted_times) as total_deducted_times
FROM parse_tasks
GROUP BY DATE(created_at)
ORDER BY parse_date DESC;

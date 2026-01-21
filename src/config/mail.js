const nodemailer = require('nodemailer');
const dotenv = require('dotenv');

dotenv.config();

const mailConfig = {
    host: process.env.MAIL_HOST || 'smtp.163.com',
    port: process.env.MAIL_PORT || 465,
    secure: process.env.MAIL_SECURE === 'true' || true, // 465 端口通常为 true
    auth: {
        user: process.env.MAIL_USER || 'huasheng2026hs@163.com',
        pass: process.env.MAIL_PASS || 'LTk69WtehH2Gk2ab',
    },
};

const transporter = nodemailer.createTransport(mailConfig);

module.exports = {
    transporter,
    from: process.env.MAIL_FROM || `"花生平台" <${mailConfig.auth.user}>`,
};


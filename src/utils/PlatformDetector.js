/**
 * 平台识别工具类
 */
class PlatformDetector {
    /**
     * 根据 URL 识别平台名称
     * @param {string} url 
     * @returns {string} 平台名称 (对应数据库 platform_rules.platform_name)
     */
    static detect(url) {
        const u = url.toLowerCase();
        
        if (u.includes('youtube.com') || u.includes('youtu.be')) return 'YouTube';
        if (u.includes('instagram.com')) return 'Instagram';
        if (u.includes('facebook.com') || u.includes('fb.watch')) return 'Facebook';
        if (u.includes('twitter.com') || u.includes('x.com')) return 'Twitter';
        if (u.includes('bilibili.com') || u.includes('b23.tv')) return 'B站';
        if (u.includes('douyin.com')) return '抖音';
        if (u.includes('tiktok.com')) return 'TikTok';
        if (u.includes('pixiv.net')) return 'P站';
        
        return '普通平台'; // 默认返回普通平台
    }
}

module.exports = PlatformDetector;


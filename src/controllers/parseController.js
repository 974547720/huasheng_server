const singlePostExtractAction = require('../actions/parse/SinglePostExtractAction');

/**
 * 单帖子提取
 */
exports.extractPost = async (req, res) => {
    const { url } = req.body || {};
    const userId = req.user.id;

    if (!url) {
        return res.status(400).json({ success: false, message: '请提供需要解析的 URL 地址' });
    }

    try {
        const result = await singlePostExtractAction.execute(userId, url);
        res.json(result);
    } catch (error) {
        console.error('Extract Post Error:', error);
        res.status(400).json({ 
            success: false, 
            message: error.message 
        });
    }
};


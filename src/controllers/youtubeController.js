const youtubeService = require('../services/youtubeService');

const calculateIncome = async (req, res, next) => {
  try {
    const { channelUrl, language = 'ko' } = req.body;
    if (!channelUrl) {
      throw new Error('채널 URL이 필요합니다.');
    }

    const result = await youtubeService.calculateChannelIncome(channelUrl, language);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

const getChannelRankings = async (req, res, next) => {
  try {
    const rankings = await youtubeService.getChannelRankings(req.query);
    res.json({
      success: true,
      data: rankings
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  calculateIncome,
  getChannelRankings
}; 
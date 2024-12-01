const dotenv = require('dotenv');
dotenv.config();

// YouTube API 관련 설정
const config = {
  apiKey: process.env.YOUTUBE_API_KEY,
  baseUrl: 'https://www.googleapis.com/youtube/v3',
  // CPM 범위 (국가/카테고리별)
  cpmRanges: {
    KR: {
      MIN: 0.5,
      MAX: 4.0,
      gaming: { MIN: 1.0, MAX: 5.0 },
      education: { MIN: 2.0, MAX: 6.0 },
      entertainment: { MIN: 1.5, MAX: 4.5 }
    }
  }
};

// API 키 확인
if (!config.apiKey) {
  console.error('YouTube API 키 에러');
  process.exit(1);
}

module.exports = config; 
const axios = require('axios');
const config = require('../config/youtube');
const cache = require('../utils/cache');

class YoutubeService {
  constructor() {
    this.api = axios.create({
      baseURL: config.baseUrl,
      params: {
        key: config.apiKey
      }
    });
  }

  async calculateChannelIncome(channelUrl) {
    // 캐시 확인
    const cacheKey = `channel:${channelUrl}`;
    const cachedData = await cache.get(cacheKey);
    if (cachedData) return cachedData;

    const channelId = await this.extractChannelId(channelUrl);
    const channelInfo = await this.getChannelInfo(channelId);
    const recentVideos = await this.getRecentVideos(channelId);
    const averageViews = this.calculateAverageViews(recentVideos);
    
    const earnings = await this.calculateEarnings(channelInfo, averageViews);
    
    const result = {
      channelId,
      channelTitle: channelInfo.snippet.title,
      statistics: {
        subscribers: parseInt(channelInfo.statistics.subscriberCount),
        totalViews: parseInt(channelInfo.statistics.viewCount),
        videoCount: parseInt(channelInfo.statistics.videoCount),
        averageViews: {
          normal: averageViews.normal,
          shorts: averageViews.shorts,
          total: averageViews.normal + averageViews.shorts
        }
      },
      earnings,
      period: recentVideos.period
    };

    // 결과 캐싱
    await cache.set(cacheKey, result, 21600); // 6시간
    
    return result;
  }

  async extractChannelId(url) {
    try {
      // URL 디코딩
      const decodedUrl = decodeURIComponent(url);
      console.log('디코딩된 URL:', decodedUrl);

      const patterns = [
        /youtube\.com\/channel\/([^\/\?]+)/, // channel/UCxxxxxx
        /youtube\.com\/@([^\/\?]+)/,         // @username
        /youtube\.com\/c\/([^\/\?]+)/        // c/customname
      ];

      for (const pattern of patterns) {
        const match = decodedUrl.match(pattern);
        if (match) {
          // channel/UCxxxxxx 형식이면 바로 반환
          if (pattern.toString().includes('channel')) {
            return match[1];
          }
          
          // @username 또는 c/customname 형식이면 채널 ID 조회
          try {
            const channelName = match[1];
            console.log('검색할 채널명:', channelName);

            const response = await this.api.get('/search', {
              params: {
                part: 'snippet',
                type: 'channel',
                q: channelName,
                maxResults: 5
              }
            });

            if (response.data.items && response.data.items.length > 0) {
              // 정확한 채널명 매칭을 시도
              const exactMatch = response.data.items.find(item => 
                item.snippet.channelTitle === channelName || 
                `@${item.snippet.channelTitle}` === channelName
              );

              if (exactMatch) {
                console.log('정확히 일치하는 채널 찾음:', exactMatch.snippet.channelTitle);
                return exactMatch.snippet.channelId;
              }

              // 정확한 매칭이 없으면 첫 번째 결과 사용
              console.log('가장 유사한 채널 사용:', response.data.items[0].snippet.channelTitle);
              return response.data.items[0].snippet.channelId;
            }
          } catch (error) {
            console.error('채널 검색 실패:', error);
          }
        }
      }

      throw new Error('유효하지 않은 YouTube 채널 URL입니다.');
    } catch (error) {
      if (error.message === '유효하지 않은 YouTube 채널 URL입니다.') {
        throw error;
      }
      console.error('URL 처리 중 오류:', error);
      throw new Error('채널 URL을 처리하는데 실패했습니다.');
    }
  }

  async getChannelInfo(channelId) {
    try {
      console.log('채널 정보 요청:', channelId);
      const response = await this.api.get('/channels', {
        params: {
          part: 'snippet,statistics',
          id: channelId
        }
      });

      console.log('API 응답:', response.data);

      if (!response.data.items || response.data.items.length === 0) {
        throw new Error('채널을 찾을 수 없습니다.');
      }

      return response.data.items[0];
    } catch (error) {
      console.error('API 에러:', error.response?.data || error.message);
      if (error.response?.status === 403) {
        throw new Error('YouTube API 키가 유효하지 않거나 할당량이 초과되었습니다.');
      }
      throw new Error('채널 정보를 가져오는데 실패했습니다: ' + error.message);
    }
  }

  async getRecentVideos(channelId) {
    try {
      // 한 달 전 날짜 계산
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      const publishedAfter = oneMonthAgo.toISOString();

      // 일반 영상 조회
      const normalVideos = await this.api.get('/search', {
        params: {
          part: 'id',
          channelId: channelId,
          order: 'date',
          type: 'video',
          videoDuration: 'medium',
          publishedAfter,
          maxResults: 50
        }
      });

      // 쇼츠 조회
      const shortsVideos = await this.api.get('/search', {
        params: {
          part: 'id',
          channelId: channelId,
          order: 'date',
          type: 'video',
          videoDuration: 'short',
          publishedAfter,
          maxResults: 50
        }
      });

      // 각각의 상세 정보 조회
      const normalVideoDetails = await this.getVideosDetails(
        normalVideos.data.items.map(item => item.id.videoId)
      );
      const shortsVideoDetails = await this.getVideosDetails(
        shortsVideos.data.items.map(item => item.id.videoId)
      );

      return {
        normal: normalVideoDetails,
        shorts: shortsVideoDetails,
        period: {
          start: publishedAfter,
          end: new Date().toISOString()
        }
      };
    } catch (error) {
      throw new Error('동영상 목록을 가져오는데 실패했습니다: ' + error.message);
    }
  }

  async getVideosDetails(videoIds) {
    try {
      const response = await this.api.get('/videos', {
        params: {
          part: 'statistics',
          id: videoIds.join(',')
        }
      });

      return response.data.items;
    } catch (error) {
      throw new Error('동영상 상세 정보를 가져오는데 실패했습니다: ' + error.message);
    }
  }

  calculateAverageViews(videos) {
    const calculateAverage = (videoList) => {
      if (!videoList || videoList.length === 0) return 0;
      const totalViews = videoList.reduce((sum, video) => 
        sum + parseInt(video.statistics.viewCount), 0);
      return Math.floor(totalViews / videoList.length);
    };

    return {
      normal: calculateAverage(videos.normal),
      shorts: calculateAverage(videos.shorts)
    };
  }

  async calculateEarnings(channelInfo, averageViews) {
    try {
      const RPM = {
        normal: {
          MIN: 2.0,
          MAX: 7.0
        },
        shorts: {
          MIN: 0.2,
          MAX: 1.0
        }
      };

      const monthlyViews = {
        normal: averageViews.normal,
        shorts: averageViews.shorts
      };
      const yearlyViews = {
        normal: monthlyViews.normal * 12,
        shorts: monthlyViews.shorts * 12
      };

      // 일반 영상 수익 계산 (USD)
      const normalEarnings = {
        monthly: {
          min: Math.floor((monthlyViews.normal / 1000) * RPM.normal.MIN),
          max: Math.floor((monthlyViews.normal / 1000) * RPM.normal.MAX)
        },
        yearly: {
          min: Math.floor((yearlyViews.normal / 1000) * RPM.normal.MIN),
          max: Math.floor((yearlyViews.normal / 1000) * RPM.normal.MAX)
        }
      };
      normalEarnings.monthly.average = Math.floor((normalEarnings.monthly.min + normalEarnings.monthly.max) / 2);
      normalEarnings.yearly.average = Math.floor((normalEarnings.yearly.min + normalEarnings.yearly.max) / 2);

      // 쇼츠 수익 계산 (USD)
      const shortsEarnings = {
        monthly: {
          min: Math.floor((monthlyViews.shorts / 1000) * RPM.shorts.MIN),
          max: Math.floor((monthlyViews.shorts / 1000) * RPM.shorts.MAX)
        },
        yearly: {
          min: Math.floor((yearlyViews.shorts / 1000) * RPM.shorts.MIN),
          max: Math.floor((yearlyViews.shorts / 1000) * RPM.shorts.MAX)
        }
      };
      shortsEarnings.monthly.average = Math.floor((shortsEarnings.monthly.min + shortsEarnings.monthly.max) / 2);
      shortsEarnings.yearly.average = Math.floor((shortsEarnings.yearly.min + shortsEarnings.yearly.max) / 2);

      // 전체 수익 계산 (USD)
      const totalEarnings = {
        monthly: {
          min: normalEarnings.monthly.min + shortsEarnings.monthly.min,
          max: normalEarnings.monthly.max + shortsEarnings.monthly.max,
          average: normalEarnings.monthly.average + shortsEarnings.monthly.average
        },
        yearly: {
          min: normalEarnings.yearly.min + shortsEarnings.yearly.min,
          max: normalEarnings.yearly.max + shortsEarnings.yearly.max,
          average: normalEarnings.yearly.average + shortsEarnings.yearly.average
        }
      };

      return {
        normal: normalEarnings,
        shorts: shortsEarnings,
        total: totalEarnings,
        currency: 'USD'
      };
    } catch (error) {
      console.error('수익 계산 실패:', error);
      throw error;
    }
  }

}

module.exports = new YoutubeService(); 
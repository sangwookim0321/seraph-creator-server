// 간단한 인메모리 캐시 구현
const cache = new Map();

module.exports = {
  async get(key) {
    const item = cache.get(key);
    if (!item) return null;
    if (Date.now() > item.expiry) {
      cache.delete(key);
      return null;
    }
    return item.value;
  },

  async set(key, value, ttlSeconds = 3600) {
    cache.set(key, {
      value,
      expiry: Date.now() + (ttlSeconds * 1000)
    });
  }
}; 
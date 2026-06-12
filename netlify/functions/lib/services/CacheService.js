/**
 * Cache Service for Google Sheets data with smart invalidation
 * 
 * Cache Groups:
 * - tour-requests: Independent tour request data
 * - tour-guides: Independent guide data  
 * - public-tours-and-registrations: Interdependent public tour and registration data
 */

class CacheService {
  constructor() {
    this.cache = new Map();
    this.defaultTTL = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    // Define cache groups for smart invalidation
    this.cacheGroups = {
      'tour-requests': ['tour-requests'],
      'tour-guides': ['tour-guides'],
      'public-tours-and-registrations': ['public-tours', 'public-tour-registrations']
    };
  }

  /**
   * Get data from cache if valid, otherwise return null
   */
  get(key) {
    const cached = this.cache.get(key);
    
    if (!cached) {
      return null;
    }
    
    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    console.log(`Cache HIT for key: ${key}`);
    return cached.data;
  }

  /**
   * Store data in cache with TTL
   */
  set(key, data, ttl = this.defaultTTL) {
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, {
      data,
      expiresAt,
      createdAt: Date.now()
    });
    
    console.log(`Cache SET for key: ${key}, expires in ${ttl/1000}s`);
  }

  /**
   * Clear specific cache key
   */
  delete(key) {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`Cache DELETED key: ${key}`);
    }
    return deleted;
  }

  /**
   * Clear cache group - invalidates related cache keys
   */
  clearGroup(groupName) {
    const keys = this.cacheGroups[groupName];
    if (!keys) {
      console.warn(`Unknown cache group: ${groupName}`);
      return;
    }

    let clearedCount = 0;
    keys.forEach(key => {
      if (this.cache.delete(key)) {
        clearedCount++;
      }
    });

    console.log(`Cache GROUP CLEARED: ${groupName} (${clearedCount} keys removed)`);
  }

  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`Cache CLEARED ALL (${size} keys removed)`);
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      totalKeys: this.cache.size,
      groups: {}
    };

    // Count keys by group
    Object.entries(this.cacheGroups).forEach(([groupName, keys]) => {
      stats.groups[groupName] = {
        keys: keys.filter(key => this.cache.has(key)),
        cached: keys.filter(key => this.cache.has(key)).length,
        total: keys.length
      };
    });

    return stats;
  }

  /**
   * Wrapper for cache-aside pattern
   * Tries cache first, executes function if miss, then caches result
   */
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    // Try cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch fresh data
    console.log(`Cache MISS for key: ${key}, fetching fresh data`);
    const data = await fetchFunction();
    
    // Cache the result
    this.set(key, data, ttl);
    
    return data;
  }
}

// Create singleton instance
const cacheService = new CacheService();

module.exports = { cacheService };
/**
 * Cached Data Service - Adds intelligent caching to DataRepository
 * 
 * Implements cache-aside pattern with smart invalidation groups:
 * - tour-requests: Independent tour request data
 * - tour-guides: Independent guide data  
 * - public-tours-and-registrations: Interdependent public tour and registration data
 */

const DataRepository = require('./DataRepository');
const { cacheService } = require('./CacheService');

class CachedDataService {
  constructor() {
    this.dataRepository = new DataRepository();
    this.cacheKeys = {
      TOUR_REQUESTS: 'tour-requests',
      TOUR_GUIDES: 'tour-guides', 
      PUBLIC_TOURS: 'public-tours',
      PUBLIC_TOUR_REGISTRATIONS: 'public-tour-registrations'
    };
  }

  async initialize() {
    await this.dataRepository.initialize();
  }

  // ============================================================================
  // READ OPERATIONS (with caching)
  // ============================================================================

  async getAllTourRequests() {
    return await cacheService.getOrSet(
      this.cacheKeys.TOUR_REQUESTS,
      () => this.dataRepository.getAllTourRequests()
    );
  }

  async getAllTourGuides() {
    return await cacheService.getOrSet(
      this.cacheKeys.TOUR_GUIDES,
      () => this.dataRepository.getAllTourGuides()
    );
  }

  async getTourGuideById(id) {
    // For individual guide lookups, we'll get all guides from cache
    // This is more efficient than separate cache keys per guide
    const allGuides = await this.getAllTourGuides();
    const guide = allGuides.find(g => g.id == id);
    
    if (!guide) {
      throw new Error('Tour guide not found');
    }
    
    return guide;
  }

  async getAllPublicTours() {
    return await cacheService.getOrSet(
      this.cacheKeys.PUBLIC_TOURS,
      () => this.dataRepository.getAllPublicTours()
    );
  }

  async getPublicTourById(id) {
    // Get all tours from cache (includes registrations)
    const allTours = await this.getAllPublicTours();
    const tour = allTours.find(t => t.id == id);
    
    if (!tour) {
      throw new Error('Public tour not found');
    }
    
    return tour;
  }

  async getAllPublicTourRegistrations() {
    return await cacheService.getOrSet(
      this.cacheKeys.PUBLIC_TOUR_REGISTRATIONS,
      () => this.dataRepository.getAllPublicTourRegistrations()
    );
  }

  async getPublicTourRegistrations(tourId) {
    const allRegistrations = await this.getAllPublicTourRegistrations();
    return allRegistrations.filter(reg => reg.public_tour_id === tourId);
  }

  async getAnalytics() {
    // Analytics use combined data, so we'll cache this separately with shorter TTL
    return await cacheService.getOrSet(
      'analytics',
      () => this.dataRepository.getAnalytics(),
      5 * 60 * 1000 // 5 minutes TTL for analytics
    );
  }

  // ============================================================================
  // WRITE OPERATIONS (with cache invalidation)
  // ============================================================================

  // Tour Requests Operations
  async createTourRequest(data) {
    const result = await this.dataRepository.createTourRequest(data);
    
    // Invalidate tour requests cache
    cacheService.clearGroup('tour-requests');
    
    // Clear analytics cache since it includes tour request counts
    cacheService.delete('analytics');
    
    return result;
  }

  async updateTourRequestStatus(id, status) {
    const result = await this.dataRepository.updateTourRequestStatus(id, status);
    
    // Invalidate tour requests cache  
    cacheService.clearGroup('tour-requests');
    cacheService.delete('analytics');
    
    return result;
  }

  async assignGuideToRequest(id, guideId) {
    const result = await this.dataRepository.assignGuideToRequest(id, guideId);
    
    // Invalidate tour requests cache
    cacheService.clearGroup('tour-requests');
    cacheService.delete('analytics');
    
    return result;
  }

  async updateRequestCalendarEventId(id, eventId) {
    const result = await this.dataRepository.updateRequestCalendarEventId(id, eventId);
    
    // Invalidate tour requests cache
    cacheService.clearGroup('tour-requests');
    
    return result;
  }

  async updateTourRequest(data) {
    const result = await this.dataRepository.updateTourRequest(data);
    
    // Invalidate tour requests cache
    cacheService.clearGroup('tour-requests');
    cacheService.delete('analytics');
    
    return result;
  }

  // Tour Guides Operations
  async createTourGuide(data) {
    const result = await this.dataRepository.createTourGuide(data);
    
    // Invalidate tour guides cache
    cacheService.clearGroup('tour-guides');
    cacheService.delete('analytics');
    
    return result;
  }

  async updateTourGuide(data) {
    const result = await this.dataRepository.updateTourGuide(data);
    
    // Invalidate tour guides cache
    cacheService.clearGroup('tour-guides');
    
    return result;
  }

  async deleteTourGuide(id) {
    const result = await this.dataRepository.deleteTourGuide(id);
    
    // Invalidate tour guides cache
    cacheService.clearGroup('tour-guides');
    cacheService.delete('analytics');
    
    return result;
  }

  // Public Tours Operations
  async createPublicTour(data) {
    const result = await this.dataRepository.createPublicTour(data);
    
    // Invalidate public tours and registrations cache (paired group)
    cacheService.clearGroup('public-tours-and-registrations');
    cacheService.delete('analytics');
    
    return result;
  }

  async updatePublicTour(data) {
    const result = await this.dataRepository.updatePublicTour(data);
    
    // Invalidate public tours and registrations cache (paired group)
    cacheService.clearGroup('public-tours-and-registrations');
    cacheService.delete('analytics');
    
    return result;
  }

  async deletePublicTour(id) {
    const result = await this.dataRepository.deletePublicTour(id);
    
    // Invalidate public tours and registrations cache (paired group)
    cacheService.clearGroup('public-tours-and-registrations');
    cacheService.delete('analytics');
    
    return result;
  }

  // Public Tour Registrations Operations
  async createPublicTourRegistration(data) {
    const result = await this.dataRepository.createPublicTourRegistration(data);
    
    // Invalidate public tours and registrations cache (paired group)
    // This affects tour capacity counts in public tours
    cacheService.clearGroup('public-tours-and-registrations');
    cacheService.delete('analytics');
    
    return result;
  }

  async updatePublicTourRegistration(data) {
    const result = await this.dataRepository.updatePublicTourRegistration(data);
    
    // Invalidate public tours and registrations cache (paired group)
    cacheService.clearGroup('public-tours-and-registrations');
    cacheService.delete('analytics');
    
    return result;
  }

  async deletePublicTourRegistration(id) {
    const result = await this.dataRepository.deletePublicTourRegistration(id);
    
    // Invalidate public tours and registrations cache (paired group)
    cacheService.clearGroup('public-tours-and-registrations');
    cacheService.delete('analytics');
    
    return result;
  }

  // ============================================================================
  // CACHE MANAGEMENT
  // ============================================================================

  getCacheStats() {
    return cacheService.getStats();
  }

  clearAllCache() {
    cacheService.clear();
  }

  clearCacheGroup(groupName) {
    cacheService.clearGroup(groupName);
  }
}

// Export singleton instance
const cachedDataService = new CachedDataService();

module.exports = { cachedDataService, CachedDataService };
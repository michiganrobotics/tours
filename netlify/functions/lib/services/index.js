/**
 * Services Index - Exports all service classes
 * Provides a single import point for all services
 */

const DataRepository = require('./DataRepository');
const NotificationService = require('./NotificationService');
const CalendarService = require('./CalendarService');
const { cachedDataService } = require('./CachedDataService');

// Create singleton instances
let dataRepository = null;
let notificationService = null;
let calendarService = null;

/**
 * Get initialized DataRepository instance (uncached)
 */
async function getDataRepository() {
  if (!dataRepository) {
    dataRepository = new DataRepository();
    await dataRepository.initialize();
  }
  return dataRepository;
}

/**
 * Get initialized CachedDataService instance (recommended)
 * NOTE: Temporarily disabled due to serverless function isolation
 */
async function getCachedDataService() {
  // Temporarily return uncached service due to function isolation issues
  return await getDataRepository();
}

/**
 * Get NotificationService instance
 */
function getNotificationService() {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}

/**
 * Get initialized CalendarService instance
 */
async function getCalendarService() {
  if (!calendarService) {
    calendarService = new CalendarService();
    await calendarService.initialize();
  }
  return calendarService;
}

module.exports = {
  DataRepository,
  NotificationService,
  CalendarService,
  getDataRepository,
  getCachedDataService,
  getNotificationService,
  getCalendarService
};
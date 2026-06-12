const { getCachedDataService } = require('./lib/services');
const { withRateLimit } = require('./lib/rateLimiter');
const { requireAuth } = require('./lib/auth');

// Main handler function
async function mainHandler(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {}
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {},
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Email log contains visitor email addresses - admin only
  const authError = requireAuth(event);
  if (authError) {
    return authError;
  }

  try {
    const dataService = await getCachedDataService();
    const dataRepository = dataService.dataRepository || dataService;

    let entries = await dataRepository.getEmailLog();

    // Optional filters: ?tour_id=...&tour_type=private|public
    const params = event.queryStringParameters || {};
    if (params.tour_id) {
      entries = entries.filter(e => e.tour_id === String(params.tour_id));
    }
    if (params.tour_type) {
      entries = entries.filter(e => e.tour_type === params.tour_type);
    }

    // Newest first
    entries.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    return {
      statusCode: 200,
      headers: {},
      body: JSON.stringify(entries)
    };
  } catch (error) {
    console.error('Email log API error:', error);
    return {
      statusCode: 500,
      headers: {},
      body: JSON.stringify({ error: 'Failed to load email log' })
    };
  }
}

// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};

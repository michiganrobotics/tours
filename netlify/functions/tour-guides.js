const { getCachedDataService } = require('./lib/services');
const { withRateLimit } = require('./lib/rateLimiter');
const { requireAuth } = require('./lib/auth');

// Main handler function
async function mainHandler(event, context) {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {},
      body: '',
    };
  }

  // Require authentication for all tour guide operations (contains sensitive data)
  const authError = requireAuth(event);
  if (authError) {
    return authError;
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        const dataService = await getCachedDataService();
        const guides = await dataService.getAllTourGuides();
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(guides),
        };

      case 'POST':
        const newGuide = JSON.parse(event.body);
        const dataService1 = await getCachedDataService();
        const result = await dataService1.createTourGuide(newGuide);
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(result),
        };

      case 'PUT':
        const updateGuide = JSON.parse(event.body);
        const dataService2 = await getCachedDataService();
        const updateResult = await dataService2.updateTourGuide(updateGuide);
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(updateResult),
        };

      case 'DELETE':
        const deleteData = JSON.parse(event.body);
        const dataService3 = await getCachedDataService();
        const deleteResult = await dataService3.deleteTourGuide(deleteData.id);
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(deleteResult),
        };

      default:
        return {
          statusCode: 405,
          headers: {},
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in tour-guides function:', error);
    return {
      statusCode: 500,
      headers: {},
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};
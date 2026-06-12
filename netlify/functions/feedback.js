const { getCachedDataService } = require('./lib/services');
const { withRateLimit } = require('./lib/rateLimiter');
const { requireAuth } = require('./lib/auth');

// Main handler function
async function mainHandler(event, context) {
  console.log('Feedback function called:', event.httpMethod, event.path);
  
  // Ensure headers exist to avoid rate limiter errors
  if (!event.headers) {
    event.headers = {};
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  // Require authentication for GET (viewing feedback data)
  if (event.httpMethod === 'GET') {
    const authError = requireAuth(event);
    if (authError) {
      return authError;
    }
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        const dataService = await getCachedDataService();
        const feedback = await dataService.getAllFeedback();
        return {
          statusCode: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(feedback),
        };

      default:
        return {
          statusCode: 405,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

  } catch (error) {
    console.error('Error in feedback function:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        details: error.message
      }),
    };
  }
}

// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};
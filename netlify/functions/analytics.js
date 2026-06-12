const { getCachedDataService } = require('./lib/services');
const { requireAuth } = require('./lib/auth');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }

  // Require authentication for analytics data
  const authError = requireAuth(event);
  if (authError) {
    return authError;
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        const dataService = await getCachedDataService();
        const analytics = await dataService.getAnalytics();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(analytics),
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in analytics function:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
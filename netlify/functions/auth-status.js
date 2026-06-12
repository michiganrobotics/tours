const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;

exports.handler = async (event, context) => {
  try {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Check if required environment variables are set
    if (!CLIENT_SECRET) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ authenticated: false })
      };
    }

    // Get auth token from cookie
    const cookies = event.headers.cookie || '';
    const authToken = cookies
      .split(';')
      .find(cookie => cookie.trim().startsWith('auth_token='))
      ?.split('=')[1];

    if (!authToken) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ authenticated: false })
      };
    }

    try {
      // Verify JWT token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(authToken, CLIENT_SECRET);
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          authenticated: true,
          user: {
            sub: decoded.sub,
            name: decoded.name,
            email: decoded.email
          }
        })
      };
    } catch (jwtError) {
      // Token is invalid or expired
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ authenticated: false })
      };
    }

  } catch (error) {
    console.error('Auth status error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Authentication check failed' })
    };
  }
};
/**
 * Authentication helper for protecting sensitive endpoints
 */

const jwt = require('jsonwebtoken');
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;

/**
 * Check if user is authenticated based on JWT token in cookie
 */
function isAuthenticated(event) {
  try {
    // Bypass auth only if explicitly enabled in dev environment
    if (process.env.BYPASS_AUTH_FOR_DEV === 'true') {
      return {
        authenticated: true,
        user: {
          sub: 'dev-user',
          name: 'Development User',
          email: 'dev@localhost'
        }
      };
    }

    // Check if auth is configured
    if (!CLIENT_SECRET) {
      return { authenticated: false, reason: 'Auth not configured' };
    }

    // Get auth token from cookie
    const cookies = event.headers.cookie || '';
    const authToken = cookies
      .split(';')
      .find(cookie => cookie.trim().startsWith('auth_token='))
      ?.split('=')[1];

    if (!authToken) {
      return { authenticated: false, reason: 'No auth token' };
    }

    // Verify JWT token
    const decoded = jwt.verify(authToken, CLIENT_SECRET);
    
    return {
      authenticated: true,
      user: {
        sub: decoded.sub,
        name: decoded.name,
        email: decoded.email
      }
    };
  } catch (error) {
    return { authenticated: false, reason: 'Invalid token' };
  }
}

/**
 * Middleware to require authentication for an endpoint
 */
function requireAuth(event) {
  const authResult = isAuthenticated(event);
  
  if (!authResult.authenticated) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        error: 'Authentication required',
        message: 'You must be logged in to access this resource'
      })
    };
  }
  
  return null; // Auth successful, no error response
}

module.exports = {
  isAuthenticated,
  requireAuth
};
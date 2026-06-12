/**
 * Simple in-memory rate limiter for Netlify Functions
 * Uses sliding window approach with automatic cleanup
 */

// In-memory store for tracking requests
const requestStore = new Map();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, requests] of requestStore.entries()) {
    // Remove requests older than 1 hour
    const validRequests = requests.filter(timestamp => now - timestamp < 3600000);
    if (validRequests.length === 0) {
      requestStore.delete(key);
    } else {
      requestStore.set(key, validRequests);
    }
  }
}, 300000); // 5 minutes

/**
 * Rate limiting configuration for different endpoints
 */
const RATE_LIMITS = {
  // Public endpoints - more restrictive
  'public-tours': { maxRequests: 1000, windowMs: 3600000 }, // 1000 requests per hour
  'public-tour-registrations': { maxRequests: 100, windowMs: 3600000 }, // 100 registrations per hour
  'tour-requests': { maxRequests: 1000, windowMs: 3600000 }, // 10 tour requests per hour
  
  // Admin endpoints - less restrictive but still protected
  'assign-guide': { maxRequests: 50, windowMs: 3600000 }, // 50 assignments per hour
  'tour-guides': { maxRequests: 200, windowMs: 3600000 }, // 200 requests per hour
  
  // Email endpoints - very restrictive
  'send-email': { maxRequests: 20, windowMs: 3600000 }, // 20 emails per hour
  'send-reminder-emails': { maxRequests: 5, windowMs: 3600000 }, // 5 bulk sends per hour
  
  // Default fallback
  'default': { maxRequests: 50, windowMs: 3600000 } // 50 requests per hour
};

/**
 * Get client identifier from request
 * Uses IP address and User-Agent for better uniqueness
 */
function getClientId(event) {
  const ip = event.headers['x-forwarded-for'] || 
            event.headers['x-real-ip'] || 
            event.requestContext?.identity?.sourceIp || 
            'unknown';
  
  const userAgent = event.headers['user-agent'] || 'unknown';
  
  // Create a simple hash of IP + first part of user agent
  const identifier = `${ip}-${userAgent.substring(0, 50)}`;
  return identifier;
}

/**
 * Extract endpoint name from event path
 */
function getEndpointName(event) {
  const path = event.path || event.rawPath || '';
  const match = path.match(/\/api\/([^\/]+)/);
  return match ? match[1] : 'default';
}

/**
 * Check if request should be rate limited
 * @param {Object} event - Netlify function event
 * @returns {Object} - { allowed: boolean, headers: Object, remaining: number }
 */
function checkRateLimit(event) {
  const clientId = getClientId(event);
  const endpoint = getEndpointName(event);
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS.default;
  
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Get or create request history for this client
  const requestHistory = requestStore.get(clientId) || [];
  
  // Filter to only requests within the current window
  const recentRequests = requestHistory.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  const allowed = recentRequests.length < config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - recentRequests.length);
  
  if (allowed) {
    // Add current request to history
    recentRequests.push(now);
    requestStore.set(clientId, recentRequests);
  }
  
  // Calculate reset time (when the oldest request will expire)
  const oldestRequest = recentRequests[0] || now;
  const resetTime = Math.ceil((oldestRequest + config.windowMs) / 1000);
  
  // Return rate limit headers
  const headers = {
    'X-RateLimit-Limit': config.maxRequests.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': resetTime.toString(),
    'X-RateLimit-Window': Math.ceil(config.windowMs / 1000).toString()
  };
  
  return {
    allowed,
    headers,
    remaining,
    resetTime
  };
}

/**
 * Middleware function to add rate limiting to any endpoint
 * @param {Object} event - Netlify function event
 * @param {Function} handler - Original handler function
 * @returns {Object} - Response object
 */
async function withRateLimit(event, handler) {
  const rateLimit = checkRateLimit(event);
  
  // Always include rate limit headers
  const baseHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    ...rateLimit.headers
  };
  
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: baseHeaders,
      body: JSON.stringify({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again in ${Math.ceil((rateLimit.resetTime * 1000 - Date.now()) / 60000)} minutes.`,
        retryAfter: rateLimit.resetTime
      })
    };
  }
  
  try {
    // Call the original handler
    const response = await handler(event);
    
    // Merge rate limit headers with response headers
    return {
      ...response,
      headers: {
        ...response.headers,
        ...rateLimit.headers
      }
    };
  } catch (error) {
    // Return error with rate limit headers
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: error.message })
    };
  }
}

module.exports = {
  withRateLimit,
  checkRateLimit,
  RATE_LIMITS
};
const crypto = require('crypto');

const OIDC_ISSUER = 'https://shibboleth.umich.edu';
const CLIENT_ID = process.env.OIDC_CLIENT_ID;
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const REDIRECT_URI = 'https://tours.robotics.umich.edu/auth/callback';

// Generate random string for state/nonce
function generateRandomString(length = 32) {
  return crypto.randomBytes(length).toString('base64url');
}

exports.handler = async (event, context) => {
  try {
    // Only allow GET requests for OAuth login
    if (event.httpMethod !== 'GET') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Check if required environment variables are set
    if (!CLIENT_ID || !CLIENT_SECRET) {
      console.error('Missing OIDC environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Authentication not configured' })
      };
    }

    // Generate state and nonce for security
    const state = generateRandomString();
    const nonce = generateRandomString();

    // Manually construct the authorization URL
    // This is the correct OIDC authorization endpoint for UMich Shibboleth
    const authUrl = new URL(`${OIDC_ISSUER}/idp/profile/oidc/authorize`);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.set('scope', 'openid profile email edumember');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);

    console.log('Redirecting to auth URL:', authUrl.toString());

    return {
      statusCode: 302,
      headers: {
        'Location': authUrl.toString()
      },
      body: ''
    };

  } catch (error) {
    console.error('Auth login error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Authentication service unavailable' })
    };
  }
};
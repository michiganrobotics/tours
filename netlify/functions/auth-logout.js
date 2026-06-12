exports.handler = async (event, context) => {
  try {
    // Only allow POST requests for logout
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }

    // Clear authentication cookie
    const clearCookie = [
      'auth_token=',
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      'Path=/',
      'Max-Age=0'
    ].join('; ');

    return {
      statusCode: 302,
      headers: {
        'Location': '/signup',
        'Set-Cookie': clearCookie
      },
      body: ''
    };

  } catch (error) {
    console.error('Auth logout error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Logout failed' })
    };
  }
};
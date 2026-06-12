const OIDC_ISSUER = 'https://shibboleth.umich.edu';
const CLIENT_ID = process.env.OIDC_CLIENT_ID;
const CLIENT_SECRET = process.env.OIDC_CLIENT_SECRET;
const REDIRECT_URI = 'https://tours.robotics.umich.edu/auth/callback';

exports.handler = async (event, context) => {
  try {
    // Only allow GET requests for OAuth callback
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
        statusCode: 302,
        headers: {
          'Location': '/?error=auth_not_configured'
        },
        body: ''
      };
    }

    const { code, state, error } = event.queryStringParameters || {};

    if (error) {
      console.error('OAuth error:', error);
      return {
        statusCode: 302,
        headers: {
          'Location': '/?error=auth_failed'
        },
        body: ''
      };
    }

    if (!code) {
      return {
        statusCode: 302,
        headers: {
          'Location': '/?error=missing_code'
        },
        body: ''
      };
    }

    // Exchange authorization code for tokens
    const tokenUrl = `${OIDC_ISSUER}/idp/profile/oidc/token`;
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    });

    console.log('Exchanging code for tokens...');
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: tokenParams.toString()
    });

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenResponse.status, await tokenResponse.text());
      return {
        statusCode: 302,
        headers: {
          'Location': '/?error=token_exchange_failed'
        },
        body: ''
      };
    }

    const tokens = await tokenResponse.json();
    console.log('Token exchange successful');
    
    // Check if group info is in the ID token
    if (tokens.id_token) {
      try {
        const jwt = require('jsonwebtoken');
        // Decode without verification for debugging (don't do this in production)
        const idTokenPayload = jwt.decode(tokens.id_token);
        console.log('ID Token payload:', idTokenPayload);
        console.log('ID Token keys:', Object.keys(idTokenPayload || {}));
      } catch (error) {
        console.log('Error decoding ID token:', error);
      }
    }

    // Get user info using access token
    const userinfoUrl = `${OIDC_ISSUER}/idp/profile/oidc/userinfo`;
    const userinfoResponse = await fetch(userinfoUrl, {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    if (!userinfoResponse.ok) {
      console.error('Userinfo request failed:', userinfoResponse.status);
      return {
        statusCode: 302,
        headers: {
          'Location': '/?error=userinfo_failed'
        },
        body: ''
      };
    }

    const userinfo = await userinfoResponse.json();
    console.log('Got user info:', userinfo);

    // Check if user is member of the required group
    const requiredGroup = 'Robotics Tour Dashboard'; // U-M OIDC returns group display name, not email
    // U-M OIDC uses edumember_is_member_of for group membership
    const userGroups = userinfo.edumember_is_member_of || userinfo.groups || [];
    
    console.log('User info keys:', Object.keys(userinfo));
    console.log('User groups (edumember_is_member_of):', userinfo.edumember_is_member_of);
    console.log('User groups (groups):', userinfo.groups);
    console.log('Required group:', requiredGroup);
    
    const isMember = Array.isArray(userGroups) ? userGroups.includes(requiredGroup) : false;
    
    if (!isMember) {
      console.log('User is not a member of required group:', requiredGroup);
      return {
        statusCode: 302,
        headers: {
          'Location': '/?error=access_denied&message=You must be a member of the Robotics Tour Dashboard group to access this application.'
        },
        body: ''
      };
    }

    console.log('User is authorized - member of required group');

    // In production, store session data in database or secure storage
    // For now, encode user info in JWT token (not recommended for production)
    let userToken;
    try {
      const jwt = require('jsonwebtoken');
      userToken = jwt.sign(
        { 
          sub: userinfo.sub,
          name: userinfo.name,
          email: userinfo.email,
          groups: userinfo.edumember_is_member_of || userinfo.groups || [],
          exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
        },
        CLIENT_SECRET
      );
    } catch (jwtError) {
      console.error('JWT signing failed:', jwtError);
      return {
        statusCode: 302,
        headers: {
          'Location': '/?error=token_creation_failed'
        },
        body: ''
      };
    }

    return {
      statusCode: 302,
      headers: {
        'Location': '/',
        'Set-Cookie': `auth_token=${userToken}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 24 * 7}`
      },
      body: ''
    };

  } catch (error) {
    console.error('Auth callback error:', error);
    return {
      statusCode: 500,
      headers: {
        'Location': '/?error=server_error'
      },
      body: ''
    };
  }
};
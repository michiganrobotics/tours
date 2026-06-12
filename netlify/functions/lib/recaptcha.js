// reCAPTCHA v3 validation helper
async function validateRecaptcha(token, expectedAction = null, minimumScore = 0.5) {
  try {
    if (!process.env.RECAPTCHA_SECRET_KEY) {
      console.error('RECAPTCHA_SECRET_KEY not configured');
      return { success: false, error: 'reCAPTCHA not configured' };
    }

    if (!token) {
      return { success: false, error: 'No reCAPTCHA token provided' };
    }

    // Verify token with Google
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: process.env.RECAPTCHA_SECRET_KEY,
        response: token
      })
    });

    const data = await response.json();

    if (!data.success) {
      console.error('reCAPTCHA validation failed:', data['error-codes']);
      return { success: false, error: 'reCAPTCHA validation failed', details: data['error-codes'] };
    }

    // Check action if provided
    if (expectedAction && data.action !== expectedAction) {
      console.error(`reCAPTCHA action mismatch. Expected: ${expectedAction}, Got: ${data.action}`);
      return { success: false, error: 'Invalid action' };
    }

    // Check score (v3 only)
    if (data.score !== undefined && data.score < minimumScore) {
      console.warn(`reCAPTCHA score too low: ${data.score} (minimum: ${minimumScore})`);
      return { success: false, error: 'Low confidence score', score: data.score };
    }

    return { 
      success: true, 
      score: data.score, 
      action: data.action,
      challenge_ts: data.challenge_ts,
      hostname: data.hostname
    };

  } catch (error) {
    console.error('reCAPTCHA validation error:', error);
    return { success: false, error: 'Validation service error' };
  }
}

module.exports = { validateRecaptcha };
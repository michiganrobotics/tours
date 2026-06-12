# reCAPTCHA v3 Configuration

## Production Configuration

The current implementation uses the production reCAPTCHA v3 site key (`6LeKK2UrAAAAAAKPM3P7FqJRaFprim_ti5EGCFDR`).

### Site Key (Client-side)
The site key is configured in:
- `public/signup.html` line 12 (script src)
- `public/signup.js` line 5 (RECAPTCHA_SITE_KEY constant)

### Secret Key (Server-side) 
**⚠️ REQUIRED**: You must add your reCAPTCHA secret key as an environment variable:

```bash
RECAPTCHA_SECRET_KEY=your_secret_key_here
```

Add this to your Netlify environment variables:
1. Go to your Netlify site dashboard
2. Navigate to Site settings → Environment variables  
3. Add new variable: `RECAPTCHA_SECRET_KEY` = `your_secret_key_from_google`

## Current Implementation

- **reCAPTCHA v3**: Invisible, frictionless user experience
- **Public Tour Registration**: Action `public_tour_registration`
- **Special Tour Request**: Action `special_tour_request`
- **Token Generation**: Tokens are generated on form submission
- **Server Validation**: Tokens are verified on the backend

### Server-side Validation

Both forms now include server-side reCAPTCHA validation:

- **`/api/public-tour-registrations`**: Validates `public_tour_registration` action
- **`/api/tour-requests`**: Validates `special_tour_request` action
- **Minimum Score**: 0.5 (configurable, range 0.0-1.0)
- **Action Verification**: Ensures the correct action was used
- **Error Handling**: Returns 400 status for failed validation

Validation is implemented in `netlify/functions/lib/recaptcha.js`

## Actions Tracked

- `public_tour_registration` - When users register for public tours
- `special_tour_request` - When users request special tours

## Production Ready

The production site key is now configured and ready for use on the robotics.umich.edu domain.

## Benefits of v3

- No user interaction required
- Better user experience
- Advanced bot detection
- Score-based verification (0.0 to 1.0)
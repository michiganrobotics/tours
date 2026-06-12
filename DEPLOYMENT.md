# Netlify Deployment Guide

## 🚀 Deploy to Netlify

### 1. Prepare Repository
```bash
# Initialize git repo (if not done)
git init
git add .
git commit -m "Initial commit - Robotics Tours Dashboard"

# Push to GitHub
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

### 2. Netlify Site Setup
1. Go to [Netlify](https://netlify.com)
2. Click "Add new site" → "Import an existing project"
3. Connect to GitHub and select your repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `public`
   - **Functions directory**: `netlify/functions`

### 3. Environment Variables
In Netlify dashboard → Site settings → Environment variables, add:

```
GOOGLE_SERVICE_ACCOUNT_KEY = [paste your service account JSON here]
```

**Note:** Use the JSON from your existing service account file, not the example above.

### 4. Custom Domain Setup
1. In Netlify dashboard → Domain settings
2. Add custom domain: `tours.robotics.umich.edu`
3. Configure DNS with your domain provider:
   - Add CNAME record: `tours` → `robotics-tours.netlify.app`

### 5. Test Deployment
1. Deploy should trigger automatically on git push
2. Test all functionality:
   - ✅ Dashboard loads with UMich authentication
   - ✅ Signup page accessible without authentication
   - ✅ Tour requests display
   - ✅ Tour guides display  
   - ✅ Status updates work
   - ✅ New requests can be added
   - ✅ Authentication flow works with UMich Shibboleth

## 🔧 Local Development with Netlify

```bash
# Install Netlify CLI
npm install

# Start local development server
npm run netlify-dev

# Access at http://localhost:8888
```

## 📋 API Endpoints

All API endpoints are now serverless functions:

**Authentication Endpoints:**
- `GET /.netlify/functions/auth-login` - Initiate UMich Shibboleth login
- `GET /.netlify/functions/auth-callback` - Handle OIDC callback
- `GET /.netlify/functions/auth-status` - Check authentication status
- `POST /.netlify/functions/auth-logout` - Logout user

**Data Endpoints:**
- `GET /.netlify/functions/tour-requests` - Get all tour requests
- `POST /.netlify/functions/tour-requests` - Create new tour request  
- `PUT /.netlify/functions/tour-requests/{id}` - Update tour request status
- `GET /.netlify/functions/tour-guides` - Get all tour guides
- `POST /.netlify/functions/tour-guides` - Create new tour guide
- `GET /.netlify/functions/interest-areas` - Get interest areas
- `GET /.netlify/functions/analytics` - Get dashboard analytics

## 🔐 Security Notes

- Service account credentials are stored as environment variables
- All functions include CORS headers for cross-origin requests
- Google Sheets API provides data persistence and backup
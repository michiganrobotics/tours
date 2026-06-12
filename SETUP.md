# Email, Calendar, and Authentication Setup Guide

## Required Environment Variables

Set these in your Netlify site settings under Environment Variables:

### Authentication Configuration (UMich Shibboleth OIDC)
```
OIDC_CLIENT_ID=your_client_id_here
OIDC_CLIENT_SECRET=your_client_secret_here
```

**Setup Process**:
1. Contact U-M ITS Identity and Access Management team
2. Submit the Shibboleth Configuration Request Form
3. Specify these details:
   - Service Provider Type: OIDC
   - Redirect URI: `https://tours.robotics.umich.edu/auth/callback`
   - Logout URI: `https://tours.robotics.umich.edu/signup` (optional)
   - Required attributes: openid, profile, email
4. Wait up to 2 business days for approval
5. Add the provided CLIENT_ID and CLIENT_SECRET to your environment variables

**Authentication Flow**:
- `/` (root) - Protected dashboard (requires UMich login)
- `/signup` - Public tour registration page (no authentication required)
- Users are redirected to UMich Shibboleth for authentication
- After successful login, they're redirected back to the dashboard

### Mailgun Configuration
```
MAILGUN_API_KEY=your_mailgun_api_key_here
MAILGUN_DOMAIN=robotics.umich.edu
```

**Note**: Using `robotics.umich.edu` as the sending domain. You'll need to:
1. Verify this domain with Mailgun by adding the required DNS records
2. Coordinate with UM IT to add the necessary MX, TXT, and CNAME records
3. Emails will be sent from `tours@robotics.umich.edu`

### Google Calendar Configuration
```
GOOGLE_CALENDAR_ID=your_google_calendar_id_here
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
```

Use the existing Google service account key from your `.env` file.

### Site URL
```
URL=https://tours.robotics.umich.edu
```

## Email Flow

1. **Tour Request Submitted**
   - Visitor gets confirmation email
   - `robotics-tours@umich.edu` gets notification

2. **Tour Scheduled** (when guide assigned + status = "scheduled")
   - Visitor gets scheduled email with calendar invite
   - Guide gets assignment email with calendar invite
   - Google Calendar event created automatically

3. **Daily Reminder Emails**
   - Automated 24-hour reminders to visitors and guides
   - Includes directions, parking info, and checklists
   - Sent daily at 9:00 AM EST for next-day tours

### Scheduling Reminder Emails

**Option 1: GitHub Actions (Recommended - Free)**
```yaml
# Already configured in .github/workflows/daily-reminders.yml
# Runs daily at 9:00 AM EST automatically
# No setup required - works out of the box!
```

**Option 2: External Cron Service (Alternative)**
1. Sign up for a free cron service like [cron-job.org](https://cron-job.org)
2. Create a daily job that hits: `https://tours.robotics.umich.edu/api/send-reminder-emails`
3. Set schedule: Daily at 9:00 AM EST
4. Add HTTP header: `X-Cron-Job: reminder-emails`

**Option 3: Manual Testing**
- Visit: `https://tours.robotics.umich.edu/api/test-reminders` (dev only)
- GitHub Actions: Go to "Actions" tab → "Daily Tour Reminder Emails" → "Run workflow"

## Testing

1. Set up a test Mailgun domain first
2. Use your own email addresses to test
3. Verify calendar events are created correctly
4. Check email formatting and links

## Troubleshooting

- Check Netlify function logs for errors
- Verify environment variables are set correctly
- Ensure Google service account has calendar permissions
- Test Mailgun domain verification
# GitHub Actions Workflows

## Daily Tour Reminder Emails

**File**: `.github/workflows/daily-reminders.yml`

**Purpose**: Automatically sends reminder emails to visitors and tour guides 24 hours before scheduled tours.

**Schedule**: Daily at 9:00 AM EST (13:00 UTC)

**How it works**:
1. GitHub Actions triggers the workflow daily via cron schedule
2. Makes HTTP request to `/api/send-reminder-emails` endpoint
3. Netlify function processes reminders and sends emails
4. Logs success/failure status for monitoring

**Manual Triggering**:
1. Go to repository "Actions" tab
2. Select "Daily Tour Reminder Emails" workflow
3. Click "Run workflow" button
4. Useful for testing or running additional reminders

**Monitoring**:
- Check workflow runs in GitHub Actions tab
- View logs for detailed email sending status
- Failed runs will appear with error details

**Benefits**:
- ✅ Completely free (GitHub Actions free tier)
- ✅ No external dependencies or accounts needed
- ✅ Integrated with repository
- ✅ Automatic logging and monitoring
- ✅ Easy manual triggering for testing
- ✅ Reliable cron scheduling

**Why GitHub Actions over alternatives**:
- **vs Netlify Scheduled Functions**: No Pro plan required
- **vs External Cron Services**: No additional accounts or services
- **vs Manual processes**: Fully automated and reliable
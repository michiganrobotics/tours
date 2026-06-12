# University of Michigan Robotics Tours System

A comprehensive web application for managing robotics lab tours, including custom tour requests, public tour scheduling, guide management, and automated communications.

## 🏗️ System Architecture

### Technology Stack
- **Frontend**: Vanilla HTML/CSS/JavaScript with TailwindCSS
- **Backend**: Serverless Netlify Functions (Node.js)
- **Database**: Google Sheets API (primary storage)
- **Email Service**: Mailgun
- **Calendar Integration**: Google Calendar API
- **Hosting**: Netlify with automatic deployments
- **Authentication**: UMich Shibboleth OIDC (dashboard), Public access (signup page)

### Project Structure
```
tours/
├── public/                          # Static frontend files
│   ├── index.html                   # Main dashboard
│   ├── signup.html                  # Public tour registration
│   ├── script.js                    # Dashboard functionality
│   └── signup.js                    # Registration functionality
├── netlify/functions/               # Serverless API endpoints
│   ├── lib/
│   │   ├── database.js             # Google Sheets integration
│   │   └── email-templates.js      # HTML email templates
│   ├── tour-requests.js            # Tour request CRUD operations
│   ├── public-tours.js             # Public tour management
│   ├── calendar-service.js         # Google Calendar integration
│   └── send-email.js               # Mailgun email service
└── scripts/                        # Setup and utility scripts
```

## 🚀 Key Features

### 1. Tour Request Management
- **Custom Tour Requests**: Visitors can request private/group tours
- **Status Tracking**: `pending` → `scheduled` → `completed`/`cancelled`
- **Guide Assignment**: Assign tour guides to specific requests
- **Calendar Integration**: Automatic Google Calendar events
- **Email Automation**: Confirmation and scheduling notifications

### 2. Public Tours System
- **Scheduled Public Tours**: Regular recurring tours (e.g., weekly Friday tours)
- **Registration Management**: Online signup with capacity limits
- **Tour Types**: Regular, Special Event, VIP tours

### 3. Tour Guide Management
- **Guide Profiles**: Name, email, phone, specialties, availability
- **Assignment System**: Assign guides to specific tours
- **Notification System**: Email alerts for new assignments

### 4. Analytics Dashboard
- **Overview Statistics**: Total requests, pending, completed tours
- **Recent Activity**: Real-time timeline of tour activities
- **Capacity Tracking**: Registration numbers vs. tour capacity

## 🔧 API Endpoints

All endpoints are accessible via `/api/*` (proxied to `/.netlify/functions/*`):

- **Tour Requests**: `GET/POST/PUT /api/tour-requests`
- **Public Tours**: `GET/POST/PUT /api/public-tours`
- **Registrations**: `GET/POST /api/public-tour-registrations`
- **Tour Guides**: `GET/POST /api/tour-guides`
- **Calendar**: `POST /api/calendar-service`
- **Email**: `POST /api/send-email`
- **Analytics**: `GET /api/analytics`

## 📊 Data Storage

### Google Sheets Integration
**Spreadsheet ID**: `11Yf4Y7g8FAAGJXPIUgkPcDY880MALbqfPyivm1E8dPg`

**Sheet Structure**:
- **Tour Requests**: All custom tour request data
- **Tour Guides**: Guide profiles and availability
- **Public Tours**: Scheduled public tours
- **Public Tour Registrations**: Public tour signups

## 📧 Email Workflow

The system sends automated emails at key points:

1. **Request Received**: Confirmation to visitor
2. **Tour Scheduled**: Details and calendar invite to visitor
3. **Guide Assigned**: Assignment notification to guide
4. **Registration**: Public tour confirmation
5. **Tour Cancelled**: Cancellation notification to assigned guide
6. **Daily Reminders**: 24 hours before scheduled tours

### Email Types

**Immediate Notifications**:
- Visitor confirmation emails
- Guide assignment emails (private and public tours)
- Tour scheduling confirmations
- Tour cancellation emails to assigned guides

**Daily Reminder Emails** (sent 24 hours before tours via GitHub Actions):
- **Visitor Reminders**: Tour details, directions, parking info, t-shirt payment reminder
- **Guide Reminders**: Tour details, visitor info, pre-tour checklist
- **Public Tour Reminders**: Updated registration counts, tour capacity info

**Email Configuration**:
- **From**: `tours@robotics.umich.edu`
- **Reply-To**: `robotics-tours@umich.edu`
- **Service**: Mailgun API

## 📅 Calendar Integration

- **Google Calendar API**: Automatic event creation
- **Event Details**: Includes tour info, guide details, attendees
- **Reminders**: 24-hour and 1-hour email notifications
- **Linking**: Calendar events link back to tour system

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Netlify CLI
- Google Service Account with Sheets/Calendar API access
- Mailgun account

### Local Development
```bash
# Install dependencies
npm install

# Start local development server
npm run netlify-dev

# Access application
open http://localhost:8888
```

### Environment Variables
```env
GOOGLE_SERVICE_ACCOUNT_KEY=<Google Service Account JSON>
GOOGLE_CALENDAR_ID=<Target Google Calendar ID>
MAILGUN_API_KEY=<Mailgun API Key>
MAILGUN_DOMAIN=robotics.umich.edu
URL=<Site URL for internal API calls>
```

## 🚀 Deployment

### Netlify Configuration
- **Build Command**: `npm run build`
- **Publish Directory**: `public/`
- **Functions Directory**: `netlify/functions/`
- **Auto-Deploy**: Triggered on git push to main branch

### Deployment Process
1. Push changes to main branch
2. Netlify automatically builds and deploys
3. Functions are deployed to `/.netlify/functions/`
4. Static files served from `public/`

## 📱 Special Features

### T-Shirt Integration
- Pre-order robotics t-shirts during registration
- Size selection (XS through XXL)
- $20 per shirt, paid via credit card at tour
- Order details included in confirmation emails

### Mobile Responsive
- Dashboard and registration forms optimized for mobile
- Touch-friendly interface elements
- Responsive navigation and layout

### Spam Protection
- reCAPTCHA integration on forms
- Netlify Forms built-in spam filtering
- Automated moderation workflows

## 🔄 Data Flow Example

1. **Visitor submits tour request** → tour-requests function validates and stores it, then sends confirmation email
2. **Request appears in dashboard** → Staff can view/manage
3. **Staff assigns guide + sets status to "scheduled"** →
4. **Calendar event created** → Google Calendar
5. **Emails sent** → Visitor gets schedule, guide gets assignment
6. **Tour completed** → Status updated to "completed"

## 🎯 Usage Instructions

### For Staff (Dashboard)
1. Access main dashboard at `/`
2. View pending tour requests
3. Assign guides and update status
4. Monitor public tour registrations
5. Track analytics and capacity

### For Visitors (Public Registration)
1. Visit `/signup.html` for public tours
2. Complete registration form
3. Receive confirmation email
4. Get calendar invite when tour is scheduled

## 🔧 Maintenance

### Regular Tasks
- Monitor Google Sheets for data integrity
- Check email delivery rates
- Update tour guide availability
- Review and approve tour requests

### Troubleshooting
- Check Netlify function logs for errors
- Verify Google API quotas and permissions
- Monitor Mailgun delivery statistics
- Validate calendar integration

## 📞 Support

For technical issues or questions:
- **Email**: robotics-tours@umich.edu
- **Repository**: Internal UM Robotics repository
- **Documentation**: This README and inline code comments
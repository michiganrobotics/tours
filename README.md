# Michigan Robotics tours

Web application for managing tours of the Ford Robotics Building at the University of Michigan: custom tour requests, public tour scheduling and registration, guide management, automated email communications, and visitor feedback.

Live at [tours.robotics.umich.edu](https://tours.robotics.umich.edu).

## Architecture

- **Frontend**: vanilla HTML/CSS/JavaScript with Tailwind CSS
- **Backend**: Netlify Functions (Node.js)
- **Storage**: Google Sheets via service account
- **Email**: Mailgun
- **Calendar**: Google Calendar API
- **Auth**: U-M OIDC (Shibboleth) for the admin dashboard; the signup and feedback pages are public
- **Scheduled jobs**: GitHub Actions cron workflows calling authenticated function endpoints

## Project structure

```
tours/
├── public/                              # Static frontend
│   ├── index.html / script.js           # Admin dashboard (auth required)
│   ├── signup.html / signup.js          # Public tour registration + custom requests
│   └── feedback.html / feedback.js      # Post-tour feedback form
├── netlify/functions/                   # API endpoints
│   ├── tour-requests.js                 # Custom tour request CRUD
│   ├── public-tours.js                  # Public tour management
│   ├── public-tour-registrations.js     # Registrations (capacity enforced)
│   ├── tour-guides.js                   # Guide profiles
│   ├── assign-guide.js                  # Guide assignment (supports multiple guides)
│   ├── analytics.js                     # Dashboard stats
│   ├── feedback.js / submit-feedback.js # Feedback list (admin) / submission (public)
│   ├── get-tour-info.js                 # Tour info for the feedback page
│   ├── email-log.js                     # Per-tour email history (admin)
│   ├── send-reminder-emails.js          # Daily reminder job endpoint
│   ├── send-feedback-emails.js          # Daily feedback-request job endpoint
│   ├── auth-*.js                        # OIDC login/callback/status/logout
│   └── lib/                             # Shared services, templates, validation
├── .github/workflows/                   # Daily reminder + feedback cron jobs
├── src/input.css                        # Tailwind source (builds to public/styles.css)
└── tests/                               # Manual end-to-end workflow script
```

## Features

### Tour requests
- Visitors request private/group tours through the public form
- Status flow: `pending` → `scheduled` → `completed`/`cancelled` (past tours auto-complete daily)
- One or more guides per tour; guides are emailed when assigned or removed
- Google Calendar events created on scheduling and kept in sync with the guide roster

### Public tours
- Scheduled open tours with online registration and enforced capacity limits
- Optional t-shirt pre-orders with size breakdowns
- Attendance tracking per registration

### Communications
- Confirmation, scheduling, assignment, removal, reminder, cancellation, and feedback-request emails
- Day-before reminders to visitors and guides via a daily GitHub Actions job
- Every sent email is recorded in an email log and shown per-tour in the dashboard
- Reminder and feedback jobs are idempotent: re-runs skip anything already sent

### Feedback
- Post-tour feedback requests with NPS, ratings, and free-text responses
- Results summarized in the dashboard

## API

All endpoints are served from `/api/*` (redirected to `/.netlify/functions/*`). Mutating endpoints require an authenticated admin session except the public submission endpoints (`POST /api/tour-requests`, `POST /api/public-tour-registrations`, `POST /api/submit-feedback`), which are protected by reCAPTCHA and rate limiting. The cron endpoints require a `CRON_API_KEY` header.

## Development

```bash
npm install
npm run netlify-dev     # builds CSS in watch mode + runs netlify dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Full service account JSON (Sheets + Calendar access) |
| `GOOGLE_CALENDAR_ID` | Target calendar for tour events |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` | Email sending |
| `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET` | U-M OIDC auth for the dashboard |
| `RECAPTCHA_SECRET_KEY` | Spam protection on public forms |
| `CRON_API_KEY` | Shared secret for the scheduled email jobs |
| `URL` | Site URL used in email links |

See `SETUP.md`, `DEPLOYMENT.md`, and `RECAPTCHA.md` for detailed setup instructions.

## Deployment

Pushes to `main` trigger a Netlify build (`npm run build` compiles Tailwind, functions deploy automatically). The daily email jobs run from GitHub Actions on this repository and require the `CRON_API_KEY` repository secret.

## Support

Questions or issues: [robotics-tours@umich.edu](mailto:robotics-tours@umich.edu)

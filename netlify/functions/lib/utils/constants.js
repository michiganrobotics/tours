/**
 * Application constants
 * Centralizes all hardcoded values used throughout the application
 */

// Google Sheets Configuration
const SPREADSHEET_ID = '11Yf4Y7g8FAAGJXPIUgkPcDY880MALbqfPyivm1E8dPg';

// Email Configuration
const EMAIL_ADDRESSES = {
  ADMIN: 'dnewms@umich.edu',
  TOURS: 'robotics-tours@umich.edu'
};

// reCAPTCHA Configuration
const RECAPTCHA = {
  SITE_KEY: '6LeKK2UrAAAAAAKPM3P7FqJRaFprim_ti5EGCFDR',
  SECRET_KEY_ENV: 'RECAPTCHA_SECRET_KEY'
};

// T-Shirt Configuration
const TSHIRT = {
  PRICE_PER_SHIRT: 20,
  SIZES: {
    'S': 'Small',
    'M': 'Medium', 
    'L': 'Large',
    'XL': 'Extra Large',
    'XXL': 'Extra Extra Large'
  }
};

// Tour Configuration
const TOUR = {
  DEFAULT_DURATION_HOURS: 1,
  DEFAULT_TIME: '14:00',
  DEFAULT_PUBLIC_TOUR_TIME: '12:00'
};

// University Information
const UNIVERSITY = {
  NAME: 'University of Michigan',
  DEPARTMENT: 'Michigan Robotics',
  ADDRESS: {
    STREET: '2505 Hayward St',
    CITY: 'Ann Arbor',
    STATE: 'MI',
    ZIP: '48109',
    FULL: '2505 Hayward St, Ann Arbor, MI 48109'
  },
  BUILDING_NAME: 'Ford Motor Company Robotics Building'
};

// Social Media Links
const SOCIAL_MEDIA = {
  TWITTER: 'https://www.x.com/umrobotics',
  INSTAGRAM: 'https://www.instagram.com/umrobotics/',
  YOUTUBE: 'https://www.youtube.com/channel/UC-WH2n-SkB166pUq5o5ULUg',
  LINKEDIN: 'https://www.linkedin.com/company/university-of-michigan-robotics/'
};

// URLs
const URLS = {
  MARKETING_LOGO: 'https://robotics.umich.edu/marketing-white.png',
  AUDIO_TOUR: 'https://audio.robotics.umich.edu',
  PARKING_MAP: 'https://www.google.com/maps/place/NC26+Parking+Lot,+Ann+Arbor,+MI+48109/@42.2939623,-83.7086283,15z/'
};

// Sheet Names (Google Sheets tabs)
const SHEET_NAMES = {
  TOUR_REQUESTS: 'Tour Requests',
  TOUR_GUIDES: 'Tour Guides',
  PUBLIC_TOURS: 'Public Tours',
  PUBLIC_TOUR_REGISTRATIONS: 'Public Tour Registrations',
  ANALYTICS: 'Analytics',
  FEEDBACK: 'Feedback',
  EMAIL_LOG: 'Email Log'
};

// Status Values
const STATUS = {
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  REGISTERED: 'registered'
};

// Environment Configuration
const ENV = {
  DEVELOPMENT: 'development',
  PRODUCTION: 'production',
  DEFAULT_URL: 'http://localhost:8888'
};

module.exports = {
  SPREADSHEET_ID,
  EMAIL_ADDRESSES,
  RECAPTCHA,
  TSHIRT,
  TOUR,
  UNIVERSITY,
  SOCIAL_MEDIA,
  URLS,
  SHEET_NAMES,
  STATUS,
  ENV
};
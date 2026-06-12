const { getCachedDataService, getNotificationService } = require('./lib/services');
const { validateRecaptcha } = require('./lib/recaptcha');
const { PublicTourRegistrationSchema, validateInput } = require('./lib/validation/schemas');
const { withRateLimit } = require('./lib/rateLimiter');
const { requireAuth } = require('./lib/auth');

// Main handler function
async function mainHandler(event, context) {
  // Handle preflight request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {}
    };
  }

  // Require authentication for GET (contains personal data)
  // POST is allowed for public registration submissions
  if (event.httpMethod === 'GET') {
    const authError = requireAuth(event);
    if (authError) {
      return authError;
    }
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        const dataService = await getCachedDataService();
        const registrations = await dataService.getAllPublicTourRegistrations();
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(registrations)
        };

      case 'PATCH':
        // Authentication required for PATCH
        const authError = requireAuth(event);
        if (authError) {
          return authError;
        }

        const updateBody = JSON.parse(event.body);
        const dataService3 = await getCachedDataService();
        const updatedRegistration = await dataService3.updatePublicTourRegistration(updateBody);

        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(updatedRegistration)
        };

      case 'POST':
        const registrationBody = JSON.parse(event.body);
        
        // Validate input data
        const validation = validateInput(PublicTourRegistrationSchema, registrationBody);
        if (!validation.success) {
          return {
            statusCode: 400,
            headers: {},
            body: JSON.stringify({
              error: 'Validation failed',
              details: validation.issues
            })
          };
        }
        
        const newRegistrationData = validation.data;

        // reCAPTCHA is required for unauthenticated submissions; logged-in
        // admins creating registrations from the dashboard are exempt, and
        // enforcement only applies when reCAPTCHA is configured
        const isAuthenticatedAdmin = !requireAuth(event);
        if (!process.env.RECAPTCHA_SECRET_KEY) {
          console.warn('RECAPTCHA_SECRET_KEY not configured - skipping reCAPTCHA enforcement');
        } else if (!isAuthenticatedAdmin) {
          // Read the token from the raw body - the Zod schema strips unknown keys
          const recaptchaToken = registrationBody.recaptchaToken;
          if (!recaptchaToken) {
            return {
              statusCode: 400,
              headers: {},
              body: JSON.stringify({ error: 'reCAPTCHA verification required' })
            };
          }

          const recaptchaResult = await validateRecaptcha(
            recaptchaToken,
            'public_tour_registration',
            0.5
          );

          if (!recaptchaResult.success) {
            console.error('reCAPTCHA validation failed:', recaptchaResult.error);
            return {
              statusCode: 400,
              headers: {},
              body: JSON.stringify({ error: 'reCAPTCHA verification failed. Please try again.' })
            };
          }
          console.log(`reCAPTCHA validated successfully. Score: ${recaptchaResult.score}`);
        }

        // Remove recaptcha token before storing
        delete newRegistrationData.recaptchaToken;

        const dataService1 = await getCachedDataService();

        // Enforce tour capacity before accepting the registration
        const allTours = await dataService1.getAllPublicTours();
        const targetTour = allTours.find(t => t.id == newRegistrationData.public_tour_id);
        if (!targetTour) {
          return {
            statusCode: 400,
            headers: {},
            body: JSON.stringify({ error: 'Tour not found' })
          };
        }
        if (targetTour.status === 'cancelled') {
          return {
            statusCode: 400,
            headers: {},
            body: JSON.stringify({ error: 'This tour has been cancelled' })
          };
        }

        const capacity = parseInt(targetTour.capacity) || 0;
        if (capacity > 0) {
          const existingRegistrations = await dataService1.getPublicTourRegistrations(targetTour.id);
          const registeredCount = existingRegistrations
            .filter(reg => reg.status !== 'cancelled')
            .reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0);
          const requestedSpots = parseInt(newRegistrationData.group_size) || 1;

          if (registeredCount + requestedSpots > capacity) {
            const spotsLeft = Math.max(0, capacity - registeredCount);
            return {
              statusCode: 409,
              headers: {},
              body: JSON.stringify({
                error: spotsLeft > 0
                  ? `Only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} remaining on this tour`
                  : 'This tour is full'
              })
            };
          }
        }

        const result = await dataService1.createPublicTourRegistration(newRegistrationData);
        
        // Send confirmation email if registration successful
        if (result && result.id) {
          try {
            // Get tour details for email
            const dataService2 = await getCachedDataService();
            const tours = await dataService2.getAllPublicTours();
            const tour = tours.find(t => t.id == newRegistrationData.public_tour_id);
            
            if (tour && newRegistrationData.email) {
              const notificationService = getNotificationService();
              
              // Get calendar link if tour has calendar event
              let calendarLink = null;
              if (tour.calendar_event_id) {
                try {
                  const { getCalendarService } = require('./lib/services');
                  const calendarService = await getCalendarService();
                  calendarLink = await calendarService.getEventLink(tour.calendar_event_id);
                  console.log('Retrieved calendar link for registration confirmation:', tour.calendar_event_id);
                } catch (calendarError) {
                  console.error('Error retrieving calendar link for registration confirmation:', calendarError);
                }
              }
              
              await notificationService.sendPublicTourConfirmation(result, tour, calendarLink);
            }
          } catch (emailError) {
            console.error('Failed to send confirmation email:', emailError);
            // Don't fail the registration if email fails
          }
        }
        
        return {
          statusCode: 201,
          headers: {},
          body: JSON.stringify(result)
        };

      default:
        return {
          statusCode: 405,
          headers: {},
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Public tour registrations API error:', error);
    return {
      statusCode: 500,
      headers: {},
      body: JSON.stringify({ error: error.message })
    };
  }
}

// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};

// Email sending function using Mailgun

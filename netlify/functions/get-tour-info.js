const { getCachedDataService } = require('./lib/services');
const { withRateLimit } = require('./lib/rateLimiter');

const mainHandler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { tourId, tourType, registrationId } = JSON.parse(event.body);

    if (!tourId || !tourType) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Missing required tour information' }),
      };
    }

    const dataService = await getCachedDataService();
    let tourInfo = {};

    if (tourType === 'private') {
      // Get private tour request information
      const requests = await dataService.getAllTourRequests();
      const request = requests.find(r => r.id === tourId);

      if (request) {
        // Get guide information - handle multiple guides
        const dataRepository = dataService.dataRepository || dataService;
        const assignedGuides = await dataRepository.getMultipleTourGuides(request.assigned_guide_id);
        const guideName = assignedGuides.length > 0 ? dataRepository.formatGuideNames(assignedGuides) : null;

        tourInfo = {
          tour_date: request.preferred_date,
          tour_time: request.preferred_time,
          visitor_name: request.visitor_name,
          visitor_email: request.visitor_email,
          guide_name: guideName,
          tour_title: 'Private Building Tour'
        };
      }
    } else if (tourType === 'public') {
      // Get public tour information
      const publicTours = await dataService.getAllPublicTours();
      const tour = publicTours.find(t => t.id === tourId);

      if (tour && registrationId) {
        // Get registration information
        const registrations = await dataService.getPublicTourRegistrations(tourId);
        const registration = registrations.find(r => r.id === registrationId);

        if (registration) {
          // Get guide information - handle multiple guides
          const dataRepository = dataService.dataRepository || dataService;
          const assignedGuides = await dataRepository.getMultipleTourGuides(tour.assigned_guide_id);
          const guideName = assignedGuides.length > 0 ? dataRepository.formatGuideNames(assignedGuides) : null;

          tourInfo = {
            tour_date: tour.date,
            tour_time: tour.time,
            visitor_name: registration.name,
            visitor_email: registration.email,
            guide_name: guideName,
            tour_title: tour.title || 'Public Building Tour'
          };
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tourInfo),
    };

  } catch (error) {
    console.error('Error getting tour info:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};

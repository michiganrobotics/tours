const { getDataRepository, getNotificationService } = require('./lib/services/index');
const { withRateLimit } = require('./lib/rateLimiter');

// Main handler function
async function mainHandler(event, context) {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // Security: Verify this is an authorized automated request.
  // Requires a matching CRON_API_KEY; User-Agent/workflow headers are
  // spoofable and must not grant access.
  const apiKey = event.headers['x-api-key'] || event.queryStringParameters?.api_key;
  const expectedApiKey = process.env.CRON_API_KEY;

  const isAuthorized = expectedApiKey && apiKey === expectedApiKey;

  if (!isAuthorized) {
    console.warn('Unauthorized attempt to access feedback email endpoint:', {
      hasApiKey: !!apiKey,
      keyConfigured: !!expectedApiKey,
      host: event.headers.host,
      ip: event.headers['x-forwarded-for'] || event.headers['client-ip']
    });
    
    return {
      statusCode: 403,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        error: 'Forbidden',
        message: 'This endpoint requires proper authentication'
      }),
    };
  }

  try {
    console.log('Starting daily feedback email job...');

    // Get yesterday's date in YYYY-MM-DD format
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    console.log(`Looking for tours that happened on: ${yesterdayStr}`);

    const dataRepository = await getDataRepository();
    const notificationService = getNotificationService();
    
    // Get all tour requests, guides, public tours, and registrations
    const [tourRequests, tourGuides, publicTours, publicRegistrations] = await Promise.all([
      dataRepository.getAllTourRequests(),
      dataRepository.getAllTourGuides(),
      dataRepository.getAllPublicTours(),
      dataRepository.getAllPublicTourRegistrations()
    ]);

    console.log(`Found ${tourRequests.length} tour requests, ${publicTours.length} public tours`);

    // Build a set of already-sent feedback requests so re-runs of this job
    // (manual workflow_dispatch, GitHub Actions retries) don't double-send
    const emailLog = await dataRepository.getEmailLog();
    const alreadySent = new Set(emailLog.map(e => `${e.tour_id}|${e.recipient}|${e.email_type}`));
    const wasSent = (tourId, recipient) => alreadySent.has(`${tourId}|${recipient}|feedback_request`);
    const markSent = (tourId, recipient) => alreadySent.add(`${tourId}|${recipient}|feedback_request`);

    // Filter for completed/scheduled tours that happened yesterday
    const yesterdayTourRequests = tourRequests.filter(request => 
      (request.status === 'completed' || request.status === 'scheduled') && 
      request.preferred_date === yesterdayStr &&
      request.assigned_guide_id
    );

    // Filter for public tours that happened yesterday
    const yesterdayPublicTours = publicTours.filter(tour => 
      (tour.status === 'completed' || tour.status === 'active') && 
      tour.date === yesterdayStr &&
      tour.assigned_guide_id
    );

    console.log(`Found ${yesterdayTourRequests.length} private tours and ${yesterdayPublicTours.length} public tours yesterday`);

    const emailResults = [];

    // Send feedback requests for private tour requests
    for (const request of yesterdayTourRequests) {
      try {
        // Parse guide IDs and get all assigned guides
        const guideIds = request.assigned_guide_id ? request.assigned_guide_id.split(',').map(id => id.trim()).filter(id => id) : [];
        const guides = guideIds.map(id => tourGuides.find(g => g.id === id)).filter(g => g);

        // Format guide names
        let guideName = null;
        if (guides.length === 0) {
          guideName = null;
        } else if (guides.length === 1) {
          guideName = guides[0].name;
        } else if (guides.length === 2) {
          guideName = `${guides[0].name} and ${guides[1].name}`;
        } else {
          const allButLast = guides.slice(0, -1).map(g => g.name).join(', ');
          guideName = `${allButLast}, and ${guides[guides.length - 1].name}`;
        }

        const tourData = {
          tour_id: request.id,
          tour_type: 'private',
          visitor_name: request.visitor_name,
          visitor_email: request.visitor_email,
          tour_date: request.preferred_date,
          tour_time: request.preferred_time,
          guide_name: guideName,
          tour_title: 'Private Building Tour'
        };

        if (wasSent(request.id, request.visitor_email)) {
          console.log(`Skipping feedback email (already sent) to ${request.visitor_email} for tour ${request.id}`);
          emailResults.push({ type: 'private_tour_feedback', tour_id: request.id, recipient: request.visitor_email, success: true, skipped: true });
          continue;
        }

        console.log(`Sending feedback email to ${request.visitor_email} for tour ${request.id}`);

        const result = await notificationService.sendFeedbackEmail(tourData);
        if (result.success) {
          markSent(request.id, request.visitor_email);
        }
        emailResults.push({
          type: 'private_tour_feedback',
          tour_id: request.id,
          recipient: request.visitor_email,
          success: result.success,
          messageId: result.messageId
        });

        console.log(`Feedback email sent to ${request.visitor_email} - Message ID: ${result.messageId}`);
        
      } catch (error) {
        console.error(`Error sending feedback email for tour ${request.id}:`, error);
        emailResults.push({
          type: 'private_tour_feedback',
          tour_id: request.id,
          recipient: request.visitor_email,
          success: false,
          error: error.message
        });
      }
    }

    // Send feedback requests for public tour registrations
    for (const tour of yesterdayPublicTours) {
      try {
        // Parse guide IDs and get all assigned guides
        const guideIds = tour.assigned_guide_id ? tour.assigned_guide_id.split(',').map(id => id.trim()).filter(id => id) : [];
        const guides = guideIds.map(id => tourGuides.find(g => g.id === id)).filter(g => g);

        // Format guide names
        let guideName = null;
        if (guides.length === 0) {
          guideName = null;
        } else if (guides.length === 1) {
          guideName = guides[0].name;
        } else if (guides.length === 2) {
          guideName = `${guides[0].name} and ${guides[1].name}`;
        } else {
          const allButLast = guides.slice(0, -1).map(g => g.name).join(', ');
          guideName = `${allButLast}, and ${guides[guides.length - 1].name}`;
        }

        // Get all registrations for this public tour
        const tourRegistrations = publicRegistrations.filter(reg =>
          reg.public_tour_id === tour.id &&
          (reg.status === 'registered' || reg.status === 'confirmed')
        );

        console.log(`Found ${tourRegistrations.length} registrations for public tour ${tour.id}`);

        for (const registration of tourRegistrations) {
          try {
            const tourData = {
              tour_id: tour.id,
              tour_type: 'public',
              registration_id: registration.id,
              visitor_name: registration.name,
              visitor_email: registration.email,
              tour_date: tour.date,
              tour_time: tour.time,
              guide_name: guideName,
              tour_title: tour.title || 'Public Building Tour'
            };

            if (wasSent(tour.id, registration.email)) {
              console.log(`Skipping feedback email (already sent) to ${registration.email} for public tour ${tour.id}`);
              emailResults.push({ type: 'public_tour_feedback', tour_id: tour.id, recipient: registration.email, success: true, skipped: true });
              continue;
            }

            console.log(`Sending feedback email to ${registration.email} for public tour ${tour.id}`);

            const result = await notificationService.sendFeedbackEmail(tourData);
            if (result.success) {
              markSent(tour.id, registration.email);
            }
            emailResults.push({
              type: 'public_tour_feedback',
              tour_id: tour.id,
              registration_id: registration.id,
              recipient: registration.email,
              success: result.success,
              messageId: result.messageId
            });

            console.log(`Feedback email sent to ${registration.email} - Message ID: ${result.messageId}`);
            
          } catch (error) {
            console.error(`Error sending feedback email for registration ${registration.id}:`, error);
            emailResults.push({
              type: 'public_tour_feedback',
              tour_id: tour.id,
              registration_id: registration.id,
              recipient: registration.email,
              success: false,
              error: error.message
            });
          }
        }
        
      } catch (error) {
        console.error(`Error processing public tour ${tour.id}:`, error);
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failureCount = emailResults.filter(r => !r.success).length;

    console.log(`Feedback email job completed: ${successCount} sent, ${failureCount} failed`);

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: true,
        message: `Feedback emails processed`,
        summary: {
          date: yesterdayStr,
          private_tours: yesterdayTourRequests.length,
          public_tours: yesterdayPublicTours.length,
          emails_sent: successCount,
          emails_failed: failureCount
        },
        results: emailResults
      }),
    };

  } catch (error) {
    console.error('Error in feedback email job:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        success: false,
        error: error.message
      }),
    };
  }
}

// Export with rate limiting
exports.handler = async (event, context) => {
  return await withRateLimit(event, mainHandler);
};
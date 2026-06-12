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
    console.warn('Unauthorized attempt to access reminder email endpoint:', {
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
    console.log('Starting daily reminder email job...');

    // Get tomorrow's date in YYYY-MM-DD format
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    console.log(`Looking for tours scheduled for: ${tomorrowStr}`);

    const dataRepository = await getDataRepository();
    const notificationService = getNotificationService();
    
    // Get all tour requests and guides
    const [tourRequests, tourGuides, publicTours, publicRegistrations] = await Promise.all([
      dataRepository.getAllTourRequests(),
      dataRepository.getAllTourGuides(),
      dataRepository.getAllPublicTours(),
      dataRepository.getAllPublicTourRegistrations()
    ]);

    console.log(`Found ${tourRequests.length} tour requests, ${publicTours.length} public tours`);

    // Build a set of already-sent reminders so re-runs of this job
    // (manual workflow_dispatch, GitHub Actions retries) don't double-send.
    // The tour date is part of the key so a rescheduled tour gets a fresh
    // reminder for its new date.
    const emailLog = await dataRepository.getEmailLog();
    const reminderKey = (tourId, recipient, emailType, tourDate) => `${tourId}|${recipient}|${emailType}|${tourDate || ''}`;
    const alreadySent = new Set(emailLog.map(e => reminderKey(e.tour_id, e.recipient, e.email_type, e.tour_date)));
    const wasSent = (tourId, recipient, emailType, tourDate) => alreadySent.has(reminderKey(tourId, recipient, emailType, tourDate));
    const markSent = (tourId, recipient, emailType, tourDate) => alreadySent.add(reminderKey(tourId, recipient, emailType, tourDate));

    // Filter for scheduled tours happening tomorrow
    const tomorrowTourRequests = tourRequests.filter(request => 
      request.status === 'scheduled' && 
      request.preferred_date === tomorrowStr &&
      request.assigned_guide_id
    );

    // Filter for public tours happening tomorrow
    const tomorrowPublicTours = publicTours.filter(tour => 
      tour.status === 'active' && 
      tour.date === tomorrowStr &&
      tour.assigned_guide_id
    );

    console.log(`Found ${tomorrowTourRequests.length} private tours and ${tomorrowPublicTours.length} public tours tomorrow`);

    const emailResults = [];

    // Send reminders for private tour requests
    for (const request of tomorrowTourRequests) {
      try {
        // Parse guide IDs and get all assigned guides
        const guideIds = request.assigned_guide_id ? request.assigned_guide_id.split(',').map(id => id.trim()).filter(id => id) : [];
        const guides = guideIds.map(id => tourGuides.find(g => g.id === id)).filter(g => g);

        if (guides.length === 0) {
          console.warn(`No guides found for request ${request.id}`);
          continue;
        }

        // Send visitor and guide reminder emails using NotificationService
        try {
          // Send visitor reminder with all guides
          if (wasSent(request.id, request.visitor_email, 'visitor_reminder', request.preferred_date)) {
            console.log(`Skipping visitor reminder (already sent) to ${request.visitor_email}`);
            emailResults.push({ type: 'visitor', email: request.visitor_email, success: true, skipped: true });
          } else {
            const visitorResult = await notificationService.sendVisitorReminder(request, guides);

            if (visitorResult?.success) {
              markSent(request.id, request.visitor_email, 'visitor_reminder', request.preferred_date);
              console.log(`Sent visitor reminder to ${request.visitor_email}`);
              emailResults.push({ type: 'visitor', email: request.visitor_email, success: true });
            } else {
              console.error(`Failed to send visitor reminder to ${request.visitor_email}`);
              emailResults.push({ type: 'visitor', email: request.visitor_email, success: false, error: 'Email send failed' });
            }
          }

          // Send reminder to each guide
          for (const guide of guides) {
            if (wasSent(request.id, guide.email, 'guide_reminder', request.preferred_date)) {
              console.log(`Skipping guide reminder (already sent) to ${guide.email}`);
              emailResults.push({ type: 'guide', email: guide.email, success: true, skipped: true });
              continue;
            }
            const guideResult = await notificationService.sendGuideReminder(request, guide);

            if (guideResult?.success) {
              markSent(request.id, guide.email, 'guide_reminder', request.preferred_date);
              console.log(`Sent guide reminder to ${guide.email}`);
              emailResults.push({ type: 'guide', email: guide.email, success: true });
            } else {
              console.error(`Failed to send guide reminder to ${guide.email}`);
              emailResults.push({ type: 'guide', email: guide.email, success: false, error: 'Email send failed' });
            }
          }
        } catch (emailError) {
          console.error(`Error sending reminder emails for request ${request.id}:`, emailError);
          emailResults.push({ type: 'visitor', email: request.visitor_email, success: false, error: emailError.message });
          for (const guide of guides) {
            emailResults.push({ type: 'guide', email: guide.email, success: false, error: emailError.message });
          }
        }

      } catch (error) {
        console.error(`Error processing reminder for request ${request.id}:`, error);
        emailResults.push({ type: 'error', requestId: request.id, error: error.message });
      }
    }

    // Send reminders for public tours
    for (const tour of tomorrowPublicTours) {
      try {
        // Parse guide IDs and get all assigned guides
        const guideIds = tour.assigned_guide_id ? tour.assigned_guide_id.split(',').map(id => id.trim()).filter(id => id) : [];
        const guides = guideIds.map(id => tourGuides.find(g => g.id === id)).filter(g => g);

        if (guides.length === 0) {
          console.warn(`No guides found for public tour ${tour.id}`);
          continue;
        }

        // Get registrations for this tour (include all active registrations)
        const tourRegistrations = publicRegistrations.filter(reg =>
          reg.public_tour_id === tour.id && reg.status !== 'cancelled'
        );

        // Send reminder to each guide
        for (const guide of guides) {
          try {
            if (wasSent(tour.id, guide.email, 'guide_reminder', tour.date)) {
              console.log(`Skipping public tour guide reminder (already sent) to ${guide.email}`);
              emailResults.push({ type: 'public_tour_guide', email: guide.email, success: true, skipped: true });
              continue;
            }
            const guideReminderResult = await notificationService.sendPublicTourGuideReminder(tour, guide, tourRegistrations);

            if (guideReminderResult.success) {
              markSent(tour.id, guide.email, 'guide_reminder', tour.date);
              console.log(`Sent public tour guide reminder to ${guide.email}`);
              emailResults.push({ type: 'public_tour_guide', email: guide.email, success: true });
            } else {
              console.error(`Failed to send public tour guide reminder to ${guide.email}`);
              emailResults.push({ type: 'public_tour_guide', email: guide.email, success: false, error: 'Email send failed' });
            }
          } catch (emailError) {
            console.error(`Error sending public tour guide reminder to ${guide.email}:`, emailError);
            emailResults.push({ type: 'public_tour_guide', email: guide.email, success: false, error: emailError.message });
          }
        }

        // Send reminder emails to all registered participants using NotificationService
        for (const registration of tourRegistrations) {
          try {
            if (wasSent(tour.id, registration.email, 'visitor_reminder', tour.date)) {
              console.log(`Skipping public tour reminder (already sent) to ${registration.email}`);
              emailResults.push({ type: 'public_tour_participant', email: registration.email, success: true, skipped: true });
              continue;
            }

            // Convert registration to request format for visitor reminder.
            // id/tour_type identify the tour in the Email Log.
            const publicTourRequest = {
              id: tour.id,
              tour_type: 'public',
              visitor_name: registration.name,
              visitor_email: registration.email,
              preferred_date: tour.date,
              preferred_time: tour.time,
              group_size: registration.group_size,
              tshirt_request: registration.tshirt_request,
              tshirt_total: registration.tshirt_total,
              tshirt_cost: registration.tshirt_cost
            };

            const participantEmailResult = await notificationService.sendVisitorReminder(publicTourRequest, guides);

            if (participantEmailResult.success) {
              markSent(tour.id, registration.email, 'visitor_reminder', tour.date);
              console.log(`Sent public tour reminder to ${registration.email}`);
              emailResults.push({ type: 'public_tour_participant', email: registration.email, success: true });
            } else {
              console.error(`Failed to send public tour reminder to ${registration.email}`);
              emailResults.push({ type: 'public_tour_participant', email: registration.email, success: false, error: 'Email send failed' });
            }

          } catch (error) {
            console.error(`Error sending reminder to participant ${registration.email}:`, error);
            emailResults.push({ type: 'public_tour_participant', email: registration.email, success: false, error: error.message });
          }
        }

      } catch (error) {
        console.error(`Error processing reminder for public tour ${tour.id}:`, error);
        emailResults.push({ type: 'error', tourId: tour.id, error: error.message });
      }
    }

    const successCount = emailResults.filter(r => r.success).length;
    const failureCount = emailResults.filter(r => !r.success).length;

    console.log(`Reminder email job completed. Sent: ${successCount}, Failed: ${failureCount}`);

    return {
      statusCode: 200,
      headers: {},
      body: JSON.stringify({
        success: true,
        message: `Reminder emails processed`,
        summary: {
          private_tours: tomorrowTourRequests.length,
          public_tours: tomorrowPublicTours.length,
          emails_sent: successCount,
          emails_failed: failureCount
        },
        results: emailResults
      })
    };

  } catch (error) {
    console.error('Error in reminder email job:', error);
    return {
      statusCode: 500,
      headers: {},
      body: JSON.stringify({
        success: false,
        error: 'Failed to process reminder emails',
        details: error.message
      })
    };
  }
}

// Export with rate limiting
exports.handler = async (event, context) => {
  return await withRateLimit(event, mainHandler);
};
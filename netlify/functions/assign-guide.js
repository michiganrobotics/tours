const { getCachedDataService, getNotificationService, getCalendarService } = require('./lib/services');
const { GuideAssignmentSchema, validateInput } = require('./lib/validation/schemas');
const { withRateLimit } = require('./lib/rateLimiter');
const { requireAuth } = require('./lib/auth');

// Main handler function
async function mainHandler(event, context) {
  if (event.httpMethod !== 'PUT') {
    return {
      statusCode: 405,
      headers: {},
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // Require authentication for guide assignment operations
  const authError = requireAuth(event);
  if (authError) {
    return authError;
  }

  try {
    const requestBody = JSON.parse(event.body);
    
    // Validate input data
    const validation = validateInput(GuideAssignmentSchema, requestBody);
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
    
    const { request_id, assigned_guide_id } = validation.data;

    const dataService = await getCachedDataService();

    // Get current request to detect which guides are new
    const allRequests = await dataService.getAllTourRequests();
    const currentRequest = allRequests.find(req => req.id == request_id);
    const currentGuideIds = currentRequest ? currentRequest.assigned_guide_id : '';

    const newGuideIdsString = assigned_guide_id ? assigned_guide_id.toString() : '';
    const result = await dataService.assignGuideToRequest(request_id.toString(), newGuideIdsString);

    try {
      const notificationService = getNotificationService();
      const dataRepository = dataService.dataRepository || dataService;

      // Detect which guides were added and which were removed
      const newGuideIds = dataRepository.getNewGuideIds(currentGuideIds, newGuideIdsString);
      const removedGuideIds = dataRepository.getNewGuideIds(newGuideIdsString, currentGuideIds);
      const allGuides = await dataRepository.getMultipleTourGuides(newGuideIdsString);

      // Get calendar link if event exists
      let calendarLink = null;
      if (result.calendar_event_id) {
        try {
          const calendarService = await getCalendarService();
          calendarLink = await calendarService.getEventLink(result.calendar_event_id);
        } catch (calendarError) {
          console.error('Error retrieving calendar link for guide assignment:', calendarError);
        }
      }

      // Notify removed guides
      if (removedGuideIds.length > 0 && currentRequest) {
        const removedGuides = await dataRepository.getMultipleTourGuides(removedGuideIds.join(','));
        for (const guide of removedGuides) {
          try {
            await notificationService.sendGuideRemovedNotification(result, guide);
            console.log(`Guide removal email sent to ${guide.name} for request: ${request_id}`);
          } catch (guideError) {
            console.error(`Error sending removal email to guide ${guide.id}:`, guideError);
          }
        }
      }

      // Send emails to new guides only
      for (const guideId of newGuideIds) {
        const guide = allGuides.find(g => g.id === guideId);
        if (guide) {
          await notificationService.sendTourAssignedToGuide(result, guide, calendarLink);
          console.log(`Guide assignment email sent to ${guide.name} for request: ${request_id}`);
        }
      }

      // Send visitor confirmation only on the first guide assignment.
      // Later additions/removals don't email the visitor; the day-before
      // reminder lists the full final guide roster.
      if (newGuideIds.length > 0 && (!currentGuideIds || currentGuideIds.trim() === '')) {
        await notificationService.sendTourScheduledToVisitor(result, allGuides, calendarLink);
        console.log(`Visitor confirmation email sent for request: ${request_id}`);
      }

      // Keep the calendar event description in sync with the guide roster
      if (result.calendar_event_id && (newGuideIds.length > 0 || removedGuideIds.length > 0)) {
        try {
          const calendarService = await getCalendarService();
          await calendarService.updateEvent(result.calendar_event_id, {
            description: calendarService.buildTourEventDescription(result, allGuides)
          });
        } catch (calendarError) {
          console.error('Error updating calendar event description:', calendarError);
        }
      }
    } catch (emailError) {
      console.error('Failed to send guide assignment emails:', emailError);
      // Don't fail the assignment if email fails
    }
    
    return {
      statusCode: 200,
      headers: {},
      body: JSON.stringify(result)
    };
  } catch (error) {
    console.error('Error assigning guide:', error);
    return {
      statusCode: 500,
      headers: {},
      body: JSON.stringify({ error: 'Failed to assign guide' })
    };
  }
}

// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};
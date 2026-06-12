const { getCachedDataService, getNotificationService, getCalendarService } = require('./lib/services');
const { PublicTourSchema, validateInput } = require('./lib/validation/schemas');
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

  // Require authentication for all mutating methods (POST, PUT, DELETE)
  // GET remains public for tour information
  if (event.httpMethod !== 'GET') {
    const authError = requireAuth(event);
    if (authError) {
      return authError;
    }
  }

  try {
    switch (event.httpMethod) {
      case 'GET':
        const dataService = await getCachedDataService();
        const tours = await dataService.getAllPublicTours();

        // Unauthenticated callers (the public signup page) only need
        // group sizes to compute spots left - strip registrant PII
        // (names, emails, phones) unless this is an admin session
        const isAdmin = !requireAuth(event);
        const responseTours = isAdmin ? tours : tours.map(tour => ({
          ...tour,
          registrations: (tour.registrations || []).map(reg => ({
            group_size: reg.group_size,
            status: reg.status
          }))
        }));

        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(responseTours)
        };

      case 'POST':
        const tourBody = JSON.parse(event.body);
        
        // Validate input data
        const validation = validateInput(PublicTourSchema, tourBody);
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
        
        const newTourData = validation.data;
        const dataService1 = await getCachedDataService();
        const result = await dataService1.createPublicTour(newTourData);
        
        // Create calendar event for the new public tour
        try {
          const calendarService = await getCalendarService();
          const { eventId, link: calendarLink } = await calendarService.createPublicTourEvent(result);
          
          // Update the tour with the calendar event ID
          const updatedTour = await dataService1.updatePublicTour({
            ...result,
            calendar_event_id: eventId
          });
          
          // Send email notification to assigned guides if any are assigned
          if (result.assigned_guide_id) {
            try {
              const dataRepository = dataService1.dataRepository || dataService1;
              const guideIds = dataRepository.parseGuideIds(result.assigned_guide_id);
              const notificationService = getNotificationService();

              // Send notification to each assigned guide
              for (const guideId of guideIds) {
                try {
                  const guide = await dataService1.getTourGuideById(guideId);
                  if (guide) {
                    await notificationService.sendPublicTourGuideAssignment(updatedTour, guide, calendarLink);
                    console.log(`Public tour guide notification sent to ${guide.name}`);
                  }
                } catch (guideError) {
                  console.error(`Error sending notification to guide ${guideId}:`, guideError);
                }
              }
            } catch (emailError) {
              console.error('Error sending guide notification emails:', emailError);
              // Don't fail the tour creation if email fails
            }
          }
          
          return {
            statusCode: 201,
            headers: {},
            body: JSON.stringify(updatedTour)
          };
        } catch (calendarError) {
          console.error('Error creating calendar event for new public tour:', calendarError);
          // Return the tour without calendar event if calendar creation fails
          return {
            statusCode: 201,
            headers: {},
            body: JSON.stringify(result)
          };
        }

      case 'PUT':
        const updateData = JSON.parse(event.body);
        const dataService2 = await getCachedDataService();

        // Get the current tour data to check for changes
        const currentTour = await dataService2.getPublicTourById(updateData.id);
        const currentGuideIds = currentTour.assigned_guide_id || '';
        const newGuideIds = updateData.assigned_guide_id || '';
        const oldStatus = currentTour.status;
        const newStatus = updateData.status;

        const updateResult = await dataService2.updatePublicTour(updateData);

        // Check if tour was cancelled and notify all assigned guides
        if (newStatus === 'cancelled' && oldStatus !== 'cancelled' && currentGuideIds) {
          try {
            const dataRepository = dataService2.dataRepository || dataService2;
            const assignedGuides = await dataRepository.getMultipleTourGuides(currentGuideIds);
            const notificationService = getNotificationService();
            for (const guide of assignedGuides) {
              try {
                await notificationService.sendPublicTourCancelledToGuide(currentTour, guide);
                console.log('Public tour cancellation email sent to guide:', guide.email);
              } catch (guideError) {
                console.error(`Error sending cancellation email to guide ${guide.id}:`, guideError);
              }
            }
          } catch (emailError) {
            console.error('Error sending cancellation emails to guides:', emailError);
            // Don't fail the update if email fails
          }
        }

        // Handle guide roster changes (only when the update included the field)
        if (updateData.assigned_guide_id !== undefined) {
          try {
            const dataRepository = dataService2.dataRepository || dataService2;
            const newGuides = dataRepository.getNewGuideIds(currentGuideIds, newGuideIds);
            const removedGuideIds = dataRepository.getNewGuideIds(newGuideIds, currentGuideIds);
            const notificationService = getNotificationService();

            // Notify removed guides
            if (removedGuideIds.length > 0) {
              const removedGuides = await dataRepository.getMultipleTourGuides(removedGuideIds.join(','));
              for (const guide of removedGuides) {
                try {
                  await notificationService.sendPublicTourGuideRemoved(updateResult, guide);
                  console.log(`Public tour guide removal email sent to ${guide.name}`);
                } catch (guideError) {
                  console.error(`Error sending removal email to guide ${guide.id}:`, guideError);
                }
              }
            }

            if (newGuides.length > 0) {
              let calendarLink = null;

              // Create calendar event if it doesn't exist, or get existing link
              const calendarService = await getCalendarService();
              if (!updateResult.calendar_event_id) {
                // Create new calendar event
                const { eventId, link } = await calendarService.createPublicTourEvent(updateResult);
                calendarLink = link;

                // Update tour with calendar event ID
                await dataService2.updatePublicTour({
                  ...updateResult,
                  calendar_event_id: eventId
                });
                updateResult.calendar_event_id = eventId;
              } else {
                // Get existing calendar event link
                calendarLink = await calendarService.getEventLink(updateResult.calendar_event_id);
              }

              // Send assignment email to each new guide only
              for (const guideId of newGuides) {
                try {
                  const guide = await dataService2.getTourGuideById(guideId);
                  if (guide) {
                    await notificationService.sendPublicTourGuideAssignment(updateResult, guide, calendarLink);
                    console.log(`Public tour guide assignment email sent to ${guide.name}`);
                  }
                } catch (guideError) {
                  console.error(`Error sending assignment email to guide ${guideId}:`, guideError);
                }
              }
            }

            // Keep the calendar event description in sync with the guide roster
            if (updateResult.calendar_event_id && (newGuides.length > 0 || removedGuideIds.length > 0)) {
              try {
                const calendarService = await getCalendarService();
                const allGuides = await dataRepository.getMultipleTourGuides(newGuideIds);
                const registrations = await dataService2.getPublicTourRegistrations(updateResult.id);
                await calendarService.updateEvent(updateResult.calendar_event_id, {
                  description: calendarService.buildPublicTourEventDescription(updateResult, allGuides, registrations)
                });
              } catch (calendarError) {
                console.error('Error updating calendar event description:', calendarError);
              }
            }
          } catch (error) {
            console.error('Error handling guide assignment for tour update:', error);
            // Don't fail the update if email/calendar fails
          }
        }

        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(updateResult)
        };

      default:
        return {
          statusCode: 405,
          headers: {},
          body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
  } catch (error) {
    console.error('Public tours API error:', error);
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
const { getCachedDataService, getNotificationService, getCalendarService } = require('./lib/services');
const { validateRecaptcha } = require('./lib/recaptcha');
const { createCalendarDates } = require('./lib/utils/dateUtils');
const { TourRequestSchema, TourRequestUpdateSchema, StatusUpdateSchema, validateInput } = require('./lib/validation/schemas');
const { withRateLimit } = require('./lib/rateLimiter');
const { requireAuth } = require('./lib/auth');

// Main handler function
async function mainHandler(event, context) {
  console.log('Tour requests function called:', event.httpMethod, event.path);

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {},
      body: '',
    };
  }

  // Require authentication for GET and PUT (viewing/updating tour requests)
  // POST is allowed for public tour request submissions
  if (event.httpMethod === 'GET' || event.httpMethod === 'PUT') {
    const authError = requireAuth(event);
    if (authError) {
      return authError;
    }
  }

  try {
    const path = event.path.replace('/.netlify/functions/tour-requests', '');
    const pathParts = path.split('/').filter(p => p);

    switch (event.httpMethod) {
      case 'GET':
        const dataService = await getCachedDataService();
        const requests = await dataService.getAllTourRequests();
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(requests),
        };

      case 'POST':
        const requestBody = JSON.parse(event.body);
        
        // Validate input data
        const validation = validateInput(TourRequestSchema, requestBody);
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
        
        const newRequest = validation.data;

        // reCAPTCHA is required for unauthenticated submissions; logged-in
        // admins creating requests from the dashboard are exempt, and
        // enforcement only applies when reCAPTCHA is configured
        const isAuthenticatedAdmin = !requireAuth(event);
        if (!process.env.RECAPTCHA_SECRET_KEY) {
          console.warn('RECAPTCHA_SECRET_KEY not configured - skipping reCAPTCHA enforcement');
        } else if (!isAuthenticatedAdmin) {
          // Read the token from the raw body - the Zod schema strips unknown keys
          const recaptchaToken = requestBody.recaptchaToken;
          if (!recaptchaToken) {
            return {
              statusCode: 400,
              headers: {},
              body: JSON.stringify({ error: 'reCAPTCHA verification required' })
            };
          }

          const recaptchaResult = await validateRecaptcha(
            recaptchaToken,
            'special_tour_request',
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
        delete newRequest.recaptchaToken;
        
        const dataService1 = await getCachedDataService();
        const notificationService = getNotificationService();
        
        const result = await dataService1.createTourRequest(newRequest);
        
        // Send notification emails
        await notificationService.sendTourRequestEmails(result);
        
        return {
          statusCode: 200,
          headers: {},
          body: JSON.stringify(result),
        };

      case 'PUT':
        const updateBody = JSON.parse(event.body);
        
        if (!updateBody.id) {
          return {
            statusCode: 400,
            headers: {},
            body: JSON.stringify({ error: 'Request ID required' }),
          };
        }
        
        // Validate update data based on what type of update it is
        let updateData;
        if (updateBody.status && Object.keys(updateBody).length === 2) {
          // Status update
          const statusValidation = validateInput(StatusUpdateSchema, updateBody);
          if (!statusValidation.success) {
            return {
              statusCode: 400,
              headers: {},
              body: JSON.stringify({
                error: 'Validation failed',
                details: statusValidation.issues
              })
            };
          }
          updateData = statusValidation.data;
        } else {
          // Full request update - dedicated update schema (allows empty and
          // past dates so existing requests stay editable)
          const updateValidation = validateInput(TourRequestUpdateSchema, updateBody);
          if (!updateValidation.success) {
            return {
              statusCode: 400,
              headers: {},
              body: JSON.stringify({
                error: 'Validation failed',
                details: updateValidation.issues
              })
            };
          }
          updateData = updateValidation.data;
        }
        
        const dataService2 = await getCachedDataService();
        
        // Check if this is a status update or full request update
        if (updateData.status && Object.keys(updateData).length === 2) {
          
          // If status is being changed to "scheduled", create calendar event
          if (updateData.status === 'scheduled') {
            
            // Get the current request data
            const allRequests = await dataService2.getAllTourRequests();
            const currentRequest = allRequests.find(req => req.id == updateData.id);
            
            if (currentRequest) {
              try {
                // Create calendar event (without guide for now)
                const calendarService = await getCalendarService();
                const { eventId, calendarLink } = await calendarService.createTourEvent(currentRequest, null);
                
                // Update request with calendar event ID and set status to "scheduled"
                const updateResult = await dataService2.updateRequestCalendarEventId(updateData.id, eventId);
                console.log('Calendar event created and status updated to scheduled:', updateResult);
                
                return {
                  statusCode: 200,
                  headers: {},
                  body: JSON.stringify(updateResult),
                };
              } catch (error) {
                console.error('Error creating calendar event:', error);
                // Fall back to just status update if calendar creation fails
                const updateResult = await dataService2.updateTourRequestStatus(updateData.id, updateData.status);
                return {
                  statusCode: 200,
                  headers: {},
                  body: JSON.stringify(updateResult),
                };
              }
            } else {
              console.log('Request not found, just updating status');
              const updateResult = await dataService2.updateTourRequestStatus(updateData.id, updateData.status);
              return {
                statusCode: 200,
                headers: {},
                body: JSON.stringify(updateResult),
              };
            }
          } else if (updateData.status === 'cancelled') {
            // Get the current request data to check if it has an assigned guide
            const allRequests = await dataService2.getAllTourRequests();
            const currentRequest = allRequests.find(req => req.id == updateData.id);

            // Update status to cancelled
            const updateResult = await dataService2.updateTourRequestStatus(updateData.id, updateData.status);

            // Send cancellation email to all assigned guides
            if (currentRequest && currentRequest.assigned_guide_id) {
              try {
                const dataRepository = dataService2.dataRepository || dataService2;
                const assignedGuides = await dataRepository.getMultipleTourGuides(currentRequest.assigned_guide_id);
                const notificationService = getNotificationService();
                for (const guide of assignedGuides) {
                  try {
                    await notificationService.sendTourCancelledToGuide(currentRequest, guide);
                    console.log('Cancellation email sent to guide:', guide.email);
                  } catch (guideError) {
                    console.error(`Error sending cancellation email to guide ${guide.id}:`, guideError);
                  }
                }
              } catch (emailError) {
                console.error('Error sending cancellation emails to guides:', emailError);
                // Don't fail the status update if email fails
              }
            }

            return {
              statusCode: 200,
              headers: {},
              body: JSON.stringify(updateResult),
            };
          } else {
            // Regular status update
            const updateResult = await dataService2.updateTourRequestStatus(updateData.id, updateData.status);

            return {
              statusCode: 200,
              headers: {},
              body: JSON.stringify(updateResult),
            };
          }
        } else {
          
          // Get the original request to compare for guide assignment
          const allRequests = await dataService2.getAllTourRequests();
          const originalRequest = allRequests.find(req => req.id == updateData.id);
          const currentGuideIds = originalRequest ? originalRequest.assigned_guide_id : '';

          // Full request update
          const updateResult = await dataService2.updateTourRequest(updateData);

          // Send email notifications if the guide roster changed.
          // Only treat assigned_guide_id as changed when the update actually
          // included the field (undefined means "not part of this update").
          if (updateData.assigned_guide_id !== undefined) {
            try {
              const dataRepository = dataService2.dataRepository || dataService2;
              const newGuideIdsString = updateData.assigned_guide_id || '';
              const newGuideIds = dataRepository.getNewGuideIds(currentGuideIds, newGuideIdsString);
              const removedGuideIds = dataRepository.getNewGuideIds(newGuideIdsString, currentGuideIds);

              if (newGuideIds.length > 0 || removedGuideIds.length > 0) {
                const notificationService = getNotificationService();
                const allGuides = await dataRepository.getMultipleTourGuides(newGuideIdsString);

                // Get existing calendar link for assigned tours
                let calendarLink = null;
                if (updateResult.calendar_event_id) {
                  try {
                    const calendarService = await getCalendarService();
                    calendarLink = await calendarService.getEventLink(updateResult.calendar_event_id);
                  } catch (calendarError) {
                    console.error('Error retrieving calendar link for existing event:', calendarError);
                  }
                }

                // Notify removed guides
                if (removedGuideIds.length > 0) {
                  const removedGuides = await dataRepository.getMultipleTourGuides(removedGuideIds.join(','));
                  for (const guide of removedGuides) {
                    try {
                      await notificationService.sendGuideRemovedNotification(updateResult, guide);
                      console.log(`Guide removal email sent to ${guide.name}`);
                    } catch (guideError) {
                      console.error(`Error sending removal email to guide ${guide.id}:`, guideError);
                    }
                  }
                }

                // Send emails to new guides only
                for (const guideId of newGuideIds) {
                  const guide = allGuides.find(g => g.id === guideId);
                  if (guide) {
                    await notificationService.sendTourAssignedToGuide(updateResult, guide, calendarLink);
                    console.log(`Guide assignment email sent to ${guide.name}`);
                  }
                }

                // Send visitor confirmation only on the first guide assignment
                if (newGuideIds.length > 0 && (!currentGuideIds || currentGuideIds.trim() === '')) {
                  await notificationService.sendTourScheduledToVisitor(updateResult, allGuides, calendarLink);
                }

                // Keep the calendar event description in sync with the guide roster
                if (updateResult.calendar_event_id) {
                  try {
                    const calendarService = await getCalendarService();
                    await calendarService.updateEvent(updateResult.calendar_event_id, {
                      description: calendarService.buildTourEventDescription(updateResult, allGuides)
                    });
                  } catch (calendarError) {
                    console.error('Error updating calendar event description:', calendarError);
                  }
                }
              }
            } catch (emailError) {
              console.error('Failed to send guide assignment emails:', emailError);
              // Don't fail the update if email fails
            }
          }
          
          return {
            statusCode: 200,
            headers: {},
            body: JSON.stringify(updateResult),
          };
        }

      default:
        return {
          statusCode: 405,
          headers: {},
          body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }
  } catch (error) {
    console.error('Error in tour-requests function:', error);
    return {
      statusCode: 500,
      headers: {},
      body: JSON.stringify({ error: error.message }),
    };
  }
}

// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};
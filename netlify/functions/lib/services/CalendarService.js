/**
 * CalendarService - Handles Google Calendar integration
 * Creates, updates, and manages calendar events for tours
 */

const { google } = require('googleapis');
const { createCalendarDates } = require('../utils/dateUtils');
const { UNIVERSITY } = require('../utils/constants');

class CalendarService {
  constructor() {
    this.calendar = null;
    this.auth = null;
  }

  async initialize() {
    try {
      // Use service account credentials from environment
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/calendar']
      });

      this.calendar = google.calendar({ version: 'v3', auth: this.auth });
      console.log('Google Calendar authentication initialized');
    } catch (error) {
      console.error('Failed to initialize Google Calendar auth:', error);
      throw error;
    }
  }

  /**
   * Create a calendar event for a tour request
   */
  async createTourEvent(request, guide = null) {
    try {
      const { start, end } = createCalendarDates(request.preferred_date, request.preferred_time, 1);
      
      const event = {
        summary: `Tour for ${request.visitor_name} (Group of ${request.group_size})`,
        description: this.buildTourEventDescription(request, guide),
        start: {
          dateTime: `${start}`,
          timeZone: 'America/Detroit',
        },
        end: {
          dateTime: `${end}`,
          timeZone: 'America/Detroit',
        },
        location: `${UNIVERSITY.BUILDING_NAME}, ${UNIVERSITY.ADDRESS.FULL}`,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 }, // 1 hour before
          ],
        },
        conferenceData: {
          createRequest: {
            requestId: `tour-${request.id}-${Date.now()}`,
          },
        },
      };

      console.log('Creating calendar event for tour:', request.id);
      const response = await this.calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        resource: event,
        conferenceDataVersion: 1,
        sendUpdates: 'all'
      });

      console.log('Calendar event created:', response.data.id);
      return {
        eventId: response.data.id,
        link: response.data.htmlLink,
        hangoutLink: response.data.hangoutLink
      };
    } catch (error) {
      console.error('Error creating tour calendar event:', error);
      throw error;
    }
  }

  /**
   * Create a calendar event for a public tour
   */
  async createPublicTourEvent(tour, guide = null, registrations = []) {
    try {
      const { start, end } = createCalendarDates(tour.date, tour.time, 1);
      
      const event = {
        summary: `${tour.title} - Public Tour`,
        description: this.buildPublicTourEventDescription(tour, guide, registrations),
        start: {
          dateTime: `${start}`,
          timeZone: 'America/Detroit',
        },
        end: {
          dateTime: `${end}`,
          timeZone: 'America/Detroit',
        },
        location: `${UNIVERSITY.BUILDING_NAME}, ${UNIVERSITY.ADDRESS.FULL}`,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 }, // 1 day before
            { method: 'popup', minutes: 60 }, // 1 hour before
          ],
        },
      };

      console.log('Creating calendar event for public tour:', tour.id);
      const response = await this.calendar.events.insert({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        resource: event,
        sendUpdates: 'all'
      });

      console.log('Public tour calendar event created:', response.data.id);
      return {
        eventId: response.data.id,
        link: response.data.htmlLink
      };
    } catch (error) {
      console.error('Error creating public tour calendar event:', error);
      throw error;
    }
  }

  /**
   * Update an existing calendar event
   */
  async updateEvent(eventId, updates) {
    try {
      console.log('Updating calendar event:', eventId);
      
      // Get the existing event first
      const existingEvent = await this.calendar.events.get({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId: eventId
      });

      // Merge updates with existing event
      const updatedEvent = {
        ...existingEvent.data,
        ...updates
      };

      const response = await this.calendar.events.update({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId: eventId,
        resource: updatedEvent,
        sendUpdates: 'all'
      });

      console.log('Calendar event updated successfully');
      return {
        eventId: response.data.id,
        link: response.data.htmlLink
      };
    } catch (error) {
      console.error('Error updating calendar event:', error);
      throw error;
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(eventId) {
    try {
      console.log('Deleting calendar event:', eventId);
      
      await this.calendar.events.delete({
        calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary',
        eventId: eventId,
        sendUpdates: 'all'
      });

      console.log('Calendar event deleted successfully');
      return { success: true };
    } catch (error) {
      console.error('Error deleting calendar event:', error);
      throw error;
    }
  }

  /**
   * Build description for tour calendar event
   */
  buildTourEventDescription(request, guide) {
    let description = `Building Tour Request\n\n`;
    description += `Visitor: ${request.visitor_name}\n`;
    description += `Email: ${request.visitor_email}\n`;
    if (request.visitor_phone) {
      description += `Phone: ${request.visitor_phone}\n`;
    }
    description += `Group Size: ${request.group_size}\n`;

    // Accepts a single guide object or an array of guides
    const guides = Array.isArray(guide) ? guide : (guide ? [guide] : []);
    if (guides.length > 0) {
      description += `\n`;
      for (const g of guides) {
        description += `Tour Guide: ${g.name}\n`;
        description += `Guide Email: ${g.email}\n`;
        if (g.phone) {
          description += `Guide Phone: ${g.phone}\n`;
        }
      }
    }
    
    if (request.additional_info) {
      description += `\nAdditional Information:\n${request.additional_info}\n`;
    }
    
    if (request.tshirt_request && request.tshirt_total > 0) {
      description += `\nT-Shirt Order: ${request.tshirt_total} shirts - $${request.tshirt_cost}\n`;
    }
    
    description += `\nMeeting Location: Main staircase in the atrium\n`;
    description += `Duration: Approximately 45 minutes\n`;
    description += `\nFor questions, contact: robotics-tours@umich.edu`;
    
    return description;
  }

  /**
   * Build description for public tour calendar event
   */
  buildPublicTourEventDescription(tour, guide, registrations) {
    let description = `${tour.title}\n\n`;
    description += `Type: ${tour.type}\n`;
    description += `Capacity: ${tour.capacity}\n`;
    description += `Current Registrations: ${registrations.length}\n`;
    
    // Accepts a single guide object or an array of guides
    const guides = Array.isArray(guide) ? guide : (guide ? [guide] : []);
    if (guides.length > 0) {
      description += `\n`;
      for (const g of guides) {
        description += `Tour Guide: ${g.name}\n`;
        description += `Guide Email: ${g.email}\n`;
      }
    }

    if (tour.notes) {
      description += `\nNotes: ${tour.notes}\n`;
    }
    
    description += `\nMeeting Location: Main staircase in the atrium\n`;
    description += `Duration: Approximately 45 minutes\n`;
    
    if (registrations.length > 0) {
      description += `\nRegistered Participants:\n`;
      registrations.slice(0, 10).forEach(reg => {
        description += `- ${reg.name} (${reg.email}) - Group of ${reg.group_size}\n`;
      });
      
      if (registrations.length > 10) {
        description += `... and ${registrations.length - 10} more participants\n`;
      }
    }
    
    description += `\nFor questions, contact: robotics-tours@umich.edu`;
    
    return description;
  }

  /**
   * Generate calendar link for manual addition (fallback)
   */
  /**
   * Get the HTML link for an existing calendar event
   */
  async getEventLink(eventId) {
    try {
      const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
      const response = await this.calendar.events.get({
        calendarId: calendarId,
        eventId: eventId
      });
      
      return response.data.htmlLink;
    } catch (error) {
      console.error('Error getting event link:', error);
      throw error;
    }
  }

  generateCalendarLink(title, startDate, endDate, location, description) {
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: title,
      dates: `${startDate.replace(/[-:]/g, '')}/${endDate.replace(/[-:]/g, '')}`,
      location: location,
      details: description
    });
    
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }
}

module.exports = CalendarService;
/**
 * NotificationService - Handles all email notifications
 * Centralizes email sending logic and template usage
 */

const FormData = require('form-data');
const Mailgun = require('mailgun.js');
const {
  generateTourRequestConfirmationEmail,
  generateTourRequestNotificationEmail,
  generateVisitorScheduledEmail,
  generateGuideScheduledEmail,
  generatePublicTourGuideEmail,
  generateVisitorReminderEmail,
  generateGuideReminderEmail,
  generatePublicTourReminderEmail,
  generatePublicTourConfirmationEmail,
  generateFeedbackEmail,
  generateTourCancelledEmail,
  generatePublicTourCancelledEmail,
  generateGuideRemovedEmail,
  generatePublicTourGuideRemovedEmail
} = require('../email-templates');
const { EMAIL_ADDRESSES, ENV } = require('../utils/constants');

class NotificationService {
  constructor() {
    this.baseUrl = process.env.URL || ENV.DEFAULT_URL;
    this.mailgun = new Mailgun(FormData);
  }

  /**
   * Core email sending function using Mailgun directly
   */
  async sendEmail(emailData) {
    try {
      if (!process.env.MAILGUN_API_KEY || !process.env.MAILGUN_DOMAIN) {
        console.error('Mailgun credentials not configured');
        throw new Error('Email service not configured');
      }

      const mg = this.mailgun.client({
        username: 'api',
        key: process.env.MAILGUN_API_KEY,
      });

      const data = {
        from: `Michigan Robotics Tours <tours@robotics.umich.edu>`,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text || '',
        html: emailData.html || emailData.text || '',
        'Reply-To': emailData.replyTo || EMAIL_ADDRESSES.TOURS
      };

      const result = await mg.messages.create(process.env.MAILGUN_DOMAIN, data);

      // Record in the Email Log sheet when tour context is provided (best effort)
      if (emailData.meta) {
        await this.logEmail({ ...emailData.meta, recipient: emailData.to });
      }

      return { success: true, messageId: result.id };
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Record a sent email in the Email Log sheet. Never throws - logging
   * must not fail or block the send itself.
   */
  async logEmail(entry) {
    try {
      // Lazy require to avoid a circular dependency with services/index
      const { getDataRepository } = require('./index');
      const dataRepository = await getDataRepository();
      await dataRepository.logEmail(entry);
    } catch (error) {
      console.error('Failed to log email (non-fatal):', error.message);
    }
  }

  /**
   * Send confirmation email when a tour request is received
   */
  async sendTourRequestConfirmation(data) {
    const html = generateTourRequestConfirmationEmail(data);
    
    return await this.sendEmail({
      to: data.visitor_email,
      subject: 'Tour request received - Michigan Robotics',
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: data.id, email_type: 'request_confirmation' }
    });
  }

  /**
   * Send notification to admin when a new tour request is submitted
   */
  async sendTourRequestNotification(data) {
    const html = generateTourRequestNotificationEmail(data);
    
    return await this.sendEmail({
      to: EMAIL_ADDRESSES.TOURS,
      subject: `New tour request from ${data.visitor_name}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: data.id, email_type: 'request_notification' }
    });
  }

  /**
   * Send both confirmation and notification emails for tour requests
   */
  async sendTourRequestEmails(data) {
    try {
      console.log('Sending tour request emails for:', data.visitor_name);
      
      // Send both emails in parallel
      const [confirmationResult, notificationResult] = await Promise.all([
        this.sendTourRequestConfirmation(data),
        this.sendTourRequestNotification(data)
      ]);

      console.log('Tour request emails sent successfully');
      return { confirmationResult, notificationResult };
    } catch (error) {
      console.error('Error sending tour request emails:', error);
      throw error;
    }
  }

  /**
   * Send email to visitor when tour is scheduled
   * @param {Object} request - Tour request data
   * @param {Object|Array} guide - Guide object or array of guide objects
   * @param {string} calendarLink - Calendar event link
   */
  async sendTourScheduledToVisitor(request, guide, calendarLink) {
    const html = generateVisitorScheduledEmail(request, guide, calendarLink);

    return await this.sendEmail({
      to: request.visitor_email,
      subject: 'Your tour is scheduled - Michigan Robotics',
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: request.id, email_type: 'visitor_scheduled' }
    });
  }

  /**
   * Send email to guide when removed from a tour
   */
  async sendGuideRemovedNotification(request, guide) {
    const html = generateGuideRemovedEmail(request, guide);

    return await this.sendEmail({
      to: guide.email,
      subject: `Tour guide assignment removed - ${request.visitor_name}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: request.id, email_type: 'guide_removed' }
    });
  }

  /**
   * Send email to guide when removed from a public tour
   */
  async sendPublicTourGuideRemoved(tour, guide) {
    const html = generatePublicTourGuideRemovedEmail(tour, guide);

    return await this.sendEmail({
      to: guide.email,
      subject: `Public tour assignment removed - ${tour.title}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'public', tour_id: tour.id, email_type: 'guide_removed' }
    });
  }

  /**
   * Send email to guide when assigned to a tour
   */
  async sendTourAssignedToGuide(request, guide, calendarLink) {
    const html = generateGuideScheduledEmail(request, guide, calendarLink);
    
    return await this.sendEmail({
      to: guide.email,
      subject: `Robotics tour guide assignment - ${request.visitor_name}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: request.id, email_type: 'guide_assignment' }
    });
  }

  /**
   * Send both visitor and guide emails when tour is scheduled
   */
  async sendTourScheduledEmails(request, guide, calendarLink) {
    try {
      console.log('Sending tour scheduled emails for request:', request.id);
      
      // Send both emails in parallel
      const [visitorResult, guideResult] = await Promise.all([
        this.sendTourScheduledToVisitor(request, guide, calendarLink),
        this.sendTourAssignedToGuide(request, guide, calendarLink)
      ]);

      console.log('Tour scheduled emails sent successfully');
      return { visitorResult, guideResult };
    } catch (error) {
      console.error('Error sending tour scheduled emails:', error);
      throw error;
    }
  }

  /**
   * Send email to guide when assigned to a public tour
   */
  async sendPublicTourGuideAssignment(tour, guide, calendarLink) {
    const html = generatePublicTourGuideEmail(tour, guide, calendarLink);
    
    return await this.sendEmail({
      to: guide.email,
      subject: `Robotics public tour assignment - ${tour.title}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'public', tour_id: tour.id, email_type: 'guide_assignment' }
    });
  }

  /**
   * Send confirmation email for public tour registration
   */
  async sendPublicTourConfirmation(registration, tour, calendarLink = null) {
    const html = generatePublicTourConfirmationEmail(registration, tour, calendarLink);
    
    return await this.sendEmail({
      to: registration.email,
      subject: `Robotics tour registration confirmed - ${tour.title}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'public', tour_id: tour.id, email_type: 'registration_confirmation' }
    });
  }

  /**
   * Send reminder email to visitor the day before their tour
   * @param {Object} request - Tour request data
   * @param {Object|Array} guide - Guide object or array of guide objects
   */
  async sendVisitorReminder(request, guide) {
    const html = generateVisitorReminderEmail(request, guide);

    return await this.sendEmail({
      to: request.visitor_email,
      subject: 'Tour reminder for tomorrow - Michigan Robotics',
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: request.tour_type || 'private', tour_id: request.id, email_type: 'visitor_reminder', tour_date: request.preferred_date }
    });
  }

  /**
   * Send reminder email to guide the day before their tour
   */
  async sendGuideReminder(request, guide) {
    const html = generateGuideReminderEmail(request, guide);

    return await this.sendEmail({
      to: guide.email,
      subject: `Robotics tour guide reminder for tomorrow - ${request.visitor_name}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: request.id, email_type: 'guide_reminder', tour_date: request.preferred_date }
    });
  }

  /**
   * Send reminder email to public tour guide
   */
  async sendPublicTourGuideReminder(tour, guide, registrations) {
    const html = generatePublicTourReminderEmail(tour, guide, registrations);
    
    return await this.sendEmail({
      to: guide.email,
      subject: `Robotics tour reminder for tomorrow - ${tour.title}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'public', tour_id: tour.id, email_type: 'guide_reminder', tour_date: tour.date }
    });
  }

  /**
   * Send reminder emails for a tour (both visitor and guide)
   */
  async sendTourReminderEmails(request, guide) {
    try {
      console.log('Sending tour reminder emails for request:', request.id);
      
      // Send both emails in parallel
      const [visitorResult, guideResult] = await Promise.all([
        this.sendVisitorReminder(request, guide),
        this.sendGuideReminder(request, guide)
      ]);

      console.log('Tour reminder emails sent successfully');
      return { visitorResult, guideResult };
    } catch (error) {
      console.error('Error sending tour reminder emails:', error);
      throw error;
    }
  }

  /**
   * Send multiple reminder emails in batch
   */
  async sendBatchReminders(reminders) {
    const results = [];
    
    for (const reminder of reminders) {
      try {
        let result;
        
        if (reminder.type === 'tour') {
          result = await this.sendTourReminderEmails(reminder.request, reminder.guide);
        } else if (reminder.type === 'public_tour') {
          result = await this.sendPublicTourGuideReminder(reminder.tour, reminder.guide, reminder.registrations);
        }
        
        results.push({
          success: true,
          id: reminder.id,
          result
        });
      } catch (error) {
        console.error(`Failed to send reminder for ${reminder.id}:`, error);
        results.push({
          success: false,
          id: reminder.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Send feedback request email
   */
  async sendFeedbackEmail(tourData) {
    try {
      const html = generateFeedbackEmail(tourData);

      const emailResult = await this.sendEmail({
        to: tourData.visitor_email,
        subject: 'How was your Michigan Robotics tour?',
        html: html,
        meta: { tour_type: tourData.tour_type, tour_id: tourData.tour_id, email_type: 'feedback_request' }
      });

      console.log(`Feedback email sent to ${tourData.visitor_email} for tour ${tourData.tour_id}`);

      return {
        success: true,
        messageId: emailResult.messageId,
        recipient: tourData.visitor_email
      };

    } catch (error) {
      console.error(`Error sending feedback email to ${tourData.visitor_email}:`, error);
      return {
        success: false,
        error: error.message,
        recipient: tourData.visitor_email
      };
    }
  }

  /**
   * Send cancellation email to tour guide
   */
  async sendTourCancelledToGuide(request, guide) {
    const html = generateTourCancelledEmail(request, guide);

    return await this.sendEmail({
      to: guide.email,
      subject: `Tour cancelled - ${request.visitor_name}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'private', tour_id: request.id, email_type: 'tour_cancelled_guide' }
    });
  }

  /**
   * Send cancellation email to public tour guide
   */
  async sendPublicTourCancelledToGuide(tour, guide) {
    const html = generatePublicTourCancelledEmail(tour, guide);

    return await this.sendEmail({
      to: guide.email,
      subject: `Public tour cancelled - ${tour.title}`,
      html,
      replyTo: EMAIL_ADDRESSES.TOURS,
      meta: { tour_type: 'public', tour_id: tour.id, email_type: 'tour_cancelled_guide' }
    });
  }
}

module.exports = NotificationService;
/**
 * DataRepository - Pure data access layer for Google Sheets
 * Handles all CRUD operations without business logic, email sending, or calendar integration
 */

const { google } = require('googleapis');
const { SPREADSHEET_ID, SHEET_NAMES, STATUS, TOUR } = require('../utils/constants');

class DataRepository {
  constructor() {
    this.sheets = google.sheets('v4');
    this.auth = null;
  }

  async initialize() {
    try {
      // Use service account credentials from environment
      const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      
      this.auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });

      this.sheets = google.sheets({ version: 'v4', auth: this.auth });
      console.log('Google Sheets authentication initialized');
    } catch (error) {
      console.error('Failed to initialize Google Sheets auth:', error);
      throw error;
    }
  }

  async getSheetData(sheetName) {
    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`,
      });
      
      return response.data.values || [];
    } catch (error) {
      console.error(`Error getting data from ${sheetName}:`, error);
      throw error;
    }
  }

  async appendToSheet(sheetName, data) {
    try {
      const response = await this.sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A:Z`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [data]
        }
      });
      return response;
    } catch (error) {
      console.error(`Error appending to ${sheetName}:`, error);
      throw error;
    }
  }

  async updateRow(sheetName, rowIndex, data) {
    try {
      const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
      const response = await this.sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: range,
        valueInputOption: 'RAW',
        resource: {
          values: [data]
        }
      });
      return response;
    } catch (error) {
      console.error(`Error updating row ${rowIndex} in ${sheetName}:`, error);
      throw error;
    }
  }

  /**
   * Converts a Google Sheets row array to an object based on schema
   */
  rowToObject(row, sheetName) {
    const schemas = {
      [SHEET_NAMES.TOUR_GUIDES]: ['id', 'name', 'email', 'phone', 'availability', 'created_at'],
      [SHEET_NAMES.TOUR_REQUESTS]: ['id', 'visitor_name', 'visitor_email', 'visitor_phone', 'group_size', 'preferred_date', 'preferred_time', 'tshirt_request', 'tshirt_sizes', 'tshirt_total', 'tshirt_cost', 'additional_info', 'newsletter_signup', 'assigned_guide_id', 'status', 'calendar_event_id', 'created_at'],
      [SHEET_NAMES.PUBLIC_TOURS]: ['id', 'title', 'date', 'time', 'type', 'capacity', 'status', 'notes', 'assigned_guide_id', 'calendar_event_id', 'created_at'],
      [SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS]: ['id', 'public_tour_id', 'name', 'email', 'group_size', 'phone', 'status', 'notes', 'tshirt_request', 'tshirt_sizes', 'tshirt_total', 'tshirt_cost', 'newsletter_signup', 'attendance', 'created_at'],
      [SHEET_NAMES.FEEDBACK]: ['id', 'tour_id', 'tour_type', 'visitor_name', 'visitor_email', 'tour_date', 'guide_name', 'nps_score', 'nps_reason', 'understanding_robotics', 'impression_changed', 'impression_details', 'overall_rating', 'what_liked_most', 'suggestions_improvement', 'other_comments', 'submission_date', 'created_at']
    };

    const schema = schemas[sheetName];
    const obj = {};
    
    if (schema) {
      schema.forEach((field, index) => {
        let value = row[index] || '';
        
        // Parse JSON fields
        if (['tshirt_sizes'].includes(field) && value) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            console.warn(`Failed to parse JSON for ${field}:`, value);
            value = {};
          }
        }
        
        obj[field] = value;
      });
    }
    
    return obj;
  }

  /**
   * Converts an object to a Google Sheets row array based on schema
   */
  objectToRow(obj, sheetName) {
    const schemas = {
      [SHEET_NAMES.TOUR_GUIDES]: ['id', 'name', 'email', 'phone', 'availability', 'created_at'],
      [SHEET_NAMES.TOUR_REQUESTS]: ['id', 'visitor_name', 'visitor_email', 'visitor_phone', 'group_size', 'preferred_date', 'preferred_time', 'tshirt_request', 'tshirt_sizes', 'tshirt_total', 'tshirt_cost', 'additional_info', 'newsletter_signup', 'assigned_guide_id', 'status', 'calendar_event_id', 'created_at'],
      [SHEET_NAMES.PUBLIC_TOURS]: ['id', 'title', 'date', 'time', 'type', 'capacity', 'status', 'notes', 'assigned_guide_id', 'calendar_event_id', 'created_at'],
      [SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS]: ['id', 'public_tour_id', 'name', 'email', 'group_size', 'phone', 'status', 'notes', 'tshirt_request', 'tshirt_sizes', 'tshirt_total', 'tshirt_cost', 'newsletter_signup', 'attendance', 'created_at'],
      [SHEET_NAMES.FEEDBACK]: ['id', 'tour_id', 'tour_type', 'visitor_name', 'visitor_email', 'tour_date', 'guide_name', 'nps_score', 'nps_reason', 'understanding_robotics', 'impression_changed', 'impression_details', 'overall_rating', 'what_liked_most', 'suggestions_improvement', 'other_comments', 'submission_date', 'created_at']
    };

    const schema = schemas[sheetName];
    const row = [];
    
    if (schema) {
      schema.forEach(field => {
        let value = obj[field] || '';
        
        // Stringify JSON fields
        if (['tshirt_sizes'].includes(field) && typeof value === 'object') {
          value = JSON.stringify(value);
        }
        
        row.push(value);
      });
    }
    
    return row;
  }

  // Tour Requests
  async getAllTourRequests() {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_REQUESTS);
    return rows.slice(1)
      .filter(row => row && row[0]) // Filter out empty rows
      .map(row => this.rowToObject(row, SHEET_NAMES.TOUR_REQUESTS));
  }

  async createTourRequest(data) {
    const id = Date.now().toString();
    // Calculate t-shirt totals and cost if t-shirt data exists
    let tshirtTotal = 0;
    let tshirtCost = 0;
    if (data.tshirt_sizes && typeof data.tshirt_sizes === 'object') {
      tshirtTotal = Object.values(data.tshirt_sizes).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
      tshirtCost = tshirtTotal * 20;
    }

    const requestData = {
      id,
      visitor_name: data.visitor_name,
      visitor_email: data.visitor_email,
      visitor_phone: data.visitor_phone || '',
      group_size: data.group_size || 1,
      preferred_date: data.preferred_date || '',
      preferred_time: data.preferred_time || '',
      tshirt_request: data.tshirt_request || '',
      tshirt_sizes: data.tshirt_sizes || {},
      tshirt_total: tshirtTotal,
      tshirt_cost: tshirtCost,
      additional_info: data.additional_info || '',
      newsletter_signup: data.newsletter_signup || '',
      assigned_guide_id: '',
      status: STATUS.PENDING,
      calendar_event_id: '',
      created_at: new Date().toISOString()
    };

    const row = this.objectToRow(requestData, SHEET_NAMES.TOUR_REQUESTS);
    await this.appendToSheet(SHEET_NAMES.TOUR_REQUESTS, row);
    return requestData;
  }

  async updateTourRequestStatus(id, status) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_REQUESTS);
    const requestIndex = rows.findIndex(row => row[0] == id); // Use loose equality for type flexibility
    
    if (requestIndex === -1) {
      throw new Error('Tour request not found');
    }
    
    const row = rows[requestIndex];
    row[14] = status; // status column
    
    await this.updateRow(SHEET_NAMES.TOUR_REQUESTS, requestIndex + 1, row);
    return this.rowToObject(row, SHEET_NAMES.TOUR_REQUESTS);
  }

  async assignGuideToRequest(id, guideId) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_REQUESTS);
    const requestIndex = rows.findIndex(row => row[0] == id);
    
    if (requestIndex === -1) {
      throw new Error('Tour request not found');
    }
    
    const row = rows[requestIndex];
    // Empty string, not null: the Sheets API skips null cells on update,
    // which would leave the previous guide assignment in place
    row[13] = guideId || ''; // assigned_guide_id column
    row[14] = STATUS.SCHEDULED; // status column
    
    await this.updateRow(SHEET_NAMES.TOUR_REQUESTS, requestIndex + 1, row);
    return this.rowToObject(row, SHEET_NAMES.TOUR_REQUESTS);
  }

  async updateRequestCalendarEventId(id, eventId) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_REQUESTS);
    const requestIndex = rows.findIndex(row => row[0] == id);
    
    if (requestIndex === -1) {
      throw new Error('Tour request not found');
    }
    
    const row = rows[requestIndex];
    row[15] = eventId; // calendar_event_id column
    row[14] = STATUS.SCHEDULED; // status column
    
    await this.updateRow(SHEET_NAMES.TOUR_REQUESTS, requestIndex + 1, row);
    return this.rowToObject(row, SHEET_NAMES.TOUR_REQUESTS);
  }

  async updateTourRequest(data) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_REQUESTS);
    const requestIndex = rows.findIndex(row => row[0] == data.id);
    
    if (requestIndex === -1) {
      throw new Error('Tour request not found');
    }
    
    const updatedRequest = {
      ...this.rowToObject(rows[requestIndex], SHEET_NAMES.TOUR_REQUESTS),
      ...data
    };
    
    const row = this.objectToRow(updatedRequest, SHEET_NAMES.TOUR_REQUESTS);
    await this.updateRow(SHEET_NAMES.TOUR_REQUESTS, requestIndex + 1, row);
    return updatedRequest;
  }

  // Tour Guides
  async getAllTourGuides() {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_GUIDES);
    return rows.slice(1).map(row => this.rowToObject(row, SHEET_NAMES.TOUR_GUIDES));
  }

  async getTourGuideById(id) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_GUIDES);
    const guideRow = rows.find(row => row[0] == id);
    
    if (!guideRow) {
      throw new Error('Tour guide not found');
    }
    
    return this.rowToObject(guideRow, SHEET_NAMES.TOUR_GUIDES);
  }

  async createTourGuide(data) {
    const id = Date.now().toString();
    const guideData = {
      id,
      name: data.name,
      email: data.email,
      phone: data.phone || '',
      availability: data.availability || '',
      created_at: new Date().toISOString()
    };

    const row = this.objectToRow(guideData, SHEET_NAMES.TOUR_GUIDES);
    await this.appendToSheet(SHEET_NAMES.TOUR_GUIDES, row);
    return guideData;
  }

  async updateTourGuide(data) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_GUIDES);
    const guideIndex = rows.findIndex(row => row[0] == data.id);
    
    if (guideIndex === -1) {
      throw new Error('Tour guide not found');
    }
    
    const updatedGuide = {
      ...this.rowToObject(rows[guideIndex], SHEET_NAMES.TOUR_GUIDES),
      ...data
    };
    
    const row = this.objectToRow(updatedGuide, SHEET_NAMES.TOUR_GUIDES);
    await this.updateRow(SHEET_NAMES.TOUR_GUIDES, guideIndex + 1, row);
    return updatedGuide;
  }

  async deleteTourGuide(id) {
    const rows = await this.getSheetData(SHEET_NAMES.TOUR_GUIDES);
    const guideIndex = rows.findIndex(row => row[0] == id);
    
    if (guideIndex === -1) {
      throw new Error('Tour guide not found');
    }
    
    // Mark as deleted by clearing the row (Google Sheets doesn't support row deletion via API easily)
    const emptyRow = new Array(rows[guideIndex].length).fill('');
    await this.updateRow(SHEET_NAMES.TOUR_GUIDES, guideIndex + 1, emptyRow);
    return { success: true };
  }

  // Public Tours
  async getAllPublicTours() {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOURS);
    const tours = rows.slice(1).map(row => this.rowToObject(row, SHEET_NAMES.PUBLIC_TOURS));
    
    // Load registrations for each tour
    const allRegistrations = await this.getAllPublicTourRegistrations();
    
    // Add registrations to each tour
    tours.forEach(tour => {
      tour.registrations = allRegistrations.filter(reg => reg.public_tour_id === tour.id);
    });
    
    return tours;
  }

  async getPublicTourById(id) {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOURS);
    const tourRow = rows.find(row => row[0] == id);
    
    if (!tourRow) {
      throw new Error('Public tour not found');
    }
    
    const tour = this.rowToObject(tourRow, SHEET_NAMES.PUBLIC_TOURS);
    
    // Load registrations for this tour
    const registrations = await this.getPublicTourRegistrations(id);
    tour.registrations = registrations;
    
    return tour;
  }

  async createPublicTour(data) {
    const id = Date.now().toString();
    const tourData = {
      id,
      title: data.title,
      date: data.date,
      time: data.time || TOUR.DEFAULT_PUBLIC_TOUR_TIME,
      type: data.type || 'public',
      capacity: data.capacity || 20,
      status: STATUS.ACTIVE,
      notes: data.notes || '',
      assigned_guide_id: data.assigned_guide_id || '',
      calendar_event_id: '',
      created_at: new Date().toISOString()
    };

    const row = this.objectToRow(tourData, SHEET_NAMES.PUBLIC_TOURS);
    await this.appendToSheet(SHEET_NAMES.PUBLIC_TOURS, row);
    return tourData;
  }

  async updatePublicTour(data) {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOURS);
    const tourIndex = rows.findIndex(row => row[0] == data.id);
    
    if (tourIndex === -1) {
      throw new Error('Public tour not found');
    }
    
    const updatedTour = {
      ...this.rowToObject(rows[tourIndex], SHEET_NAMES.PUBLIC_TOURS),
      ...data
    };
    
    const row = this.objectToRow(updatedTour, SHEET_NAMES.PUBLIC_TOURS);
    await this.updateRow(SHEET_NAMES.PUBLIC_TOURS, tourIndex + 1, row);
    return updatedTour;
  }

  async deletePublicTour(id) {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOURS);
    const tourIndex = rows.findIndex(row => row[0] == id);
    
    if (tourIndex === -1) {
      throw new Error('Public tour not found');
    }
    
    // Mark as deleted by clearing the row
    const emptyRow = new Array(rows[tourIndex].length).fill('');
    await this.updateRow(SHEET_NAMES.PUBLIC_TOURS, tourIndex + 1, emptyRow);
    return { success: true };
  }

  // Public Tour Registrations
  async getAllPublicTourRegistrations() {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS);
    return rows.slice(1).map(row => this.rowToObject(row, SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS));
  }

  async getPublicTourRegistrations(tourId) {
    const allRegistrations = await this.getAllPublicTourRegistrations();
    return allRegistrations.filter(reg => reg.public_tour_id === tourId);
  }

  async createPublicTourRegistration(data) {
    const id = Date.now().toString();
    
    // Calculate t-shirt totals and cost if t-shirt data exists
    let tshirtTotal = 0;
    let tshirtCost = 0;
    if (data.tshirt_sizes && typeof data.tshirt_sizes === 'object') {
      tshirtTotal = Object.values(data.tshirt_sizes).reduce((sum, qty) => sum + (parseInt(qty) || 0), 0);
      tshirtCost = tshirtTotal * 20;
    }
    
    const registrationData = {
      id,
      public_tour_id: data.public_tour_id,
      name: data.name,
      email: data.email,
      group_size: data.group_size || 1,
      phone: data.phone || '',
      status: STATUS.REGISTERED,
      notes: data.notes || '',
      tshirt_request: data.tshirt_request || '',
      tshirt_sizes: data.tshirt_sizes || {},
      tshirt_total: tshirtTotal,
      tshirt_cost: tshirtCost,
      newsletter_signup: data.newsletter_signup || '',
      attendance: data.attendance || '',
      created_at: new Date().toISOString()
    };

    const row = this.objectToRow(registrationData, SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS);
    await this.appendToSheet(SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS, row);
    return registrationData;
  }

  async updatePublicTourRegistration(data) {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS);
    const regIndex = rows.findIndex(row => row[0] == data.id);
    
    if (regIndex === -1) {
      throw new Error('Public tour registration not found');
    }
    
    const updatedRegistration = {
      ...this.rowToObject(rows[regIndex], SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS),
      ...data
    };
    
    const row = this.objectToRow(updatedRegistration, SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS);
    await this.updateRow(SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS, regIndex + 1, row);
    return updatedRegistration;
  }

  async deletePublicTourRegistration(id) {
    const rows = await this.getSheetData(SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS);
    const regIndex = rows.findIndex(row => row[0] == id);
    
    if (regIndex === -1) {
      throw new Error('Public tour registration not found');
    }
    
    // Mark as deleted by clearing the row
    const emptyRow = new Array(rows[regIndex].length).fill('');
    await this.updateRow(SHEET_NAMES.PUBLIC_TOUR_REGISTRATIONS, regIndex + 1, emptyRow);
    return { success: true };
  }

  // Analytics
  async getAnalytics() {
    try {
      const [tourRequests, publicTours, publicRegistrations] = await Promise.all([
        this.getAllTourRequests(),
        this.getAllPublicTours(),
        this.getAllPublicTourRegistrations()
      ]);

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      // Calculate stats for tour requests
      const totalRequests = tourRequests.length;
      const pendingRequests = tourRequests.filter(r => r.status === 'pending').length;
      const completedRequests = tourRequests.filter(r => r.status === 'completed').length;
      const scheduledRequests = tourRequests.filter(r => r.status === 'scheduled').length;

      // Calculate monthly stats
      const thisMonthRequests = tourRequests.filter(r => {
        const requestDate = new Date(r.created_at);
        return requestDate.getMonth() === currentMonth && requestDate.getFullYear() === currentYear;
      }).length;

      // Calculate total visitors
      const totalVisitors = tourRequests
        .filter(r => r.status === 'completed' || r.status === 'scheduled')
        .reduce((sum, request) => sum + (parseInt(request.group_size) || 0), 0);

      // Calculate public tour stats
      const activeTours = publicTours.filter(t => t.status === 'active').length;
      const totalPublicRegistrations = publicRegistrations.length;

      return {
        totalRequests,
        pendingRequests, 
        completedRequests,
        scheduledRequests,
        thisMonthRequests,
        totalVisitors,
        activeTours,
        totalPublicRegistrations
      };
    } catch (error) {
      console.error('Error getting analytics:', error);
      throw error;
    }
  }

  // Feedback
  async getAllFeedback() {
    const rows = await this.getSheetData(SHEET_NAMES.FEEDBACK);
    return rows.slice(1)
      .filter(row => row && row[0]) // Filter out empty rows
      .map(row => this.rowToObject(row, SHEET_NAMES.FEEDBACK));
  }

  async addFeedback(data) {
    const feedbackData = {
      id: data.id || `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tour_id: data.tour_id || '',
      tour_type: data.tour_type || '',
      visitor_name: data.visitor_name,
      visitor_email: data.visitor_email,
      tour_date: data.tour_date || '',
      guide_name: data.guide_name || '',
      nps_score: data.nps_score,
      nps_reason: data.nps_reason || '',
      understanding_robotics: data.understanding_robotics,
      impression_changed: data.impression_changed,
      impression_details: data.impression_details || '',
      overall_rating: data.overall_rating,
      what_liked_most: data.what_liked_most || '',
      suggestions_improvement: data.suggestions_improvement || '',
      other_comments: data.other_comments || '',
      submission_date: data.submission_date || new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    const row = this.objectToRow(feedbackData, SHEET_NAMES.FEEDBACK);
    await this.appendToSheet(SHEET_NAMES.FEEDBACK, row);
    return feedbackData;
  }

  async getFeedbackById(id) {
    const rows = await this.getSheetData(SHEET_NAMES.FEEDBACK);
    const feedbackRow = rows.find(row => row[0] === id);
    return feedbackRow ? this.rowToObject(feedbackRow, SHEET_NAMES.FEEDBACK) : null;
  }

  // Helper methods for multiple guides

  /**
   * Parse comma-separated guide IDs into an array
   * @param {string} guideIds - Comma-separated guide IDs (e.g., "guide1,guide2,guide3")
   * @returns {Array<string>} - Array of guide IDs
   */
  parseGuideIds(guideIds) {
    if (!guideIds || guideIds.trim() === '') return [];
    return guideIds.split(',').map(id => id.trim()).filter(id => id);
  }

  /**
   * Get multiple tour guides by their IDs
   * @param {string} guideIds - Comma-separated guide IDs
   * @returns {Promise<Array>} - Array of guide objects
   */
  async getMultipleTourGuides(guideIds) {
    const ids = this.parseGuideIds(guideIds);
    if (ids.length === 0) return [];

    const allGuides = await this.getAllTourGuides();
    return ids.map(id => allGuides.find(g => g.id === id)).filter(g => g);
  }

  /**
   * Format multiple guide names for display
   * @param {Array} guides - Array of guide objects
   * @returns {string} - Formatted guide names (e.g., "Jane Doe and John Smith" or "Jane Doe, John Smith, and Mike Lee")
   */
  formatGuideNames(guides) {
    if (!guides || guides.length === 0) return 'No guide assigned';
    if (guides.length === 1) return guides[0].name;
    if (guides.length === 2) return `${guides[0].name} and ${guides[1].name}`;

    const allButLast = guides.slice(0, -1).map(g => g.name).join(', ');
    return `${allButLast}, and ${guides[guides.length - 1].name}`;
  }

  /**
   * Detect which guide IDs are new compared to existing assignments
   * @param {string} currentGuideIds - Current comma-separated guide IDs
   * @param {string} newGuideIds - New comma-separated guide IDs
   * @returns {Array<string>} - Array of new guide IDs
   */
  getNewGuideIds(currentGuideIds, newGuideIds) {
    const currentIds = this.parseGuideIds(currentGuideIds);
    const newIds = this.parseGuideIds(newGuideIds);

    return newIds.filter(id => !currentIds.includes(id));
  }

  // Email Log
  // Columns: timestamp | tour_type | tour_id | recipient | email_type | tour_date

  /**
   * Create the Email Log sheet with a header row if it doesn't exist yet
   */
  async ensureEmailLogSheet() {
    if (this._emailLogEnsured) return;

    try {
      await this.sheets.spreadsheets.values.get({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAMES.EMAIL_LOG}!A1:F1`,
      });
      this._emailLogEnsured = true;
    } catch (error) {
      try {
        await this.sheets.spreadsheets.batchUpdate({
          spreadsheetId: SPREADSHEET_ID,
          resource: {
            requests: [{ addSheet: { properties: { title: SHEET_NAMES.EMAIL_LOG } } }]
          }
        });
        await this.appendToSheet(SHEET_NAMES.EMAIL_LOG, ['timestamp', 'tour_type', 'tour_id', 'recipient', 'email_type', 'tour_date']);
        this._emailLogEnsured = true;
      } catch (createError) {
        // Another concurrent invocation may have created it first
        if (createError.message && createError.message.includes('already exists')) {
          this._emailLogEnsured = true;
        } else {
          throw createError;
        }
      }
    }
  }

  /**
   * Record a sent email in the Email Log sheet
   * @param {Object} entry - {tour_type, tour_id, recipient, email_type, tour_date}
   */
  async logEmail(entry) {
    await this.ensureEmailLogSheet();
    await this.appendToSheet(SHEET_NAMES.EMAIL_LOG, [
      new Date().toISOString(),
      entry.tour_type || '',
      entry.tour_id !== undefined && entry.tour_id !== null ? String(entry.tour_id) : '',
      entry.recipient || '',
      entry.email_type || '',
      entry.tour_date || ''
    ]);
  }

  /**
   * Get all email log entries
   * @returns {Promise<Array>} - [{timestamp, tour_type, tour_id, recipient, email_type, tour_date}]
   */
  async getEmailLog() {
    try {
      const rows = await this.getSheetData(SHEET_NAMES.EMAIL_LOG);
      return rows.slice(1).map(row => ({
        timestamp: row[0] || '',
        tour_type: row[1] || '',
        tour_id: row[2] || '',
        recipient: row[3] || '',
        email_type: row[4] || '',
        tour_date: row[5] || ''
      }));
    } catch (error) {
      // A missing sheet just means no emails have been logged yet; any other
      // failure must surface, otherwise the cron jobs would treat an empty
      // log as "nothing sent" and double-send everything
      if (error.message && error.message.includes('Unable to parse range')) {
        return [];
      }
      throw error;
    }
  }
}

module.exports = DataRepository;
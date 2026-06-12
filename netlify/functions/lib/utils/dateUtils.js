/**
 * Date and time utility functions for the tours application
 * Centralizes all date/time formatting and parsing logic
 */

/**
 * Formats time from 24-hour format to 12-hour format with AM/PM
 * @param {string} timeStr - Time string in 24-hour format (e.g., "14:30")
 * @returns {string} Time string in 12-hour format (e.g., "2:30 PM")
 */
function formatTimeDisplay(timeStr) {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  
  try {
    const [hour, minute] = timeStr.split(':');
    const hour24 = parseInt(hour);
    const period = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
    return `${hour12}:${minute} ${period}`;
  } catch (error) {
    console.error('Error formatting time:', error, timeStr);
    return timeStr;
  }
}

/**
 * Formats date and time for email templates
 * @param {string} dateStr - Date string in various formats
 * @param {string} timeStr - Time string in 24-hour or 12-hour format
 * @returns {Object} Object with formatted dateStr and timeStr
 */
function formatTourDate(dateStr, timeStr) {
  try {
    // Handle various date formats more safely
    let tourDate;
    if (dateStr && timeStr) {
      // Ensure we have a proper ISO date string
      const cleanDate = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
      
      // Handle both 24-hour format (14:00) and 12-hour format (12:00 PM)
      let cleanTime;
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        // Already in 12-hour format, convert to 24-hour for Date parsing
        const [time, period] = timeStr.split(' ');
        const [hours, minutes] = time.split(':');
        let hour24 = parseInt(hours);
        
        if (period === 'PM' && hour24 !== 12) {
          hour24 += 12;
        } else if (period === 'AM' && hour24 === 12) {
          hour24 = 0;
        }
        
        cleanTime = `${hour24.toString().padStart(2, '0')}:${minutes || '00'}`;
      } else if (timeStr.includes(':')) {
        // Already in 24-hour format
        cleanTime = timeStr;
      } else {
        cleanTime = '14:00';
      }
      
      tourDate = new Date(`${cleanDate}T${cleanTime}:00`);
    } else if (dateStr) {
      tourDate = new Date(dateStr);
    } else {
      return { dateStr: 'TBD', timeStr: 'TBD' };
    }
    
    // Check if date is valid
    if (isNaN(tourDate.getTime())) {
      return { dateStr: 'TBD', timeStr: 'TBD' };
    }
    
    const formattedDate = tourDate.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Always format time as 12-hour for emails (user-friendly display)
    const formattedTime = tourDate.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
    
    return { dateStr: formattedDate, timeStr: formattedTime };
  } catch (error) {
    console.error('Date formatting error:', error, { dateStr, timeStr });
    return { dateStr: 'TBD', timeStr: 'TBD' };
  }
}

/**
 * Parses a date string to avoid timezone issues
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Date} Date object with proper timezone handling
 */
function parseDate(dateStr) {
  try {
    const [year, month, day] = dateStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  } catch (error) {
    console.error('Error parsing date:', error, dateStr);
    return new Date();
  }
}

/**
 * Formats a date for display in long format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string (e.g., "Friday, June 18, 2025")
 */
function formatDateLong(dateStr) {
  try {
    const date = parseDate(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    console.error('Error formatting date:', error, dateStr);
    return dateStr;
  }
}

/**
 * Creates calendar-compatible date strings for Google Calendar
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} timeStr - Time string in 24-hour format
 * @param {number} durationHours - Duration in hours (default: 1)
 * @returns {Object} Object with start and end date strings for calendar
 */
function createCalendarDates(dateStr, timeStr, durationHours = 1) {
  try {
    const [datePart] = dateStr.split('T');
    const timePart = timeStr || '14:00';
    const [hours, minutes] = timePart.split(':');
    const hour24 = parseInt(hours);
    const endHour = hour24 + durationHours;
    
    // Format in America/Detroit timezone for Google Calendar
    const startDateTime = `${datePart}T${hours.padStart(2, '0')}:${minutes}:00`;
    const endDateTime = `${datePart}T${endHour.toString().padStart(2, '0')}:${minutes}:00`;
    
    return {
      start: startDateTime,
      end: endDateTime
    };
  } catch (error) {
    console.error('Error creating calendar dates:', error, { dateStr, timeStr });
    return {
      start: `${dateStr}T14:00:00`,
      end: `${dateStr}T15:00:00`
    };
  }
}

module.exports = {
  formatTimeDisplay,
  formatTourDate,
  parseDate,
  formatDateLong,
  createCalendarDates
};
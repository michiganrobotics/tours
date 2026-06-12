const { formatTourDate, formatTimeDisplay } = require('./utils/dateUtils');
const { TSHIRT, UNIVERSITY, SOCIAL_MEDIA, URLS, EMAIL_ADDRESSES } = require('./utils/constants');

function getSizeFullName(size) {
  return TSHIRT.SIZES[size.toUpperCase()] || size.toUpperCase();
}

// Common email styles and responsive logo
function getEmailStyles() {
  return `
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Open+Sans:wght@400;600&display=swap" rel="stylesheet">
    <style>
      .email-logo {
        max-width: 100%;
        height: auto;
        width: auto;
        max-height: 50px;
      }
      @media only screen and (max-width: 600px) {
        .email-logo {
          max-height: 40px;
        }
        .email-header {
          padding: 20px !important;
        }
        .email-content {
          padding: 20px !important;
        }
        .email-header h1 {
          font-size: 24px !important;
        }
      }
    </style>
  `;
}

function getHeaderFont() {
  return "font-family: 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;";
}

function getBodyFont() {
  return "font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, sans-serif;";
}

// Escape user-supplied values before interpolating into HTML emails
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Helper function to format multiple guide names
function formatMultipleGuideNames(guides) {
  if (!guides || guides.length === 0) return 'No guide assigned';
  if (guides.length === 1) return guides[0].name;
  if (guides.length === 2) return `${guides[0].name} and ${guides[1].name}`;

  const allButLast = guides.slice(0, -1).map(g => g.name).join(', ');
  return `${allButLast}, and ${guides[guides.length - 1].name}`;
}


function generateVisitorScheduledEmail(request, guide, calendarLink) {
  const { dateStr, timeStr } = formatTourDate(request.preferred_date, request.preferred_time);

  // Handle both single guide and array of guides
  const guides = Array.isArray(guide) ? guide : (guide ? [guide] : []);
  const guideNames = guides.length > 0 ? formatMultipleGuideNames(guides) : 'Guide will be assigned soon';
  const guideLabel = guides.length > 1 ? 'Your Tour Guides:' : 'Your Tour Guide:';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Michigan Robotics Tour Scheduled</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 50%, #702F8A 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="height: 50px; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; color: white; ${getHeaderFont()}">Your Tour is Scheduled!</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffcb05; ${getBodyFont()}">University of Michigan Ford Robotics Building</p>
      </div>

      <div class="email-content" style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(request.visitor_name)},</p>

        <p style="${getBodyFont()}">Great news! Your robotics building tour has been scheduled. We're excited to show you our state-of-the-art facilities and cutting-edge research.</p>

        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0; ${getHeaderFont()}">📅 Tour Details</h3>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0; ${getBodyFont()}">
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Duration:</strong> Approximately 45 minutes</li>
            <li><strong>Location:</strong> Meet at the main staircase in the atrium of the Ford Robotics Building<br>2505 Hayward St, Ann Arbor, MI 48109</li>
            <li><strong>${guideLabel}</strong> ${escapeHtml(guideNames)}</li>
          </ul>
          ${calendarLink ? `
          <div style="text-align: center; margin-top: 15px;">
            <a href="${calendarLink}" style="background: #00274C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">📅 Add to Calendar</a>
          </div>
          ` : ''}
        </div>
        
        ${(request.tshirt_request === 'on' || request.tshirt_request === true || request.tshirt_request === 'TRUE' || request.tshirt_request === 'true') && (parseInt(request.tshirt_total) || 0) > 0 ? `
        <div style="background-color: #E6F3FF; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2F65A7;">
          <h3 style="color: #2F65A7; margin-top: 0; ${getHeaderFont()}">👕 T-Shirt Pre-Order</h3>
          <p style="color: #555; margin: 10px 0; ${getBodyFont()}">You've pre-ordered <strong>${escapeHtml(request.tshirt_total)} t-shirt${request.tshirt_total > 1 ? 's' : ''}</strong> for <strong>$${escapeHtml(request.tshirt_cost)}</strong>:</p>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0; ${getBodyFont()}">
            ${Object.entries(request.tshirt_sizes || {})
              .filter(([size, qty]) => qty > 0)
              .map(([size, qty]) => `<li><strong>${escapeHtml(getSizeFullName(size))}:</strong> ${escapeHtml(qty)} shirt${qty > 1 ? 's' : ''}</li>`)
              .join('')}
          </ul>
          <p style="color: #666; font-size: 14px; margin: 15px 0 0 0; ${getBodyFont()}"><strong>Payment:</strong> If in stock, your tour guide will have your shirts ready and you can pay with credit card after the tour.</p>
          <p style="color: #666; font-size: 14px; margin: 10px 0 0 0; ${getBodyFont()}">Want more gear? <a href="https://www.aatwebstore.com/UMBOT/shop/home" target="_blank" style="color: #2F65A7; text-decoration: underline;">Shop our online store</a> for additional robotics merchandise.</p>
        </div>
        ` : ''}
        
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">📍 Getting Here</h3>
          <p style="color: #666; margin-bottom: 10px;"><strong>Address:</strong> 2505 Hayward St, Ann Arbor, MI 48109</p>
          <p style="color: #666; margin-bottom: 10px;"><strong>Parking:</strong> <a href="https://www.google.com/maps/place/NC26+Parking+Lot,+Ann+Arbor,+MI+48109/@42.2939623,-83.7086283,15z/">Lot NC-26</a> is paid visitor parking at $2.40/hour.</p>
          <p style="color: #666; margin: 0;"><strong>Entry:</strong> Please enter through the main atrium entrance and meet the group at the main staircase.</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">⏰ Reminders</h3>
          <ul style="color: #856404; padding-left: 20px; margin: 0;">
            <li>Your tour guide will arrive at the specified time -- sometimes coming from class</li>
            <li>Please respect the focus and concentration of our researchers in the labs</li>
          </ul>
        </div>
        
        <p>If you need to reschedule or have any questions, please contact us at <a href="mailto:robotics-tours@umich.edu" style="color: #00274C;">robotics-tours@umich.edu</a> or reply to this email.</p>
        
        <p>We look forward to seeing you soon!</p>
        
        <p style="margin-bottom: 0;">Best regards,<br>
        <strong>Michigan Robotics</strong><br>
        University of Michigan</p>
      </div>
      
      <div style="background: #00274C; color: white; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
        <p style="margin: 0;">
          <a href="https://www.x.com/umrobotics" style="color: #ffffff; text-decoration: underline;">X</a> | 
          <a href="https://www.instagram.com/umrobotics/" style="color: #ffffff; text-decoration: underline;">Instagram</a> | 
          <a href="https://www.youtube.com/channel/UC-WH2n-SkB166pUq5o5ULUg" style="color: #ffffff; text-decoration: underline;">YouTube</a> | 
          <a href="https://www.linkedin.com/company/university-of-michigan-robotics/" style="color: #ffffff; text-decoration: underline;">LinkedIn</a>
        </p>
        <p style="font-size: 12px; margin-top: 10px;">University of Michigan Robotics Department<br>2505 Hayward St<br>Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generateGuideScheduledEmail(request, guide, calendarLink) {
  const { dateStr, timeStr } = formatTourDate(request.preferred_date, request.preferred_time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tour Guide Assignment</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #2563eb 0%, #64748b 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white;">Tour Guide Assignment</h1>
      </div>
      
      <div style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>
        
        <p>You've been assigned to guide a tour of the Ford Robotics building. Here are the details:</p>
        
        <div style="background-color: #F0F8FF; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #A0C4E0;">
          <h3 style="color: #00274C; margin-top: 0;">Tour Assignment</h3>
          <ul style="color: #555; padding-left: 20px;">
            <li><strong>Visitor:</strong> ${escapeHtml(request.visitor_name)}</li>
            <li><strong>Email:</strong> ${escapeHtml(request.visitor_email)}</li>
            ${request.visitor_phone ? `<li><strong>Phone:</strong> ${escapeHtml(request.visitor_phone)}</li>` : ''}
            <li><strong>Group Size:</strong> ${escapeHtml(request.group_size)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
          </ul>
          ${request.additional_info ? `<p style="color: #555; margin-top: 15px;"><strong>Additional Information:</strong><br>${escapeHtml(request.additional_info)}</p>` : ''}
          ${calendarLink ? `
          <div style="text-align: center; margin-top: 15px;">
            <a href="${calendarLink}" style="background: #00274C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">📅 Add to Calendar</a>
          </div>
          ` : ''}
        </div>
        
        ${(request.tshirt_request === 'on' || request.tshirt_request === true || request.tshirt_request === 'TRUE' || request.tshirt_request === 'true') && (parseInt(request.tshirt_total) || 0) > 0 ? `
        <div style="background-color: #FFF8E7; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #D86018;">
          <h3 style="color: #D86018; margin-top: 0;">👕 T-Shirt Pre-Order for Guest</h3>
          <p style="color: #555; margin: 10px 0;">The visitor has pre-ordered <strong>${escapeHtml(request.tshirt_total)} t-shirt${request.tshirt_total > 1 ? 's' : ''}</strong> for <strong>$${escapeHtml(request.tshirt_cost)}</strong>:</p>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
            ${Object.entries(request.tshirt_sizes || {})
              .filter(([size, qty]) => qty > 0)
              .map(([size, qty]) => `<li><strong>${escapeHtml(getSizeFullName(size))}:</strong> ${escapeHtml(qty)} shirt${qty > 1 ? 's' : ''}</li>`)
              .join('')}
          </ul>
          <p style="color: #856404; font-size: 14px; margin: 15px 0 0 0;"><strong>Action Required:</strong> Please bring these shirts to the tour and collect payment via credit card after the tour.</p>
        </div>
        ` : ''}
        
        
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <p style="color: #666; margin: 0;"><strong>Note:</strong> The visitor has been notified. If you need to make any changes, please contact the tours team immediately.</p>
        </div>
        
        <p>Thank you for volunteering as a tour guide!</p>
        
        <p style="margin-bottom: 0;">Best regards,<br>
        <strong>Michigan Robotics</strong></p>
      </div>
      
      <div style="background: #00274C; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="margin: 0;">
          <a href="https://www.x.com/umrobotics" style="color: #ffffff; text-decoration: underline;">X</a> | 
          <a href="https://www.instagram.com/umrobotics/" style="color: #ffffff; text-decoration: underline;">Instagram</a> | 
          <a href="https://www.youtube.com/channel/UC-WH2n-SkB166pUq5o5ULUg" style="color: #ffffff; text-decoration: underline;">YouTube</a> | 
          <a href="https://www.linkedin.com/company/university-of-michigan-robotics/" style="color: #ffffff; text-decoration: underline;">LinkedIn</a>
        </p>
        <p style="font-size: 12px; margin-top: 10px;">University of Michigan Robotics Department<br>2505 Hayward St<br>Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generatePublicTourGuideEmail(tour, guide, calendarLink) {
  // Parse the date properly to avoid timezone issues
  const [year, month, day] = tour.date.split('-');
  const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  
  const dateStr = tourDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  // Format time to AM/PM
  const { timeStr } = formatTourDate(tour.date, tour.time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Public Tour Guide Assignment</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #2563eb 0%, #64748b 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white;">Public Tour Assignment</h1>
      </div>
      
      <div style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>
        
        <p>You have been assigned to lead a public tour of the Ford Robotics Building. Here are the details:</p>
        
        <div style="background-color: #F8F9FA; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0; margin-bottom: 10px;">📅 Tour Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Title:</strong> ${escapeHtml(tour.title)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Type:</strong> ${tour.type}</li>
            <li><strong>Capacity:</strong> ${tour.capacity} people</li>
            <li><strong>Current Registrations:</strong> ${tour.registrations?.length || 0}</li>
          </ul>
          ${calendarLink ? `
          <div style="text-align: center; margin-top: 15px;">
            <a href="${calendarLink}" style="background: #00274C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">📅 Add to Calendar</a>
          </div>
          ` : ''}
        </div>

        ${tour.notes ? `
        <div style="background-color: #FFF7E6; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #FFCB05;">
          <h4 style="color: #A99967; margin-top: 0; margin-bottom: 10px;">📝 Tour Notes</h4>
          <p style="margin: 0; color: #666;">${escapeHtml(tour.notes)}</p>
        </div>
        ` : ''}
        
        <div style="margin: 20px 0;">
          <h4 style="color: #00274C;">Important Reminders:</h4>
          <ul style="color: #555;">
            <li>Please arrive on time</li>
            <li>Meet visitors at the main staircase in the atrium</li>
            <li>Tours typically last 45-60 minutes</li>
            <li>Check the dashboard for any last-minute registrations</li>
          </ul>
        </div>

        
        <p>If you have any questions or need to make changes, please contact the tour coordination team.</p>
        
        <p style="margin-bottom: 0;">Thanks for being part of our tour guide team!</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Michigan Robotics<br>
        University of Michigan<br>
        2505 Hayward St, Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generateVisitorReminderEmail(request, guide) {
  const { dateStr, timeStr } = formatTourDate(request.preferred_date, request.preferred_time);

  // Handle both single guide and array of guides
  const guides = Array.isArray(guide) ? guide : (guide ? [guide] : []);
  const guideNames = guides.length > 0 ? formatMultipleGuideNames(guides) : 'TBD';
  const guideLabel = guides.length > 1 ? 'Your Tour Guides:' : 'Your Tour Guide:';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tour Reminder - Tomorrow</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 50%, #702F8A 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="height: 50px; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; color: white; ${getHeaderFont()}">Tour Reminder</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffcb05; ${getBodyFont()}">Your tour is tomorrow!</p>
      </div>

      <div class="email-content" style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(request.visitor_name)},</p>

        <p>Just a friendly reminder that your University of Michigan Ford Robotics Building tour is scheduled for <strong>tomorrow</strong>! We're excited to see you and show you our amazing facilities.</p>

        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0;">📅 Tour Details</h3>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Duration:</strong> Approximately 45 minutes</li>
            <li><strong>Location:</strong> Meet at the main staircase in the atrium of the Ford Robotics Building<br>2505 Hayward St, Ann Arbor, MI 48109</li>
            <li><strong>${guideLabel}</strong> ${escapeHtml(guideNames)}</li>
          </ul>
        </div>
        
        <div style="background-color: #E6F3FF; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2F65A7;">
          <h3 style="color: #2F65A7; margin-top: 0;">🚗 Getting Here</h3>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
            <li><strong>Parking:</strong> $2.40/hour in <a href="https://www.google.com/maps/place/NC26+Parking+Lot,+Ann+Arbor,+MI+48109/@42.2939623,-83.7086283,15z" target="_blank" style="color: #2F65A7;">NC26 parking lot</a></li>
            <li><strong>Public Transit:</strong> Blue Bus and AATA routes stop nearby</li>
            <li><strong>Address:</strong> 2505 Hayward St, Ann Arbor, MI 48109</li>
            <li><strong>Building:</strong> Ford Motor Company Robotics Building</li>
          </ul>
        </div>

        ${(request.tshirt_request === 'on' || request.tshirt_request === true || request.tshirt_request === 'TRUE' || request.tshirt_request === 'true') && (parseInt(request.tshirt_total) || 0) > 0 ? `
        <div style="background-color: #FFF7E6; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #FFCB05;">
          <h3 style="color: #A99967; margin-top: 0;">👕 T-Shirt Reminder</h3>
          <p style="color: #555; margin: 10px 0;">Don't forget to bring credit card payment for your t-shirts: <strong>${escapeHtml(request.tshirt_total)} shirt${request.tshirt_total > 1 ? 's' : ''}</strong> for <strong>$${escapeHtml(request.tshirt_cost)}</strong></p>
          <p style="color: #555; margin: 10px 0; font-size: 14px;"><em>We accept cash or card payment</em></p>
          <p style="color: #555; margin: 10px 0; font-size: 14px;">Want more gear? <a href="https://www.aatwebstore.com/UMBOT/shop/home" target="_blank" style="color: #A99967; text-decoration: underline;">Shop our online store</a> for additional robotics merchandise.</p>
        </div>
        ` : ''}
        
        <div style="margin: 20px 0;">
          <h4 style="color: #00274C;">What to Expect:</h4>
          <ul style="color: #555;">
            <li>Tour of our state-of-the-art research laboratories</li>
            <li>See cutting-edge robotics projects in action</li>
            <li>Learn about our academic programs and research opportunities</li>
            <li>Q&A session with your knowledgeable tour guide</li>
          </ul>
        </div>
        
        <p>If you need to cancel or reschedule, please contact us as soon as possible.</p>
        
        <p style="margin-bottom: 0;">We can't wait to see you tomorrow!</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Michigan Robotics<br>
        University of Michigan<br>
        2505 Hayward St, Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generateGuideReminderEmail(request, guide) {
  const { dateStr, timeStr } = formatTourDate(request.preferred_date, request.preferred_time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tour Guide Reminder - Tomorrow</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #2563eb 0%, #64748b 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white; ${getHeaderFont()}">Tour Guide Reminder</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">You're guiding a tour tomorrow!</p>
      </div>
      
      <div class="email-content" style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>
        
        <p>This is a friendly reminder that you're scheduled to guide a tour <strong>tomorrow</strong>. Here are the details:</p>
        
        <div style="background-color: #F8F9FA; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0; margin-bottom: 10px;">📅 Tour Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Visitor:</strong> ${escapeHtml(request.visitor_name)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Group Size:</strong> ${escapeHtml(request.group_size)} people</li>
            <li><strong>Contact:</strong> ${escapeHtml(request.visitor_email)}${request.visitor_phone ? ` | ${escapeHtml(request.visitor_phone)}` : ''}</li>
          </ul>
        </div>

        ${request.additional_info ? `
        <div style="background-color: #FFF7E6; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #FFCB05;">
          <h4 style="color: #A99967; margin-top: 0; margin-bottom: 10px;">📝 Visitor Notes</h4>
          <p style="margin: 0; color: #666;">${escapeHtml(request.additional_info)}</p>
        </div>
        ` : ''}
        
        <div style="margin: 20px 0;">
          <h4 style="color: #00274C;">Pre-Tour Checklist:</h4>
          <ul style="color: #555;">
            <li>Arrive on time</li>
            <li>Meet visitors at the main staircase in the atrium</li>
            <li>Bring your mcard</li>
            <li>Review tour route and current lab activities</li>
            <li>Check for any lab closures or special restrictions</li>
          </ul>
        </div>

        ${(request.tshirt_request === 'on' || request.tshirt_request === true || request.tshirt_request === 'TRUE' || request.tshirt_request === 'true') && (parseInt(request.tshirt_total) || 0) > 0 ? `
        <div style="background-color: #E6F3FF; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #2F65A7;">
          <h4 style="color: #2F65A7; margin-top: 0; margin-bottom: 10px;">👕 T-Shirt Orders</h4>
          <p style="margin: 0; color: #666;">Visitor has requested ${escapeHtml(request.tshirt_total)} t-shirt${request.tshirt_total > 1 ? 's' : ''} - coordinate with admin for pickup/payment</p>
        </div>
        ` : ''}
        
        <p>If you have any questions or need to make last-minute changes, please contact the tour coordination team immediately.</p>
        
        <p style="margin-bottom: 0;">Thanks for being an awesome tour guide!</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Michigan Robotics<br>
        University of Michigan<br>
        2505 Hayward St, Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generatePublicTourReminderEmail(tour, guide, registrations) {
  const { dateStr, timeStr } = formatTourDate(tour.date, tour.time);
  
  // Calculate total guests (sum of group sizes)
  const totalGuests = registrations.reduce((total, reg) => total + (parseInt(reg.group_size) || 1), 0);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Public Tour Guide Reminder - Tomorrow</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" style="height: 50px; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white;">Public Tour Reminder</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px;">You're guiding a public tour tomorrow!</p>
      </div>
      
      <div style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>
        
        <p>This is a friendly reminder that you're scheduled to guide a public tour <strong>tomorrow</strong>. Here are the updated details:</p>
        
        <div style="background-color: #F8F9FA; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0; margin-bottom: 10px;">📅 Tour Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Title:</strong> ${escapeHtml(tour.title)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Type:</strong> ${tour.type}</li>
            <li><strong>Capacity:</strong> ${tour.capacity} people</li>
            <li><strong>Registrations:</strong> ${registrations.length} (${totalGuests} total guests)</li>
          </ul>
        </div>

        ${tour.notes ? `
        <div style="background-color: #FFF7E6; padding: 15px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #FFCB05;">
          <h4 style="color: #A99967; margin-top: 0; margin-bottom: 10px;">📝 Tour Notes</h4>
          <p style="margin: 0; color: #666;">${escapeHtml(tour.notes)}</p>
        </div>
        ` : ''}
        
        <div style="margin: 20px 0;">
          <h4 style="color: #00274C;">Pre-Tour Checklist:</h4>
          <ul style="color: #555;">
            <li>Arrive on time</li>
            <li>Meet participants at the main staircase in the atrium</li>
            <li>Bring your mcard</li>
            <li>Review tour route and current lab activities</li>
            <li>Check dashboard for any last-minute registrations</li>
          </ul>
        </div>
        
        
        <p>If you have any questions or need to make last-minute changes, please contact the tour coordination team immediately.</p>
        
        <p style="margin-bottom: 0;">Thanks for being part of our tour guide team!</p>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Michigan Robotics<br>
        University of Michigan<br>
        2505 Hayward St, Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generatePublicTourConfirmationEmail(registration, tour, calendarLink = null) {
  const { dateStr, timeStr } = formatTourDate(tour.date, tour.time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Robotics tour registration confirmed</title>
      ${getEmailStyles()}
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 50%, #702F8A 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="height: 50px; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; color: white;">Tour registration confirmed!</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffcb05;">University of Michigan Ford Robotics Building Tour</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(registration.name)},</p>
        
        <p>Thank you for registering for our public tour! We're excited to welcome you to the University of Michigan Ford Robotics Building and show you our cutting-edge facilities and research.</p>
        
        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0;">📅 Tour Details</h3>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
            <li><strong>Tour:</strong> ${escapeHtml(tour.title)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Duration:</strong> Approximately 45 minutes</li>
            <li><strong>Group Size:</strong> ${escapeHtml(registration.group_size)} ${registration.group_size == 1 ? 'person' : 'people'}</li>
            <li><strong>Location:</strong> Meet at the main staircase in the atrium of the Ford Robotics Building<br>2505 Hayward St, Ann Arbor, MI 48109</li>
          </ul>
          ${calendarLink ? `
          <div style="text-align: center; margin-top: 15px;">
            <a href="${calendarLink}" style="background: #00274C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">📅 Add to Calendar</a>
          </div>
          ` : ''}
        </div>
        
        ${(registration.tshirt_request === 'on' || registration.tshirt_request === true || registration.tshirt_request === 'TRUE' || registration.tshirt_request === 'true') && (parseInt(registration.tshirt_total) || 0) > 0 ? `
        <div style="background-color: #E6F3FF; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2F65A7;">
          <h3 style="color: #2F65A7; margin-top: 0;">👕 T-Shirt Pre-Order</h3>
          <p style="color: #555; margin: 10px 0;">You've pre-ordered <strong>${escapeHtml(registration.tshirt_total)} t-shirt${registration.tshirt_total > 1 ? 's' : ''}</strong> for <strong>$${escapeHtml(registration.tshirt_cost)}</strong>:</p>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
            ${Object.entries(registration.tshirt_sizes || {})
              .filter(([size, qty]) => qty > 0)
              .map(([size, qty]) => `<li><strong>${escapeHtml(getSizeFullName(size))}:</strong> ${escapeHtml(qty)} shirt${qty > 1 ? 's' : ''}</li>`)
              .join('')}
          </ul>
          <p style="color: #666; font-size: 14px; margin: 15px 0 0 0;"><strong>Payment:</strong> If in stock, your tour guide will have your shirts ready and you can pay with credit card after the tour.</p>
          <p style="color: #666; font-size: 14px; margin: 10px 0 0 0;">Want more gear? <a href="https://www.aatwebstore.com/UMBOT/shop/home" target="_blank" style="color: #2F65A7; text-decoration: underline;">Shop our online store</a> for additional robotics merchandise.</p>
        </div>
        ` : ''}
        
        ${registration.newsletter_signup ? `
        <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
          <h3 style="color: #155724; margin-top: 0; ${getHeaderFont()}">📧 Newsletter Signup</h3>
          <p style="color: #155724; margin: 0; ${getBodyFont()}">Thank you for signing up for our quarterly robotics newsletter! You'll receive updates on research breakthroughs, events, and student achievements.</p>
          <p style="color: #155724; margin: 10px 0 0 0; ${getBodyFont()}">Don't want to wait for the next one? <a href="https://umrobotics.substack.com/" target="_blank" style="color: #155724; text-decoration: underline;">Start reading right away</a>.</p>
        </div>
        ` : ''}
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">📍 Getting Here</h3>
          <p style="color: #666; margin-bottom: 10px;"><strong>Address:</strong> 2505 Hayward St, Ann Arbor, MI 48109</p>
          <p style="color: #666; margin-bottom: 10px;"><strong>Parking:</strong> <a href="https://www.google.com/maps/place/NC26+Parking+Lot,+Ann+Arbor,+MI+48109/@42.2939623,-83.7086283,15z/" style="color: #00274C;">Lot NC-26</a> is paid visitor parking at $2.40/hour.</p>
          <p style="color: #666; margin: 0;"><strong>Entry:</strong> Please enter through the main atrium entrance and meet the group at the main staircase.</p>
        </div>
        
        <div style="background-color: #fff3cd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #856404; margin-top: 0;">💡 What to Expect</h3>
          <ul style="color: #856404; padding-left: 20px; margin: 0;">
            <li>Overview of current research projects</li>
            <li>Visit to robotics labs and makerspace</li>
            <li>Robotics demonstrations (when available)</li>
            <li>Time for Q&A with our expert guides</li>
          </ul>
        </div>
        
        <p>If you need to cancel or have any questions, please contact us at <a href="mailto:robotics-tours@umich.edu" style="color: #00274C;">robotics-tours@umich.edu</a> or reply to this email.</p>
        
        <p>We look forward to seeing you at the tour!</p>
        
        <p style="margin-bottom: 0;">Best regards,<br>
        <strong>Michigan Robotics</strong><br>
        University of Michigan</p>
      </div>
      
      <div style="background: #00274C; color: white; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
        <p style="margin: 0;">
          <a href="https://www.x.com/umrobotics" style="color: #ffffff; text-decoration: underline;">X</a> | 
          <a href="https://www.instagram.com/umrobotics/" style="color: #ffffff; text-decoration: underline;">Instagram</a> | 
          <a href="https://www.youtube.com/channel/UC-WH2n-SkB166pUq5o5ULUg" style="color: #ffffff; text-decoration: underline;">YouTube</a> | 
          <a href="https://www.linkedin.com/company/university-of-michigan-robotics/" style="color: #ffffff; text-decoration: underline;">LinkedIn</a>
        </p>
        <p style="font-size: 12px; margin-top: 10px;">University of Michigan Robotics Department<br>2505 Hayward St<br>Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generateTourRequestConfirmationEmail(data) {
  // Generate t-shirt summary from structured data
  let tshirtSummary = '';
  if ((data.tshirt_request === 'on' || data.tshirt_request === true || data.tshirt_request === 'TRUE' || data.tshirt_request === 'true') && data.tshirt_sizes && (parseInt(data.tshirt_total) || 0) > 0) {
    const sizeEntries = Object.entries(data.tshirt_sizes)
      .filter(([size, qty]) => qty > 0)
      .map(([size, qty]) => `${getSizeFullName(size)}: ${qty} shirt${qty > 1 ? 's' : ''}`)
      .join(', ');
    tshirtSummary = `${data.tshirt_total} t-shirt${data.tshirt_total > 1 ? 's' : ''} (${sizeEntries}) - $${data.tshirt_cost}`;
  }

  const tshirtSection = (data.tshirt_request === 'on' || data.tshirt_request === true || data.tshirt_request === 'TRUE' || data.tshirt_request === 'true') && tshirtSummary ? `
    <div style="background-color: #E6F3FF; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2F65A7;">
      <h3 style="color: #2F65A7; margin-top: 0; ${getHeaderFont()}">👕 T-Shirts Requested</h3>
      <p style="color: #555; margin: 10px 0; ${getBodyFont()}">You've requested <strong>${escapeHtml(data.tshirt_total)} t-shirt${data.tshirt_total > 1 ? 's' : ''}</strong> for <strong>$${escapeHtml(data.tshirt_cost)}</strong>:</p>
      <ul style="color: #555; padding-left: 20px; margin: 10px 0; ${getBodyFont()}">
        ${Object.entries(data.tshirt_sizes || {})
          .filter(([size, qty]) => qty > 0)
          .map(([size, qty]) => `<li><strong>${escapeHtml(getSizeFullName(size))}:</strong> ${escapeHtml(qty)} shirt${qty > 1 ? 's' : ''}</li>`)
          .join('')}
      </ul>
      <p style="color: #666; font-size: 14px; margin: 15px 0 0 0; ${getBodyFont()}"><strong>Payment:</strong> If in stock, your tour guide will have your shirts ready and you can pay with credit card after the tour.</p>
      <p style="color: #666; font-size: 14px; margin: 10px 0 0 0; ${getBodyFont()}">Want more gear? <a href="https://www.aatwebstore.com/UMBOT/shop/home" target="_blank" style="color: #2F65A7; text-decoration: underline;">Shop our online store</a> for additional robotics merchandise.</p>
    </div>
  ` : '';

  const newsletterSection = (data.newsletter_signup === 'on' || data.newsletter_signup === true) ? `
    <div style="background-color: #e8f5e8; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745;">
      <h3 style="color: #155724; margin-top: 0; ${getHeaderFont()}">📧 Newsletter Signup</h3>
      <p style="color: #155724; margin: 0; ${getBodyFont()}">Thank you for signing up for our quarterly robotics newsletter! You'll receive updates on research breakthroughs, events, and student achievements.</p>
      <p style="color: #155724; margin: 10px 0 0 0; ${getBodyFont()}">Don't want to wait for the next one? <a href="https://umrobotics.substack.com/" target="_blank" style="color: #155724; text-decoration: underline;">Start reading right away</a>.</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tour Request Received</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 50%, #702F8A 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="height: 50px; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; color: white; ${getHeaderFont()}">Tour request received</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffcb05; ${getBodyFont()}">University of Michigan Ford Robotics Building</p>
      </div>
      
      <div class="email-content" style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(data.visitor_name)},</p>
        
        <p style="${getBodyFont()}">Thank you for your interest in touring the University of Michigan Ford Robotics Building! We've received your request and will be in touch soon if we are able to schedule your visit.</p>
        
        <div style="background-color: #f0f4f8; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0; ${getHeaderFont()}">📋 Request Summary</h3>
          <ul style="color: #666; padding-left: 20px; ${getBodyFont()}">
            <li><strong>Name:</strong> ${escapeHtml(data.visitor_name)}</li>
            <li><strong>Email:</strong> ${escapeHtml(data.visitor_email)}</li>
            ${data.visitor_phone ? `<li><strong>Phone:</strong> ${escapeHtml(data.visitor_phone)}</li>` : ''}
            <li><strong>Group Size:</strong> ${escapeHtml(data.group_size || 1)}</li>
            ${data.preferred_date ? `<li><strong>Preferred Date:</strong> ${escapeHtml(data.preferred_date)}</li>` : ''}
            ${data.preferred_time ? `<li><strong>Preferred Time:</strong> ${escapeHtml(formatTimeDisplay(data.preferred_time))}</li>` : ''}
          </ul>
          ${data.additional_info ? `<p style="color: #666; margin-top: 15px; ${getBodyFont()}"><strong>Additional Information:</strong><br>${escapeHtml(data.additional_info)}</p>` : ''}
        </div>
        
        ${tshirtSection}
        ${newsletterSection}
        
        <div style="background-color: #FEF3E2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #A99967;">
          <h3 style="color: #A99967; margin-top: 0;">🎧 Self-Guided Audio Tour</h3>
          <p style="color: #666; margin-bottom: 15px;">You can also explore our building with our self-guided audio tour! Available Monday through Friday, 7am to 7pm with your mobile device and headphones.</p>
          <p style="text-align: center; margin: 0;">
            <a href="https://audio.robotics.umich.edu" style="background: #A99967; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">🎧 Hear Audio Tour</a>
          </p>
        </div>
        
        <p>If you have any questions in the meantime, please don't hesitate to reach out to us at <a href="mailto:robotics-tours@umich.edu" style="color: #00274C;">robotics-tours@umich.edu</a>.</p>
        
        <p style="margin-bottom: 0;">Your friends,<br>
        <strong>Michigan Robotics</strong><br>
        University of Michigan</p>
      </div>
      
      <div style="background: #00274C; color: white; padding: 20px; text-align: center; border-radius: 0 0 12px 12px;">
        <p style="margin: 0;">
          <a href="https://www.x.com/umrobotics" style="color: #ffffff; text-decoration: underline;">X</a> | 
          <a href="https://www.instagram.com/umrobotics/" style="color: #ffffff; text-decoration: underline;">Instagram</a> | 
          <a href="https://www.youtube.com/channel/UC-WH2n-SkB166pUq5o5ULUg" style="color: #ffffff; text-decoration: underline;">YouTube</a> | 
          <a href="https://www.linkedin.com/company/university-of-michigan-robotics/" style="color: #ffffff; text-decoration: underline;">LinkedIn</a>
        </p>
        <p style="font-size: 12px; margin-top: 10px;">University of Michigan Robotics Department<br>2505 Hayward St<br>Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generateTourRequestNotificationEmail(data) {
  // Generate t-shirt summary from structured data
  let tshirtSummary = '';
  if ((data.tshirt_request === 'on' || data.tshirt_request === true || data.tshirt_request === 'TRUE' || data.tshirt_request === 'true') && data.tshirt_sizes && (parseInt(data.tshirt_total) || 0) > 0) {
    const sizeEntries = Object.entries(data.tshirt_sizes)
      .filter(([size, qty]) => qty > 0)
      .map(([size, qty]) => `${getSizeFullName(size)}: ${qty} shirt${qty > 1 ? 's' : ''}`)
      .join(', ');
    tshirtSummary = `${data.tshirt_total} t-shirt${data.tshirt_total > 1 ? 's' : ''} (${sizeEntries}) - $${data.tshirt_cost}`;
  }

  const tshirtSection = (data.tshirt_request === 'on' || data.tshirt_request === true || data.tshirt_request === 'TRUE' || data.tshirt_request === 'true') && tshirtSummary ? `
    <div style="background-color: #fff3cd; padding: 15px; border-radius: 6px; margin: 15px 0;">
      <h4 style="color: #856404; margin-top: 0; ${getHeaderFont()}">T-Shirt Request</h4>
      <p style="color: #856404; margin: 0; ${getBodyFont()}">${escapeHtml(tshirtSummary)}</p>
    </div>
  ` : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Tour Request</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #2563eb 0%, #64748b 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white; ${getHeaderFont()}">New Tour Request</h1>
      </div>
      
      <div class="email-content" style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">A new tour request has been submitted:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 15px 0;">
          <h3 style="color: #333; margin-top: 0; ${getHeaderFont()}">Request Details</h3>
          <ul style="color: #666; padding-left: 20px; ${getBodyFont()}">
            <li><strong>Name:</strong> ${escapeHtml(data.visitor_name)}</li>
            <li><strong>Email:</strong> ${escapeHtml(data.visitor_email)}</li>
            ${data.visitor_phone ? `<li><strong>Phone:</strong> ${escapeHtml(data.visitor_phone)}</li>` : ''}
            <li><strong>Group Size:</strong> ${escapeHtml(data.group_size || 1)}</li>
            ${data.preferred_date ? `<li><strong>Preferred Date:</strong> ${escapeHtml(data.preferred_date)}</li>` : ''}
            ${data.preferred_time ? `<li><strong>Preferred Time:</strong> ${escapeHtml(formatTimeDisplay(data.preferred_time))}</li>` : ''}
            <li><strong>Newsletter Signup:</strong> ${(data.newsletter_signup === 'on' || data.newsletter_signup === true) ? 'Yes' : 'No'}</li>
          </ul>
          ${data.additional_info ? `<p style="color: #666; margin-top: 15px; ${getBodyFont()}"><strong>Additional Information:</strong><br>${escapeHtml(data.additional_info)}</p>` : ''}
        </div>
        
        ${tshirtSection}
        
        <p style="background-color: #d4edda; color: #155724; padding: 15px; border-radius: 6px; margin: 20px 0;">
          <strong>Action Required:</strong> Please review this request in the dashboard and assign a tour guide to schedule the tour.
        </p>
        
        <p style="text-align: center; margin: 25px 0;">
          <a href="${process.env.URL || 'https://tours.robotics.umich.edu'}" style="background: #00274C; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View Dashboard</a>
        </p>
      </div>
      
      <div style="background: #00274C; color: white; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
        <p style="margin: 0;">
          <a href="https://www.x.com/umrobotics" style="color: #ffffff; text-decoration: underline;">X</a> | 
          <a href="https://www.instagram.com/umrobotics/" style="color: #ffffff; text-decoration: underline;">Instagram</a> | 
          <a href="https://www.youtube.com/channel/UC-WH2n-SkB166pUq5o5ULUg" style="color: #ffffff; text-decoration: underline;">YouTube</a> | 
          <a href="https://www.linkedin.com/company/university-of-michigan-robotics/" style="color: #ffffff; text-decoration: underline;">LinkedIn</a>
        </p>
        <p style="font-size: 12px; margin-top: 10px;">University of Michigan Robotics Department<br>2505 Hayward St<br>Ann Arbor, MI 48109</p>
      </div>
    </body>
    </html>
  `;
}

function generateFeedbackEmail(tourData) {
  const { dateStr, timeStr } = formatTourDate(tourData.tour_date, tourData.tour_time);
  const feedbackUrl = `https://tours.robotics.umich.edu/feedback?tour=${tourData.tour_id}&type=${tourData.tour_type}${tourData.registration_id ? `&reg=${tourData.registration_id}` : ''}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>How was your robotics tour?</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 50%, #702F8A 100%); color: white; padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="height: 50px; margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 28px; color: white; ${getHeaderFont()}">How was your tour?</h1>
        <p style="margin: 10px 0 0 0; font-size: 18px; color: #ffcb05; ${getBodyFont()}">We'd love your feedback!</p>
      </div>
      
      <div class="email-content" style="background: white; padding: 30px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(tourData.visitor_name)},</p>
        
        <p>You recently signed up for a University of Michigan Ford Robotics Building tour on <strong>${dateStr} at ${timeStr}</strong>. We hope you were able to attend and enjoyed exploring our amazing home!</p>
        
        <p>Your feedback is incredibly valuable to us and helps us improve the tour experience for future visitors. Whether you attended the tour or weren't able to make it, we'd appreciate hearing from you.</p>
        
        <div style="background-color: #E6F3FF; padding: 25px; border-radius: 8px; margin: 25px 0; text-align: center; border-left: 4px solid #2F65A7;">
          <h3 style="color: #2F65A7; margin-top: 0; margin-bottom: 15px;">📝 Share Your Experience</h3>
          <p style="color: #555; margin-bottom: 20px;">The survey takes just 2-3 minutes and helps us create better experiences for future visitors (and roboticists).</p>
          <a href="${feedbackUrl}" style="display: inline-block; background-color: #00274C; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; ${getBodyFont()}">Give Feedback</a>
        </div>
        
        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0;">🤖 About Your Tour</h3>
          <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            ${tourData.guide_name ? `<li><strong>Tour Guide:</strong> ${escapeHtml(tourData.guide_name)}</li>` : ''}
            ${tourData.tour_title ? `<li><strong>Tour:</strong> ${escapeHtml(tourData.tour_title)}</li>` : ''}
          </ul>
        </div>
        
        <div style="margin: 25px 0;">
          <p style="color: #555; font-size: 14px; margin: 0;"><strong>Your feedback helps us:</strong></p>
          <ul style="color: #555; font-size: 14px; margin: 10px 0; padding-left: 20px;">
            <li>Improve our tour content</li>
            <li>Better showcase our robotics research and programs</li>
            <li>Create more engaging experiences</li>
            <li>Understand what resonates most with our guests</li>
          </ul>
        </div>
        
        <p>Thank you for your interest in Michigan Robotics, and we hope to see you again soon!</p>
        
        <div style="margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee;">
          <p style="margin: 0; color: #666; font-size: 14px;">Didn't attend the tour? No problem! We'd still love to hear from you about your experience with our registration process or any feedback you might have.</p>
        </div>
      </div>
      
      <div style="text-align: center; margin-top: 20px; color: #666; font-size: 14px;">
        <p>Michigan Robotics<br>
        University of Michigan<br>
        2505 Hayward St, Ann Arbor, MI 48109</p>
        
        <div style="margin-top: 15px;">
          <a href="${SOCIAL_MEDIA.TWITTER}" style="color: #666; text-decoration: none; margin: 0 5px;">Twitter</a> |
          <a href="${SOCIAL_MEDIA.INSTAGRAM}" style="color: #666; text-decoration: none; margin: 0 5px;">Instagram</a> |
          <a href="${SOCIAL_MEDIA.LINKEDIN}" style="color: #666; text-decoration: none; margin: 0 5px;">LinkedIn</a>
        </div>
      </div>
    </body>
    </html>
  `;
}


function generateTourCancelledEmail(request, guide) {
  const { dateStr, timeStr } = formatTourDate(request.preferred_date, request.preferred_time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tour Cancelled</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #9A3324 0%, #CC5544 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white; ${getHeaderFont()}">Tour Cancelled</h1>
      </div>

      <div class="email-content" style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>

        <p>The tour you were assigned to guide has been cancelled. Here are the details of the cancelled tour:</p>

        <div style="background-color: #FFF5F5; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #9A3324;">
          <h3 style="color: #9A3324; margin-top: 0; margin-bottom: 10px;">❌ Cancelled Tour</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Visitor:</strong> ${escapeHtml(request.visitor_name)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Group Size:</strong> ${escapeHtml(request.group_size)} people</li>
          </ul>
        </div>

        <p>You are no longer required to guide this tour. If you had made any special preparations, please disregard them.</p>

        <p>Thank you for your willingness to serve as a tour guide.</p>

        <p style="margin-bottom: 0;">Best regards,<br>
        Michigan Robotics Tours Team</p>

        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Questions? Contact us:</p>
          <p style="margin: 0;"><a href="mailto:${EMAIL_ADDRESSES.TOURS}" style="color: #00274C; text-decoration: none; font-weight: 600;">${EMAIL_ADDRESSES.TOURS}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePublicTourCancelledEmail(tour, guide) {
  // Parse the date properly to avoid timezone issues
  const [year, month, day] = tour.date.split('-');
  const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));

  const dateStr = tourDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Format time to AM/PM
  const { timeStr } = formatTourDate(tour.date, tour.time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Public Tour Cancelled</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #9A3324 0%, #CC5544 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white; ${getHeaderFont()}">Public Tour Cancelled</h1>
      </div>

      <div class="email-content" style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>

        <p>The public tour you were assigned to guide has been cancelled. Here are the details:</p>

        <div style="background-color: #FFF5F5; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #9A3324;">
          <h3 style="color: #9A3324; margin-top: 0; margin-bottom: 10px;">❌ Cancelled Tour</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Title:</strong> ${escapeHtml(tour.title)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Type:</strong> ${tour.type}</li>
            <li><strong>Registrations:</strong> ${tour.registrations?.length || 0} people</li>
          </ul>
        </div>

        <p>You are no longer required to guide this tour. Please note that registered participants are not automatically notified - the tours team will reach out to them separately.</p>

        <p>Thank you for your willingness to serve as a tour guide.</p>

        <p style="margin-bottom: 0;">Best regards,<br>
        Michigan Robotics Tours Team</p>

        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Questions? Contact us:</p>
          <p style="margin: 0;"><a href="mailto:${EMAIL_ADDRESSES.TOURS}" style="color: #00274C; text-decoration: none; font-weight: 600;">${EMAIL_ADDRESSES.TOURS}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateGuideRemovedEmail(request, guide) {
  const { dateStr, timeStr } = formatTourDate(request.preferred_date, request.preferred_time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tour Guide Assignment Removed</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white; ${getHeaderFont()}">Tour Assignment Update</h1>
      </div>

      <div class="email-content" style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>

        <p>You are no longer assigned to guide the following tour. The tour itself is still happening; this is just an update to your assignment.</p>

        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0; margin-bottom: 10px;">Tour Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Visitor:</strong> ${escapeHtml(request.visitor_name)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
            <li><strong>Group Size:</strong> ${escapeHtml(request.group_size)} people</li>
          </ul>
        </div>

        <p>If you have questions about this change, please reach out to the tours team.</p>

        <p>Thank you for your willingness to serve as a tour guide.</p>

        <p style="margin-bottom: 0;">Best regards,<br>
        Michigan Robotics Tours Team</p>

        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Questions? Contact us:</p>
          <p style="margin: 0;"><a href="mailto:${EMAIL_ADDRESSES.TOURS}" style="color: #00274C; text-decoration: none; font-weight: 600;">${EMAIL_ADDRESSES.TOURS}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generatePublicTourGuideRemovedEmail(tour, guide) {
  const { dateStr, timeStr } = formatTourDate(tour.date, tour.time);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Public Tour Assignment Removed</title>
      ${getEmailStyles()}
    </head>
    <body style="${getBodyFont()} line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div class="email-header" style="background: linear-gradient(135deg, #00274C 0%, #2F65A7 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <img src="https://robotics.umich.edu/marketing-white.png" alt="University of Michigan" class="email-logo" style="margin-bottom: 15px;">
        <h1 style="margin: 0; font-size: 24px; color: white; ${getHeaderFont()}">Tour Assignment Update</h1>
      </div>

      <div class="email-content" style="background: white; padding: 20px; border: 1px solid #e1e5e9; border-top: none; border-radius: 0 0 8px 8px;">
        <p style="margin-top: 0; ${getBodyFont()}">Hi ${escapeHtml(guide.name)},</p>

        <p>You are no longer assigned to guide the following public tour. The tour itself is still happening; this is just an update to your assignment.</p>

        <div style="background-color: #F5F5F5; padding: 20px; border-radius: 6px; margin: 15px 0; border-left: 4px solid #00274C;">
          <h3 style="color: #00274C; margin-top: 0; margin-bottom: 10px;">Tour Details</h3>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li><strong>Title:</strong> ${escapeHtml(tour.title)}</li>
            <li><strong>Date:</strong> ${dateStr}</li>
            <li><strong>Time:</strong> ${timeStr}</li>
          </ul>
        </div>

        <p>If you have questions about this change, please reach out to the tours team.</p>

        <p>Thank you for your willingness to serve as a tour guide.</p>

        <p style="margin-bottom: 0;">Best regards,<br>
        Michigan Robotics Tours Team</p>

        <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px; text-align: center;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">Questions? Contact us:</p>
          <p style="margin: 0;"><a href="mailto:${EMAIL_ADDRESSES.TOURS}" style="color: #00274C; text-decoration: none; font-weight: 600;">${EMAIL_ADDRESSES.TOURS}</a></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

module.exports = {
  generateVisitorScheduledEmail,
  generateGuideScheduledEmail,
  generatePublicTourGuideEmail,
  generateVisitorReminderEmail,
  generateGuideReminderEmail,
  generatePublicTourReminderEmail,
  generatePublicTourConfirmationEmail,
  generateTourRequestConfirmationEmail,
  generateTourRequestNotificationEmail,
  generateFeedbackEmail,
  generateTourCancelledEmail,
  generatePublicTourCancelledEmail,
  generateGuideRemovedEmail,
  generatePublicTourGuideRemovedEmail,
  formatTourDate,
  getSizeFullName
};
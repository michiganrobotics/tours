const { getCachedDataService } = require('./lib/services');
const { withRateLimit } = require('./lib/rateLimiter');

const mainHandler = async (event, context) => {
  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const feedbackData = JSON.parse(event.body);

    // Validate required fields
    const requiredFields = ['visitor_name', 'visitor_email', 'nps_score', 'overall_rating', 'understanding_robotics', 'impression_changed'];
    const missingFields = requiredFields.filter(field => !feedbackData[field] && feedbackData[field] !== 0);
    
    if (missingFields.length > 0) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: `Missing required fields: ${missingFields.join(', ')}` }),
      };
    }

    // Validate NPS score and overall rating ranges
    const npsScore = parseInt(feedbackData.nps_score);
    const overallRating = parseInt(feedbackData.overall_rating);
    
    if (npsScore < 0 || npsScore > 10) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'NPS score must be between 0 and 10' }),
      };
    }
    
    if (overallRating < 0 || overallRating > 10) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Overall rating must be between 0 and 10' }),
      };
    }

    const dataService = await getCachedDataService();

    // Get tour information for context
    let tourDate = null;
    let guideName = null;

    if (feedbackData.tour_id && feedbackData.tour_type) {
      if (feedbackData.tour_type === 'private') {
        const requests = await dataService.getAllTourRequests();
        const request = requests.find(r => r.id === feedbackData.tour_id);
        if (request) {
          tourDate = request.preferred_date;
          const allGuides = await dataService.getAllTourGuides();

          // Parse guide IDs and get all assigned guides
          const guideIds = request.assigned_guide_id ? request.assigned_guide_id.split(',').map(id => id.trim()).filter(id => id) : [];
          const guides = guideIds.map(id => allGuides.find(g => g.id === id)).filter(g => g);

          // Format guide names
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
        }
      } else if (feedbackData.tour_type === 'public') {
        const publicTours = await dataService.getAllPublicTours();
        const tour = publicTours.find(t => t.id === feedbackData.tour_id);
        if (tour) {
          tourDate = tour.date;
          const allGuides = await dataService.getAllTourGuides();

          // Parse guide IDs and get all assigned guides
          const guideIds = tour.assigned_guide_id ? tour.assigned_guide_id.split(',').map(id => id.trim()).filter(id => id) : [];
          const guides = guideIds.map(id => allGuides.find(g => g.id === id)).filter(g => g);

          // Format guide names
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
        }
      }
    }

    // Prepare feedback row for Google Sheets
    const feedbackRow = {
      id: `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tour_id: feedbackData.tour_id || '',
      tour_type: feedbackData.tour_type || '',
      visitor_name: feedbackData.visitor_name,
      visitor_email: feedbackData.visitor_email,
      tour_date: tourDate || '',
      guide_name: guideName || '',
      nps_score: npsScore,
      nps_reason: feedbackData.nps_reason || '',
      understanding_robotics: feedbackData.understanding_robotics,
      impression_changed: feedbackData.impression_changed,
      impression_details: feedbackData.impression_details || '',
      overall_rating: overallRating,
      what_liked_most: feedbackData.what_liked_most || '',
      suggestions_improvement: feedbackData.suggestions_improvement || '',
      other_comments: feedbackData.other_comments || '',
      submission_date: feedbackData.submission_date || new Date().toISOString(),
      created_at: new Date().toISOString()
    };

    // Save feedback to Google Sheets
    await dataService.addFeedback(feedbackRow);

    console.log('Feedback submitted successfully:', {
      id: feedbackRow.id,
      tour_id: feedbackRow.tour_id,
      tour_type: feedbackRow.tour_type,
      nps_score: feedbackRow.nps_score,
      overall_rating: feedbackRow.overall_rating
    });

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        success: true, 
        message: 'Feedback submitted successfully',
        id: feedbackRow.id
      }),
    };

  } catch (error) {
    console.error('Error submitting feedback:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
// Export handler with rate limiting
exports.handler = async (event, context) => {
  return withRateLimit(event, mainHandler);
};

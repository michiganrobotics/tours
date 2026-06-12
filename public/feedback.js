// Feedback form JavaScript

// Escape user-supplied values before inserting into HTML
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

document.addEventListener('DOMContentLoaded', function() {
    // Get URL parameters to identify the tour
    const urlParams = new URLSearchParams(window.location.search);
    const tourId = urlParams.get('tour');
    const tourType = urlParams.get('type');
    const registrationId = urlParams.get('reg');

    // Populate hidden fields
    if (tourId) {
        document.getElementById('tourId').value = tourId;
    }
    if (tourType) {
        document.getElementById('tourType').value = tourType;
    }
    if (registrationId) {
        document.getElementById('registrationId').value = registrationId;
    }

    // Load tour information
    loadTourInfo();

    // Set up NPS buttons
    setupNPSButtons();

    // Set up rating buttons
    setupRatingButtons();

    // Set up form submission
    setupFormSubmission();
});

async function loadTourInfo() {
    const tourId = document.getElementById('tourId').value;
    const tourType = document.getElementById('tourType').value;
    const registrationId = document.getElementById('registrationId').value;

    if (!tourId || !tourType) {
        document.getElementById('tourDetails').innerHTML = 
            '<p class="text-sm text-red-600 dark:text-red-400">Hmm, are you sure you took a Michigan Robotics tour? Try using the link we sent to your email.</p>';
        return;
    }

    try {
        // Fetch tour information from the API
        const response = await fetch('/.netlify/functions/get-tour-info', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                tourId: tourId,
                tourType: tourType,
                registrationId: registrationId
            })
        });

        if (response.ok) {
            const tourData = await response.json();
            displayTourInfo(tourData);
            
            // Pre-fill visitor information if available
            if (tourData.visitor_name) {
                document.getElementById('visitorName').value = tourData.visitor_name;
            }
            if (tourData.visitor_email) {
                document.getElementById('visitorEmail').value = tourData.visitor_email;
            }
        } else {
            throw new Error('Failed to load tour information');
        }
    } catch (error) {
        console.error('Error loading tour info:', error);
        document.getElementById('tourDetails').innerHTML = 
            '<p class="text-sm text-red-600 dark:text-red-400">Unable to load tour information. You can still provide feedback.</p>';
    }
}

function displayTourInfo(tourData) {
    const tourDetails = document.getElementById('tourDetails');
    
    let html = '';
    if (tourData.tour_date) {
        html += `<p><strong>Date:</strong> ${formatDate(tourData.tour_date)}</p>`;
    }
    if (tourData.tour_time) {
        html += `<p><strong>Time:</strong> ${escapeHtml(tourData.tour_time)}</p>`;
    }
    if (tourData.guide_name) {
        html += `<p><strong>Guide:</strong> ${escapeHtml(tourData.guide_name)}</p>`;
    }
    if (tourData.tour_title) {
        html += `<p><strong>Tour:</strong> ${escapeHtml(tourData.tour_title)}</p>`;
    }
    
    if (html) {
        tourDetails.innerHTML = html;
    } else {
        tourDetails.innerHTML = '<p class="text-sm text-gray-600 dark:text-gray-200">Tour information not available</p>';
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        return dateString;
    }
}

function setupNPSButtons() {
    const npsButtons = document.querySelectorAll('.nps-btn');
    const npsScoreInput = document.getElementById('npsScore');
    const npsReasonSection = document.getElementById('npsReasonSection');

    npsButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active state from all buttons
            npsButtons.forEach(btn => {
                btn.classList.remove('bg-[#00274c]', 'text-white', 'border-blue-600', 'dark:bg-transparent', 'dark:border-[#FFCB05]');
                btn.classList.add('border-gray-300', 'dark:border-gray-600');
                btn.setAttribute('aria-checked', 'false');
            });
            
            // Add active state to clicked button
            this.classList.remove('border-gray-300', 'dark:border-gray-600');
            this.classList.add('bg-[#00274c]', 'text-white', 'border-blue-600', 'dark:bg-transparent', 'dark:border-[#FFCB05]');
            this.setAttribute('aria-checked', 'true');
            
            // Set the score value
            const score = this.getAttribute('data-score');
            npsScoreInput.value = score;
            
            // Show follow-up question
            npsReasonSection.classList.remove('hidden');
        });
    });
}

function setupRatingButtons() {
    const ratingButtons = document.querySelectorAll('.rating-btn');
    const overallRatingInput = document.getElementById('overallRating');

    ratingButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active state from all buttons
            ratingButtons.forEach(btn => {
                btn.classList.remove('bg-[#00274c]', 'text-white', 'border-blue-600', 'dark:bg-transparent', 'dark:border-[#FFCB05]');
                btn.classList.add('border-gray-300', 'dark:border-gray-600');
                btn.setAttribute('aria-checked', 'false');
            });
            
            // Add active state to clicked button
            this.classList.remove('border-gray-300', 'dark:border-gray-600');
            this.classList.add('bg-[#00274c]', 'text-white', 'border-blue-600', 'dark:bg-transparent', 'dark:border-[#FFCB05]');
            this.setAttribute('aria-checked', 'true');
            
            // Set the rating value
            const rating = this.getAttribute('data-rating');
            overallRatingInput.value = rating;
        });
    });
}

function toggleImpressionDetails(show) {
    const impressionDetailsSection = document.getElementById('impressionDetailsSection');
    if (show) {
        impressionDetailsSection.classList.remove('hidden');
        document.getElementById('impressionDetails').setAttribute('required', 'required');
    } else {
        impressionDetailsSection.classList.add('hidden');
        document.getElementById('impressionDetails').removeAttribute('required');
        document.getElementById('impressionDetails').value = '';
    }
}

function setupFormSubmission() {
    const form = document.getElementById('feedbackForm');
    const submitButton = document.getElementById('submitFeedback');
    const submitText = document.getElementById('submitText');
    const submitSpinner = document.getElementById('submitSpinner');

    form.addEventListener('submit', async function(e) {
        e.preventDefault();

        // Validate required fields
        const npsScore = document.getElementById('npsScore').value;
        const overallRating = document.getElementById('overallRating').value;
        const understandingRobotics = document.querySelector('input[name="understanding_robotics"]:checked');
        const impressionChanged = document.querySelector('input[name="impression_changed"]:checked');

        if (!npsScore) {
            alert('Please provide a recommendation score (0-10).');
            return;
        }
        if (!overallRating) {
            alert('Please provide an overall rating (0-10).');
            return;
        }
        if (!understandingRobotics) {
            alert('Please indicate if you gained a greater understanding of robotics.');
            return;
        }
        if (!impressionChanged) {
            alert('Please indicate if your impression of Michigan Robotics changed.');
            return;
        }

        // Show loading state
        submitButton.disabled = true;
        submitText.textContent = 'Submitting...';
        submitSpinner.classList.remove('hidden');
        submitSpinner.classList.add('inline');

        try {
            // Generate reCAPTCHA token
            const recaptchaToken = await grecaptcha.execute('6LeKK2UrAAAAAAKPM3P7FqJRaFprim_ti5EGCFDR', {action: 'submit_feedback'});
            
            // Collect all form data
            const formData = new FormData(form);
            const feedbackData = {};
            
            // Convert FormData to regular object
            for (let [key, value] of formData.entries()) {
                feedbackData[key] = value;
            }

            // Add timestamp and reCAPTCHA token
            feedbackData.submission_date = new Date().toISOString();
            feedbackData.recaptcha_token = recaptchaToken;

            // Submit to Netlify function
            const response = await fetch('/.netlify/functions/submit-feedback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(feedbackData)
            });

            if (response.ok) {
                // Show success message
                document.getElementById('feedbackForm').parentElement.classList.add('hidden');
                document.getElementById('thankYouMessage').classList.remove('hidden');
            } else {
                throw new Error('Failed to submit feedback');
            }
        } catch (error) {
            console.error('Error submitting feedback:', error);
            document.getElementById('errorMessage').classList.remove('hidden');
            
            // Reset form state
            submitButton.disabled = false;
            submitText.textContent = 'Submit Feedback';
            submitSpinner.classList.add('hidden');
            submitSpinner.classList.remove('inline');
        }
    });
}

// Make function available globally for onclick handlers
window.toggleImpressionDetails = toggleImpressionDetails;
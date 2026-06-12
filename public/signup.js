// Global state
let publicTours = [];

// reCAPTCHA v3 site key
const RECAPTCHA_SITE_KEY = '6LeKK2UrAAAAAAKPM3P7FqJRaFprim_ti5EGCFDR';

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

// Helper function to parse date string avoiding timezone issues
function parseDate(dateStr) {
    try {
        const [year, month, day] = dateStr.split('-');
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    } catch (error) {
        console.error('Error parsing date:', error, dateStr);
        return new Date();
    }
}

// Helper functions for error handling
function showErrorMessage(containerId, listId, errors) {
    const container = document.getElementById(containerId);
    const errorList = document.getElementById(listId);
    
    // Clear previous errors
    errorList.innerHTML = '';
    
    // Add new errors
    if (Array.isArray(errors)) {
        errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error.message || error;
            errorList.appendChild(li);
        });
    } else if (typeof errors === 'string') {
        const li = document.createElement('li');
        li.textContent = errors;
        errorList.appendChild(li);
    }
    
    // Show the container
    container.classList.remove('hidden');
    
    // Scroll to the error message
    container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideErrorMessage(containerId) {
    const container = document.getElementById(containerId);
    container.classList.add('hidden');
}

// Helper function to convert 24-hour time to 12-hour format for display
function formatTimeForDisplay(timeStr) {
    if (!timeStr || timeStr === 'Time TBD') return timeStr;
    
    // If already in 12-hour format, return as-is
    if (timeStr.includes('AM') || timeStr.includes('PM')) {
        return timeStr;
    }
    
    // Convert 24-hour format to 12-hour format
    try {
        const [hours, minutes] = timeStr.split(':');
        const hour24 = parseInt(hours);
        const hour12 = hour24 % 12 || 12;
        const ampm = hour24 >= 12 ? 'PM' : 'AM';
        return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
        console.error('Error formatting time:', error);
        return timeStr; // Return original if formatting fails
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading animation immediately
    showLoadingState();
    
    // Load data and then render
    await loadPublicTours();
    renderAvailableTours();
});

// Load public tours from API
async function loadPublicTours() {
    try {
        const response = await fetch('/api/public-tours');
        if (response.ok) {
            publicTours = await response.json();
        } else {
            console.error('Failed to load public tours');
            publicTours = [];
        }
    } catch (error) {
        console.error('Error loading public tours:', error);
        publicTours = [];
    }
}

// Show loading state
function showLoadingState() {
    const container = document.getElementById('availableTours');
    container.innerHTML = `
        <div class="text-center py-8">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center animate-pulse" style="background-color: #E6F3FF;">
                <div class="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            </div>
            <h3 class="font-semibold mb-2 text-gray-600 dark:text-gray-300">Loading tours...</h3>
            <p class="text-gray-500 dark:text-gray-400">Please wait while we fetch available tour dates</p>
        </div>
    `;
}

// Render available tours
function renderAvailableTours() {
    const container = document.getElementById('availableTours');
    
    // Filter for active tours that are in the future
    const now = new Date();
    const availableTours = publicTours.filter(tour => 
        tour.status === 'active' && 
        parseDate(tour.date) >= now
    ).sort((a, b) => parseDate(a.date) - parseDate(b.date));
    
    if (availableTours.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style="background-color: #FEF3E2;">
                    <span class="text-2xl">📅</span>
                </div>
                <h3 class="font-semibold mb-2 text-gray-900 dark:text-gray-100">No Tours Scheduled</h3>
                <p class="text-gray-600 dark:text-gray-300">Check back soon for upcoming public tour dates!</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = availableTours.map(tour => {
        const tourDate = parseDate(tour.date);
        const dateStr = tourDate.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
        
        const totalRegistered = tour.registrations?.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0) || 0;
        const spotsLeft = tour.capacity - totalRegistered;
        const isFull = spotsLeft <= 0;
        
        return `
            <div class="border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 rounded-lg p-6 hover:shadow-md transition-shadow">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div class="flex-1 mb-4 md:mb-0">
                        <h4 class="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">${escapeHtml(tour.title)}</h4>
                        <div class="space-y-1 text-sm text-gray-600 dark:text-gray-300">
                            <div class="flex items-center space-x-2">
                                <span>📅</span>
                                <span><strong>${dateStr}</strong> at ${escapeHtml(formatTimeForDisplay(tour.time))}</span>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span>
                                    ${isFull ?
                                        `<span class="text-red-600">Tour Full</span> (${totalRegistered}/${escapeHtml(tour.capacity)} registered)` :
                                        `${spotsLeft} spots available (${totalRegistered}/${escapeHtml(tour.capacity)} registered)`
                                    }
                                </span>
                            </div>
                        </div>
                        ${tour.notes ? `
                            <div class="mt-3 p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                                <p class="text-sm text-blue-800 dark:text-blue-200">${escapeHtml(tour.notes)}</p>
                            </div>
                        ` : ''}
                    </div>
                    <div class="flex-shrink-0">
                        <button 
                            onclick="${isFull ? '' : `showRegistrationForm('${tour.id}')`}" 
                            class="text-white font-medium px-6 py-3 rounded-lg transition-colors w-full md:w-auto ${isFull ? 'bg-gray-400 cursor-not-allowed opacity-50' : 'cursor-pointer bg-[#00274C] hover:bg-[#2F65A7] dark:border dark:border-gray-300 dark:hover:border-gray-200'}" 
                            ${isFull ? 'disabled' : ''}
                        >
                            ${isFull ? 'Tour Full' : 'Register now'}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Show registration form
function showRegistrationForm(tourId) {
    const tour = publicTours.find(t => t.id === tourId || t.id === String(tourId));
    if (!tour) {
        console.error('Tour not found for ID:', tourId);
        return;
    }
    
    const tourDate = parseDate(tour.date);
    const dateStr = tourDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    const totalRegistered = tour.registrations?.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0) || 0;
    const spotsLeft = tour.capacity - totalRegistered;
    const isFull = spotsLeft <= 0;
    
    // Populate tour info
    document.getElementById('tourInfo').innerHTML = `
        <h4 class="font-semibold mb-2 text-gray-900 dark:text-gray-100">${escapeHtml(tour.title)}</h4>
        <div class="text-sm space-y-1 text-gray-900 dark:text-gray-100">
            <div><strong>Date:</strong> ${dateStr} at ${escapeHtml(formatTimeForDisplay(tour.time))}</div>
            <div><strong>Duration:</strong> Approximately 45 minutes</div>
            <div><strong>Status:</strong> 
                <span class="${isFull ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}">
                    ${isFull ? 'Tour Full' : `${spotsLeft} spots available`}
                </span>
            </div>
        </div>
    `;
    
    // Populate group size dropdown based on available spots
    const groupSizeSelect = document.querySelector('select[name="group_size"]');
    groupSizeSelect.innerHTML = '';
    
    if (isFull) {
        // If tour is full, show disabled option
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Tour is full';
        option.disabled = true;
        groupSizeSelect.appendChild(option);
        groupSizeSelect.disabled = true;
    } else {
        // Only allow group sizes up to available spots
        const maxAllowed = Math.max(1, spotsLeft); // Ensure at least 1 is available
        for (let i = 1; i <= maxAllowed; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i === 1 ? '1 person' : `${i} people`;
            groupSizeSelect.appendChild(option);
        }
        groupSizeSelect.disabled = false;
    }
    
    // Set hidden tour ID
    document.getElementById('tourId').value = tourId;
    
    // Show modal
    document.getElementById('registrationModal').classList.remove('hidden');
}

// T-shirt grid toggle function
function toggleTshirtGrid() {
    const checkbox = document.getElementById('tshirtRequest');
    const grid = document.getElementById('tshirtGrid');
    const image = document.getElementById('tshirtImage');
    const image2 = document.getElementById('tshirtImage2');
    
    if (checkbox.checked) {
        grid.classList.remove('hidden');
        grid.classList.add('block');
        image.classList.remove('hidden');
        image.classList.add('block');
        image2.classList.remove('hidden');
        image2.classList.add('block');
    } else {
        grid.classList.add('hidden');
        grid.classList.remove('block');
        image.classList.add('hidden');
        image.classList.remove('block');
        image2.classList.add('hidden');
        image2.classList.remove('block');
        // Reset all t-shirt quantities when unchecked
        const inputs = grid.querySelectorAll('input[type="number"]');
        inputs.forEach(input => input.value = '0');
    }
}

// Form submission state management for public tour registration
let isPublicTourSubmitting = false;

function setPublicTourSubmissionState(submitting) {
    isPublicTourSubmitting = submitting;
    const button = document.querySelector('#registrationForm button[type="submit"]');
    
    if (submitting) {
        button.disabled = true;
        button.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Registering...
        `;
    } else {
        button.disabled = false;
        button.innerHTML = 'Register for Tour';
    }
}

// Handle form submission
document.getElementById('registrationForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Prevent double submission
    if (isPublicTourSubmitting) {
        return;
    }
    
    try {
        setPublicTourSubmissionState(true);
        // Get reCAPTCHA v3 token
        const recaptchaToken = await grecaptcha.execute(RECAPTCHA_SITE_KEY, {action: 'public_tour_registration'});
        if (!recaptchaToken) {
            alert('reCAPTCHA verification failed. Please try again.');
            setPublicTourSubmissionState(false);
            return;
        }
    
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        
        // Convert checkbox values from "on" to boolean
        data.tshirt_request = data.tshirt_request === 'on';
        data.newsletter_signup = data.newsletter_signup === 'on';
        
        // Add reCAPTCHA token to data
        data.recaptchaToken = recaptchaToken;
    
        // Validate group size against available spots
        // (loose equality: sheet IDs are strings, the form value is a string)
        const tour = publicTours.find(t => t.id == data.public_tour_id);
        if (tour) {
            const totalRegistered = tour.registrations?.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0) || 0;
            const spotsLeft = tour.capacity - totalRegistered;
            const requestedGroupSize = parseInt(data.group_size);
            
            if (spotsLeft > 0 && requestedGroupSize > spotsLeft) {
                alert(`Sorry, only ${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} remaining. Please select a smaller group size.`);
                setPublicTourSubmissionState(false);
                return;
            }
        }
        
        // Collect t-shirt data if requested
        if (data.tshirt_request) {
            data.tshirt_sizes = {
                xs: parseInt(data.tshirt_xs) || 0,
                s: parseInt(data.tshirt_s) || 0,
                m: parseInt(data.tshirt_m) || 0,
                l: parseInt(data.tshirt_l) || 0,
                xl: parseInt(data.tshirt_xl) || 0,
                xxl: parseInt(data.tshirt_xxl) || 0
            };
            data.tshirt_total = Object.values(data.tshirt_sizes).reduce((sum, qty) => sum + qty, 0);
            data.tshirt_cost = data.tshirt_total * 20;
            
            // Validate that at least one t-shirt size is selected
            if (data.tshirt_total === 0) {
                showErrorMessage('registrationErrorMessage', 'registrationErrorList', ['Please select at least one t-shirt size or uncheck the t-shirt request option.']);
                setPublicTourSubmissionState(false);
                return;
            }
            
            // Validate maximum t-shirt quantity limit
            if (data.tshirt_total > 20) {
                showErrorMessage('registrationErrorMessage', 'registrationErrorList', ['Total t-shirt quantity cannot exceed 20. For larger orders, please visit our online store at https://www.aatwebstore.com/UMBOT/shop/home']);
                setPublicTourSubmissionState(false);
                return;
            }
        }
        
        const response = await fetch('/api/public-tour-registrations', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('registrationModal');
            showSuccessModal('registration');
            e.target.reset();
            
            // Reload tours to update availability
            await loadPublicTours();
            renderAvailableTours();
        } else {
            // Try to get detailed error message from response
            try {
                const errorData = await response.json();
                if (errorData.details && Array.isArray(errorData.details)) {
                    // Show validation errors inline
                    showErrorMessage('registrationErrorMessage', 'registrationErrorList', errorData.details);
                } else if (errorData.error) {
                    showErrorMessage('registrationErrorMessage', 'registrationErrorList', [errorData.error]);
                } else {
                    showErrorMessage('registrationErrorMessage', 'registrationErrorList', ['Registration failed. Please try again.']);
                }
            } catch (parseError) {
                showErrorMessage('registrationErrorMessage', 'registrationErrorList', ['Registration failed. Please try again.']);
            }
            setPublicTourSubmissionState(false);
        }
    } catch (error) {
        console.error('Error submitting registration:', error);
        showErrorMessage('registrationErrorMessage', 'registrationErrorList', ['Registration failed. Please try again.']);
        setPublicTourSubmissionState(false);
    }
});

// Close modal function
function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showSuccessModal(type) {
    const modal = document.getElementById('successModal');
    const title = modal.querySelector('h2');
    const description = modal.querySelector('p');
    
    if (type === 'registration') {
        title.textContent = 'Registration Successful!';
        description.textContent = "Thank you for registering! You'll receive a confirmation email shortly with tour details and directions.";
    } else if (type === 'request') {
        title.textContent = 'Request Submitted!';
        description.textContent = "Thank you for your tour request! We'll review your request and get back to you soon to schedule your visit.";
    }
    
    modal.classList.remove('hidden');
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const modals = document.querySelectorAll('.fixed');
    modals.forEach(modal => {
        if (event.target === modal) {
            modal.classList.add('hidden');
        }
    });
});

// Close modals with escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Close any visible modals
        const allModals = ['registrationModal', 'successModal', 'specialTourRequestModal'];
        
        allModals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && !modal.classList.contains('hidden')) {
                closeModal(modalId);
            }
        });
    }
});

// Show special tour request form
function showSpecialTourRequestForm() {
    // Clear any previous errors
    hideErrorMessage('specialTourErrorMessage');
    
    document.getElementById('specialTourRequestModal').classList.remove('hidden');
    // Clear default browser values for date and time inputs
    const dateInput = document.querySelector('input[name="preferred_date"]');
    const timeSelect = document.querySelector('select[name="preferred_time"]');
    
    // Clear values
    dateInput.value = '';
    timeSelect.value = '';
    
    // Safari-specific fix: force re-render for date input only
    if (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome')) {
        const originalDateType = dateInput.type;
        
        dateInput.type = 'text';
        dateInput.value = '';
        
        // Restore original type after a brief delay
        setTimeout(() => {
            dateInput.type = originalDateType;
        }, 10);
    }
}

// T-shirt grid toggle function for special tour requests
function toggleSpecialTourTshirtGrid() {
    const checkbox = document.getElementById('specialTourTshirtRequest');
    const grid = document.getElementById('specialTourTshirtGrid');
    const image = document.getElementById('specialTourTshirtImage');
    const image2 = document.getElementById('specialTourTshirtImage2');
    
    if (checkbox.checked) {
        grid.classList.remove('hidden');
        grid.classList.add('block');
        image.classList.remove('hidden');
        image.classList.add('block');
        image2.classList.remove('hidden');
        image2.classList.add('block');
    } else {
        grid.classList.add('hidden');
        grid.classList.remove('block');
        image.classList.add('hidden');
        image.classList.remove('block');
        image2.classList.add('hidden');
        image2.classList.remove('block');
        // Reset all t-shirt quantities when unchecked
        const inputs = grid.querySelectorAll('input[type="number"]');
        inputs.forEach(input => input.value = '0');
    }
}

// Form submission state management for special tour requests
let isSpecialTourSubmitting = false;

function setSpecialTourSubmissionState(submitting) {
    isSpecialTourSubmitting = submitting;
    const button = document.getElementById('specialTourSubmitButton');
    const buttonText = document.getElementById('specialTourSubmitButtonText');
    const spinner = document.getElementById('specialTourSubmitButtonSpinner');
    
    if (submitting) {
        button.disabled = true;
        buttonText.textContent = 'Submitting...';
        spinner.classList.remove('hidden');
        spinner.classList.add('inline');
    } else {
        button.disabled = false;
        buttonText.textContent = 'Submit Request';
        spinner.classList.add('hidden');
        spinner.classList.remove('inline');
    }
}

// Handle special tour request form submission
document.getElementById('specialTourRequestForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Prevent double submission
    if (isSpecialTourSubmitting) {
        return;
    }
    
    try {
        // Get reCAPTCHA v3 token for special tour form
        const recaptchaToken = await grecaptcha.execute(RECAPTCHA_SITE_KEY, {action: 'special_tour_request'});
        if (!recaptchaToken) {
            alert('reCAPTCHA verification failed. Please try again.');
            return;
        }
        
        setSpecialTourSubmissionState(true);
    
        const formData = new FormData(e.target);
        
        // Check if bot field is filled (spam protection)
        if (formData.get('bot-field')) {
            setSpecialTourSubmissionState(false);
            return; // Silent fail for bots
        }
        
        const data = Object.fromEntries(formData.entries());
        
        // Convert checkbox values from "on" to boolean
        data.tshirt_request = data.tshirt_request === 'on';
        data.newsletter_signup = data.newsletter_signup === 'on';
        
        // Add reCAPTCHA token to data
        data.recaptchaToken = recaptchaToken;
    
        // Collect t-shirt data if requested
        if (data.tshirt_request) {
            data.tshirt_sizes = {
                xs: parseInt(data.tshirt_xs) || 0,
                s: parseInt(data.tshirt_s) || 0,
                m: parseInt(data.tshirt_m) || 0,
                l: parseInt(data.tshirt_l) || 0,
                xl: parseInt(data.tshirt_xl) || 0,
                xxl: parseInt(data.tshirt_xxl) || 0
            };
            data.tshirt_total = Object.values(data.tshirt_sizes).reduce((sum, qty) => sum + qty, 0);
            data.tshirt_cost = data.tshirt_total * 20;
            
            // Validate that at least one t-shirt size is selected
            if (data.tshirt_total === 0) {
                showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', ['Please select at least one t-shirt size or uncheck the t-shirt request option.']);
                setSpecialTourSubmissionState(false);
                return;
            }
            
            // Validate maximum t-shirt quantity limit
            if (data.tshirt_total > 20) {
                showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', ['Total t-shirt quantity cannot exceed 20. For larger orders, please visit our online store at https://www.aatwebstore.com/UMBOT/shop/home']);
                setSpecialTourSubmissionState(false);
                return;
            }
            
            // Add t-shirt summary to form data for Netlify
            formData.set('tshirt_summary', `Total: ${data.tshirt_total} shirts ($${data.tshirt_cost}) - Sizes: ${Object.entries(data.tshirt_sizes).filter(([size, qty]) => qty > 0).map(([size, qty]) => `${size.toUpperCase()}: ${qty}`).join(', ')}`);
        }
    
        // Submit to both our API and Netlify forms
        const [apiResponse, netlifyResponse] = await Promise.all([
            fetch('/api/tour-requests', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data)
            }),
            fetch('/', {
                method: 'POST',
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams(formData).toString()
            })
        ]);
        
        // Note: Emails are automatically sent by the API endpoint, no manual trigger needed
        
        if (apiResponse.ok) {
            closeModal('specialTourRequestModal');
            showSuccessModal('request');
            e.target.reset();
            
            // Reset t-shirt grid
            const tshirtGrid = document.getElementById('specialTourTshirtGrid');
            const tshirtImages = [document.getElementById('specialTourTshirtImage'), document.getElementById('specialTourTshirtImage2')];
            tshirtGrid.classList.add('hidden');
            tshirtImages.forEach(img => img.classList.add('hidden'));
        } else {
            // Try to get detailed error message from API response
            try {
                const errorData = await apiResponse.json();
                if (errorData.details && Array.isArray(errorData.details)) {
                    showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', errorData.details);
                } else if (errorData.error) {
                    showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', [errorData.error]);
                } else {
                    showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', ['Request submission failed. Please try again.']);
                }
            } catch (parseError) {
                showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', ['Request submission failed. Please try again.']);
            }
            setSpecialTourSubmissionState(false);
        }
    } catch (error) {
        console.error('Error submitting special tour request:', error);
        showErrorMessage('specialTourErrorMessage', 'specialTourErrorList', ['Request submission failed. Please try again.']);
        setSpecialTourSubmissionState(false);
    }
});
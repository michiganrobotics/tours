// Global state
let currentWeekStart = new Date();
let tourRequests = [];
let tourGuides = [];
let scheduledTours = [];
let feedback = [];
let publicTours = [];
let publicRegistrations = [];

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

// Helper function to format time to AM/PM
function formatTimeToAMPM(time24) {
    if (!time24 || time24 === 'Time TBD' || time24 === 'TBD') {
        return 'Time TBD';
    }

    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${minutes} ${ampm}`;
}

// Helper functions for multiple guides
function parseGuideIds(guideIdsString) {
    if (!guideIdsString || guideIdsString.trim() === '') return [];
    return guideIdsString.split(',').map(id => id.trim()).filter(id => id);
}

function getMultipleGuideNames(guideIdsString) {
    const guideIds = parseGuideIds(guideIdsString);
    if (guideIds.length === 0) return 'Unassigned';

    const guides = guideIds.map(id => tourGuides.find(g => g.id == id)).filter(g => g);
    if (guides.length === 0) return 'Unassigned';
    if (guides.length === 1) return guides[0].name;
    if (guides.length === 2) return `${guides[0].name} and ${guides[1].name}`;

    const allButLast = guides.slice(0, -1).map(g => g.name).join(', ');
    return `${allButLast}, and ${guides[guides.length - 1].name}`;
}

// Show/hide completed tours preference (persisted per browser)
function toggleShowCompleted(which, checked) {
    localStorage.setItem(`showCompleted_${which}`, checked ? '1' : '');
    if (which === 'requests') {
        renderTourRequests();
    } else {
        renderPublicToursTable();
    }
}

function initShowCompletedToggles() {
    const reqBox = document.getElementById('showCompletedRequests');
    const pubBox = document.getElementById('showCompletedPublicTours');
    if (reqBox) reqBox.checked = !!localStorage.getItem('showCompleted_requests');
    if (pubBox) pubBox.checked = !!localStorage.getItem('showCompleted_publicTours');
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async function() {
    initShowCompletedToggles();

    // Check for error messages in URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const error = urlParams.get('error');
    const message = urlParams.get('message');
    
    if (error === 'access_denied') {
        const errorMessage = message || 'Access denied. You must be a member of the Robotics Tour Dashboard group to access this application. Contact robotics-tours@umich.edu if you believe you should have access.';
        showNotification('Access Denied', errorMessage, 'error');
        // Clear the error parameters from URL
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
    }
    
    // Skip authentication on localhost for development
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!isLocalhost) {
        // Check authentication before loading dashboard
        const authStatus = await checkAuthentication();
        if (!authStatus.authenticated) {
            // Redirect to login if not authenticated
            window.location.href = '/api/auth-login';
            return;
        }
        
        // Add user info to header if authenticated
        if (authStatus.user) {
            addUserInfoToHeader(authStatus.user);
        }
    }
    
    // Remove auth checking overlay and show content
    const authOverlay = document.getElementById('authOverlay');
    if (authOverlay) {
        authOverlay.remove();
    }
    document.body.classList.remove('auth-checking');
    
    setupTabs();
    
    // Show loading overlay
    showLoadingOverlay();
    
    try {
        await loadData();
        updateOverview();
    } finally {
        // Hide loading overlay whether successful or not
        hideLoadingOverlay();
    }
    
    // Check for hash in URL and switch to that tab
    const hash = window.location.hash.substring(1);
    if (hash) {
        switchToTab(hash);
    }
});


// Tab functionality
function setupTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.getAttribute('data-tab');
            switchToTab(tabName);
        });
    });
}

// Loading overlay functions
function showLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    const messageElement = document.getElementById('loadingMessage');
    
    // Sim City 2000-style loading messages
    const loadingMessages = [
        'Reticulating splines...',
        'Calibrating blue skies for Fly Lab...',
        'Counting backwards from infinity...',
        'Asking Kimberly...',
        'Warming up the robots...',
        'Convincing Jessy Grizzle to take another PhD...',
        'Checking with Denise...',
        'Bolting another thing on Cassie...',
        'Loading default robot demos...',
        'Calculating tour trajectories...',
        'Spinning up the jerboa wheels...',
        'Sorting robot and real dogs...',
        'Preparing tour guide briefings...',
        'Ensuring elevator beeps at maximum volume...',
        'Loading building blueprints...',
        'Synchronizing with every tour...',
        'Defragmenting the tour database...',
        'Optimizing demos to fail at precise time...',
        'Charging autonomous systems...',
        'Initializing visitor protocols...'
    ];
    
    if (overlay) {
        // Select random message
        const randomMessage = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
        if (messageElement) {
            messageElement.textContent = randomMessage;
        }
        overlay.classList.remove('hidden');
    }
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// Function to switch to a specific tab
function switchToTab(tabName) {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // Remove active classes from all tabs and contents
    tabButtons.forEach(btn => {
        btn.classList.remove('bg-white', 'text-purple-900');
        btn.classList.add('bg-white/20', 'hover:bg-white/30', 'text-white');
    });
    tabContents.forEach(content => {
        content.classList.add('hidden');
        content.classList.remove('block');
    });
    
    // Find and activate the target tab
    const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(tabName);
    
    if (targetButton && activeContent) {
        // Add active classes to target tab and corresponding content
        targetButton.classList.remove('bg-white/20', 'hover:bg-white/30', 'text-white');
        targetButton.classList.add('bg-white', 'text-purple-900');
        activeContent.classList.remove('hidden');
        activeContent.classList.add('block');
        
        // Update URL hash
        window.history.replaceState(null, null, `#${tabName}`);
        
        // Load tab-specific data
        loadTabData(tabName);
    }
}

// Load data from API
async function loadData() {
    try {
        const [requestsRes, guidesRes, publicToursRes, publicRegistrationsRes, feedbackRes] = await Promise.all([
            fetch('/api/tour-requests', { credentials: 'include' }),
            fetch('/api/tour-guides', { credentials: 'include' }),
            fetch('/api/public-tours', { credentials: 'include' }),
            fetch('/api/public-tour-registrations', { credentials: 'include' }),
            fetch('/api/feedback', { credentials: 'include' })
        ]);

        // Check each response and parse JSON with better error handling
        if (requestsRes.ok) {
            try {
                tourRequests = await requestsRes.json();
            } catch (e) {
                console.error('Error parsing tour requests JSON:', e);
                tourRequests = [];
            }
        } else {
            console.error('Tour requests API error:', requestsRes.status);
            tourRequests = [];
        }

        if (guidesRes.ok) {
            try {
                tourGuides = await guidesRes.json();
            } catch (e) {
                console.error('Error parsing tour guides JSON:', e);
                tourGuides = [];
            }
        } else {
            console.error('Tour guides API error:', guidesRes.status);
            tourGuides = [];
        }

        // Scheduled tours functionality removed (unused placeholder)
        scheduledTours = [];
        
        if (feedbackRes.ok) {
            try {
                feedback = await feedbackRes.json();
            } catch (e) {
                console.error('Error parsing feedback JSON:', e);
                feedback = [];
            }
        } else {
            console.error('Feedback API error:', feedbackRes.status);
            feedback = [];
        }

        if (publicToursRes.ok) {
            try {
                publicTours = await publicToursRes.json();
            } catch (e) {
                console.error('Error parsing public tours JSON:', e);
                publicTours = [];
            }
        } else {
            console.error('Public tours API error:', publicToursRes.status);
            publicTours = [];
        }

        if (publicRegistrationsRes.ok) {
            try {
                publicRegistrations = await publicRegistrationsRes.json();
            } catch (e) {
                console.error('Error parsing public registrations JSON:', e);
                publicRegistrations = [];
            }
        } else {
            console.error('Public registrations API error:', publicRegistrationsRes.status);
            publicRegistrations = [];
        }
    } catch (error) {
        console.error('Error loading data:', error);
        // Set default empty arrays
        tourRequests = [];
        tourGuides = [];
        scheduledTours = [];
        feedback = [];
        publicTours = [];
        publicRegistrations = [];
    }
}



// Load tab-specific data
function loadTabData(tabName) {
    switch(tabName) {
        case 'requests':
            renderTourRequests();
            break;
        case 'public-tours':
            renderPublicTours();
            break;
        case 'guides':
            renderTourGuides();
            break;
        case 'feedback':
            renderFeedback();
            break;
    }
}

// Update overview stats
async function updateOverview() {
    try {
        const analytics = await fetch('/api/analytics', { credentials: 'include' }).then(res => res.json());
        
        document.getElementById('totalRequests').textContent = analytics.totalRequests;
        
        // Calculate total visitors from all completed tours
        const totalVisitors = tourRequests
            .filter(r => r.status === 'completed' || r.status === 'scheduled')
            .reduce((sum, request) => sum + (parseInt(request.group_size) || 0), 0);
        document.getElementById('totalVisitors').textContent = totalVisitors;
        
        document.getElementById('pendingRequests').textContent = tourRequests.filter(r => r.status === 'pending').length;
        document.getElementById('completedRequests').textContent = tourRequests.filter(r => r.status === 'completed').length;
        document.getElementById('activeGuides').textContent = tourGuides.length;
        
        // Update upcoming tours and recent activity
        renderUpcomingTours();
        renderRecentActivity();
        
    } catch (error) {
        console.error('Error updating overview:', error);
    }
}

// Render upcoming tours
function renderUpcomingTours() {
    const container = document.getElementById('upcomingTours');

    // Get tours with dates today or in the future
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get upcoming scheduled tour requests
    const upcomingScheduledTours = tourRequests
        .filter(request => {
            if (request.status !== 'scheduled' || !request.preferred_date) return false;
            // Parse date in local timezone to avoid UTC conversion issues
            const [year, month, day] = request.preferred_date.split('-');
            const requestDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            return requestDate >= today;
        })
        .map(tour => ({
            ...tour,
            type: 'scheduled',
            date: tour.preferred_date,
            time: tour.preferred_time || 'Time TBD'
        }));

    // Get upcoming public tours
    const upcomingPublicTours = publicTours
        .filter(tour => {
            if (tour.status !== 'active' || !tour.date) return false;
            // Parse date in local timezone to avoid UTC conversion issues
            const [year, month, day] = tour.date.split('-');
            const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            return tourDate >= today;
        })
        .map(tour => ({
            ...tour,
            type: 'public',
            date: tour.date,
            time: tour.time || 'Time TBD'
        }));
    
    // Combine and sort all upcoming tours
    const allUpcomingTours = [...upcomingScheduledTours, ...upcomingPublicTours]
        .sort((a, b) => {
            // Parse dates in local timezone for comparison
            const getLocalDate = (dateStr) => {
                if (dateStr.includes('-')) {
                    const [year, month, day] = dateStr.split('-');
                    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                }
                return new Date(dateStr); // For preferred_date format
            };
            return getLocalDate(a.date) - getLocalDate(b.date);
        })
        .slice(0, 5); // Show only next 5 tours
    
    if (allUpcomingTours.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming tours scheduled</p>';
        return;
    }
    
    container.innerHTML = allUpcomingTours.map(tour => {
        // Parse date in local timezone to avoid UTC conversion issues
        const getLocalDate = (dateStr) => {
            if (dateStr.includes('-')) {
                const [year, month, day] = dateStr.split('-');
                return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            }
            return new Date(dateStr); // For preferred_date format
        };
        const tourDate = getLocalDate(tour.date);

        // Check if tour is today
        const isToday = tourDate.getFullYear() === today.getFullYear() &&
                        tourDate.getMonth() === today.getMonth() &&
                        tourDate.getDate() === today.getDate();

        const dateStr = tourDate.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
        });
        const timeStr = tour.time || 'Time TBD';

        if (tour.type === 'public') {
            // Public tour display
            const registrations = publicRegistrations.filter(reg => reg.public_tour_id === tour.id);
            const totalRegistered = registrations.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0);
            const spotsLeft = tour.capacity ? Math.max(0, tour.capacity - totalRegistered) : 'Unlimited';
            
            return `
                <div class="flex items-center justify-between p-3 bg-green-50 dark:bg-transparent rounded-lg border border-green-200 dark:border-blue-400">
                    <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-gray-100">
                            ${escapeHtml(tour.title || 'Public Tour')}
                            ${isToday ? '<span class="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200">TODAY</span>' : ''}
                        </div>
                        <div class="text-sm text-gray-600 dark:text-gray-300">${totalRegistered} registered • ${spotsLeft === 'Unlimited' ? 'Unlimited spots' : spotsLeft + ' spots left'}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <div class="font-medium text-green-600 dark:text-white">${dateStr}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-300">${escapeHtml(timeStr)}</div>
                        </div>
                        <button class="btn-secondary text-xs px-2 py-1" onclick="event.stopPropagation(); viewPublicTour(${tour.id});">View</button>
                    </div>
                </div>
            `;
        } else {
            // Scheduled tour request display
            const guideName = getMultipleGuideNames(tour.assigned_guide_id);
            
            return `
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div class="flex-1">
                        <div class="font-medium text-gray-900 dark:text-gray-100">
                            ${escapeHtml(tour.visitor_name)}
                            ${isToday ? '<span class="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-200">TODAY</span>' : ''}
                        </div>
                        <div class="text-sm text-gray-600 dark:text-gray-300">Group of ${escapeHtml(tour.group_size)} • ${escapeHtml(guideName)}</div>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <div class="font-medium text-blue-600 dark:text-white">${dateStr}</div>
                            <div class="text-sm text-gray-500 dark:text-gray-200">${escapeHtml(timeStr)}</div>
                        </div>
                        <button class="btn-secondary text-xs px-2 py-1" onclick="event.stopPropagation(); viewRequest(${tour.id});">View</button>
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Render recent activity
function renderRecentActivity() {
    const container = document.getElementById('recentActivity');
    
    // Combine tour requests, public tour registrations, and feedback
    const allActivities = [
        // Tour requests
        ...tourRequests.map(request => ({
            type: 'tour_request',
            id: request.id,
            name: request.visitor_name,
            email: request.visitor_email,
            group_size: request.group_size,
            status: request.status,
            created_at: request.created_at
        })),
        // Public tour registrations
        ...publicRegistrations.map(registration => {
            const tour = publicTours.find(t => t.id === registration.public_tour_id);
            return {
                type: 'public_registration',
                id: registration.id,
                name: registration.name,
                email: registration.email,
                group_size: registration.group_size,
                status: registration.status,
                created_at: registration.created_at,
                tour_date: tour ? tour.date : null,
                tour_title: tour ? tour.title : 'Public Tour'
            };
        }),
        // Feedback entries
        ...feedback.map(item => ({
            type: 'feedback',
            id: item.id,
            name: item.visitor_name,
            email: item.visitor_email,
            tour_type: item.tour_type,
            guide_name: item.guide_name,
            rating: item.overall_rating,
            nps_score: item.nps_score,
            created_at: item.submission_date || item.created_at
        }))
    ]
    .filter(activity => activity.created_at && !isNaN(new Date(activity.created_at)))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5); // Show last 5 activities
    
    if (allActivities.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No recent activity</p>';
        return;
    }
    
    container.innerHTML = allActivities.map(activity => {
        const createdDate = new Date(activity.created_at);
        const timeAgo = isNaN(createdDate.getTime()) ? 'Unknown time' : getTimeAgo(createdDate);
        
        let activityIcon, activityMessage, statusColor;
        
        if (activity.type === 'public_registration') {
            // Public tour registration
            activityIcon = '🎫';
            if (activity.status === 'registered') {
                activityMessage = `registered for ${escapeHtml(activity.tour_title)}`;
                statusColor = 'orange';
            } else {
                activityMessage = `registered for ${escapeHtml(activity.tour_title)}`;
                statusColor = 'green';
            }
            
            const tourDate = activity.tour_date ? new Date(activity.tour_date).toLocaleDateString() : '';
            
            return `
                <div class="flex items-start space-x-3 p-3 border border-gray-100 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div class="flex-shrink-0 text-lg">${activityIcon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm">
                            <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(activity.name)}</span>
                            <span class="text-gray-600 dark:text-gray-300">${activityMessage}</span>
                        </div>
                        <div class="flex items-center mt-1 space-x-2">
                            <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200">
                                Registered
                            </span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Group of ${escapeHtml(activity.group_size)}</span>
                            ${tourDate ? `<span class="text-xs text-gray-500 dark:text-gray-400">• ${tourDate}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        ${timeAgo}
                    </div>
                </div>
            `;
        } else if (activity.type === 'feedback') {
            // Feedback submission
            activityIcon = '⭐';
            const tourTypeText = activity.tour_type === 'public' ? 'public tour' : 'private tour';
            activityMessage = `submitted feedback for ${tourTypeText}`;
            statusColor = 'purple';
            
            return `
                <div class="flex items-start space-x-3 p-3 border border-gray-100 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div class="flex-shrink-0 text-lg">${activityIcon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm">
                            <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(activity.name)}</span>
                            <span class="text-gray-600 dark:text-gray-300">${activityMessage}</span>
                        </div>
                        <div class="flex items-center mt-1 space-x-2">
                            <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-200">
                                Feedback
                            </span>
                            ${activity.rating ? `<span class="text-xs text-gray-500 dark:text-gray-400">Rating: ${escapeHtml(activity.rating)}/10</span>` : ''}
                            ${activity.guide_name ? `<span class="text-xs text-gray-500 dark:text-gray-400">• Guide: ${escapeHtml(activity.guide_name)}</span>` : ''}
                        </div>
                    </div>
                    <div class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        ${timeAgo}
                    </div>
                </div>
            `;
        } else {
            // Regular tour request
            switch(activity.status) {
                case 'pending':
                    activityIcon = '⏳';
                    activityMessage = 'submitted a tour request';
                    statusColor = 'yellow';
                    break;
                case 'scheduled':
                    activityIcon = '✅';
                    activityMessage = 'tour was scheduled';
                    statusColor = 'blue';
                    break;
                case 'completed':
                    activityIcon = '🎉';
                    activityMessage = 'completed their tour';
                    statusColor = 'green';
                    break;
                case 'cancelled':
                    activityIcon = '❌';
                    activityMessage = 'tour was cancelled';
                    statusColor = 'red';
                    break;
                default:
                    activityIcon = '📝';
                    activityMessage = 'submitted a tour request';
                    statusColor = 'gray';
            }
            
            return `
                <div class="flex items-start space-x-3 p-3 border border-gray-100 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div class="flex-shrink-0 text-lg">${activityIcon}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm">
                            <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(activity.name)}</span>
                            <span class="text-gray-600 dark:text-gray-300">${activityMessage}</span>
                        </div>
                        <div class="flex items-center mt-1 space-x-2">
                            <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(activity.status).classes}">
                                ${escapeHtml(activity.status.charAt(0).toUpperCase() + activity.status.slice(1))}
                            </span>
                            <span class="text-xs text-gray-500 dark:text-gray-400">Group of ${escapeHtml(activity.group_size)}</span>
                        </div>
                    </div>
                    <div class="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                        ${timeAgo}
                    </div>
                </div>
            `;
        }
    }).join('');
}

// Helper function to get "time ago" string
function getTimeAgo(date) {
    // Check if date is valid
    if (!date || isNaN(date.getTime())) {
        return 'Unknown time';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInSeconds < 3600) {
        const minutes = Math.floor(diffInSeconds / 60);
        return `${minutes}m ago`;
    } else if (diffInSeconds < 86400) {
        const hours = Math.floor(diffInSeconds / 3600);
        return `${hours}h ago`;
    } else if (diffInSeconds < 604800) {
        const days = Math.floor(diffInSeconds / 86400);
        return `${days}d ago`;
    } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
}


// Render tour requests
function renderTourRequests() {
    const tbody = document.querySelector('#requestsTable tbody');
    const statusFilter = document.getElementById('statusFilter');
    const sortFilter = document.getElementById('sortFilter');

    let filteredRequests = tourRequests;
    if (statusFilter.value) {
        filteredRequests = tourRequests.filter(req => req.status === statusFilter.value);
    } else if (!document.getElementById('showCompletedRequests')?.checked) {
        // Completed requests are hidden by default; reveal them with the
        // "Show completed" checkbox or by selecting the Completed status filter
        filteredRequests = tourRequests.filter(req => req.status !== 'completed');
    }

    // Sort requests based on selected sort option
    const sortBy = sortFilter ? sortFilter.value : 'preferred_date';
    filteredRequests = [...filteredRequests].sort((a, b) => {
        if (sortBy === 'preferred_date') {
            // Sort by preferred date (newest first, oldest last)
            // Handle "Flexible" dates by putting them at the end
            if (!a.preferred_date) return 1;
            if (!b.preferred_date) return -1;
            return new Date(b.preferred_date) - new Date(a.preferred_date);
        } else if (sortBy === 'created_at') {
            // Sort by date requested (newest first)
            return new Date(b.created_at) - new Date(a.created_at);
        } else if (sortBy === 'status') {
            // Sort by status alphabetically
            const statusOrder = { 'pending': 1, 'scheduled': 2, 'completed': 3, 'cancelled': 4 };
            return (statusOrder[a.status] || 999) - (statusOrder[b.status] || 999);
        }
        return 0;
    });

    if (!filteredRequests || filteredRequests.length === 0) {
        const message = statusFilter.value ?
            `No tour requests with status "${statusFilter.options[statusFilter.selectedIndex].text}"` :
            'No tour requests yet';
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 dark:text-gray-400 py-8">${message}</td></tr>`;
        return;
    }

    tbody.innerHTML = filteredRequests.map(request => `
        <tr>
            <td>${new Date(request.created_at).toLocaleDateString()}</td>
            <td>${escapeHtml(request.visitor_name)}</td>
            <td>${escapeHtml(request.visitor_email)}</td>
            <td>${escapeHtml(request.group_size)}</td>
            <td>${escapeHtml(request.preferred_date || 'Flexible')}</td>
            <td>
                ${request.status === 'scheduled' || request.status === 'completed' ? `
                    <div class="guide-selector-cell" id="guide-selector-${request.id}">
                        ${renderGuideSelector(request.id, request.assigned_guide_id)}
                    </div>
                ` : `
                    <span class="text-gray-500 dark:text-gray-300 text-sm">Schedule tour first →</span>
                `}
            </td>
            <td>
                <select class="status-dropdown" data-request-id="${request.id}" onchange="updateRequestStatusFromDropdown(${request.id}, this.value)">
                    <option value="pending" ${request.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="scheduled" ${request.status === 'scheduled' ? 'selected' : ''}>Scheduled</option>
                    <option value="completed" ${request.status === 'completed' ? 'selected' : ''}>Completed</option>
                    <option value="cancelled" ${request.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                <div class="flex gap-1">
                    <button class="btn-secondary text-xs px-3 py-1" onclick="event.stopPropagation(); viewRequest(${request.id});">View</button>
                    <button class="btn-secondary text-xs px-3 py-1" onclick="event.stopPropagation(); editRequest(${request.id});">Edit</button>
                </div>
            </td>
        </tr>
    `).join('');

    // Add filter event listeners
    statusFilter.removeEventListener('change', renderTourRequests);
    statusFilter.addEventListener('change', renderTourRequests);
    if (sortFilter) {
        sortFilter.removeEventListener('change', renderTourRequests);
        sortFilter.addEventListener('change', renderTourRequests);
    }
}

// Render tour guides
function renderTourGuides() {
    const container = document.getElementById('guidesGrid');
    
    container.innerHTML = tourGuides.map(guide => {
        // Handle availability - could be string or array
        let availability = [];
        if (typeof guide.availability === 'string') {
            availability = guide.availability.split(',').filter(s => s.trim());
        } else if (Array.isArray(guide.availability)) {
            availability = guide.availability;
        }
        
        return `
            <div class="guide-card">
                <div class="flex justify-between items-start mb-2">
                    <h3>${escapeHtml(guide.name)}</h3>
                    <div class="flex gap-2">
                        <button class="btn-secondary text-xs px-3 py-1" onclick="editGuide(${guide.id})">Edit</button>
                    </div>
                </div>
                <p class="text-xs text-gray-600 dark:text-gray-300 mb-2">Only a guide's name is shared with visitors</p>
                <p><strong>Email:</strong> ${escapeHtml(guide.email)}</p>
                <p><strong>Phone:</strong> ${escapeHtml(guide.phone || 'Not provided')}</p>
                <p style="margin-top: 1rem;"><strong>Availability:</strong></p>
                <p class="text-sm text-gray-600 dark:text-gray-300">${escapeHtml(availability.join(', ') || 'Not specified')}</p>
            </div>
        `;
    }).join('');
}

// Render guide selector with multi-select support.
// pending: { type: 'add', name } or { type: 'remove', id } shows an
// in-flight saving state and disables further changes until it resolves.
function renderGuideSelector(requestId, currentGuideIds, pending) {
    const selectedIds = parseGuideIds(currentGuideIds);
    const availableGuides = tourGuides.filter(g => !selectedIds.includes(String(g.id)));
    const spinner = '<span class="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>';

    return `
        <div class="flex flex-wrap gap-1 items-center">
            ${selectedIds.map(id => {
                const guide = tourGuides.find(g => g.id == id);
                if (!guide) return '';
                const removing = pending && pending.type === 'remove' && pending.id === id;
                return `
                    <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs${removing ? ' opacity-50' : ''}">
                        ${escapeHtml(guide.name)}
                        ${removing ? spinner : `<button onclick="removeGuide(${requestId}, '${id}')" ${pending ? 'disabled' : ''} class="hover:text-red-600 dark:hover:text-red-400 font-bold">×</button>`}
                    </span>
                `;
            }).join('')}
            ${pending && pending.type === 'add' ? `
                <span class="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs opacity-50">
                    ${escapeHtml(pending.name)}
                    ${spinner}
                </span>
            ` : ''}
            <select class="text-xs px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600" ${pending ? 'disabled' : ''} onchange="addGuide(${requestId}, this.value); this.value='';">
                <option value="">${pending ? 'Saving...' : '+ Add guide'}</option>
                ${availableGuides.map(g => `
                    <option value="${g.id}">${escapeHtml(g.name)}</option>
                `).join('')}
            </select>
        </div>
    `;
}

// Add guide to request
async function addGuide(requestId, guideId) {
    if (!guideId) return;

    const selector = document.getElementById(`guide-selector-${requestId}`);
    const request = tourRequests.find(r => r.id == requestId);

    try {
        const currentIds = parseGuideIds(request.assigned_guide_id);

        if (!currentIds.includes(String(guideId))) {
            const guide = tourGuides.find(g => g.id == guideId);

            // Show saving state while the server writes and sends emails
            if (selector) {
                selector.innerHTML = renderGuideSelector(requestId, request.assigned_guide_id, { type: 'add', name: guide ? guide.name : 'Guide' });
            }

            currentIds.push(String(guideId));
            const newGuideIds = currentIds.join(',');

            const response = await fetch('/api/assign-guide', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({
                    request_id: String(requestId),
                    assigned_guide_id: newGuideIds
                })
            });

            if (response.ok) {
                request.assigned_guide_id = newGuideIds;
                showNotification('Guide Added', `${guide.name} added to tour`, 'success');

                // Re-render just this selector
                if (selector) {
                    selector.innerHTML = renderGuideSelector(requestId, newGuideIds);
                }
            } else {
                showNotification('Error', 'Failed to add guide', 'error');
                if (selector) {
                    selector.innerHTML = renderGuideSelector(requestId, request.assigned_guide_id);
                }
            }
        }
    } catch (error) {
        console.error('Error adding guide:', error);
        showNotification('Error', 'Failed to add guide', 'error');
        if (selector && request) {
            selector.innerHTML = renderGuideSelector(requestId, request.assigned_guide_id);
        }
    }
}

// Remove guide from request
async function removeGuide(requestId, guideIdToRemove) {
    const selector = document.getElementById(`guide-selector-${requestId}`);
    const request = tourRequests.find(r => r.id == requestId);

    try {
        const currentIds = parseGuideIds(request.assigned_guide_id);
        const newIds = currentIds.filter(id => id !== String(guideIdToRemove));
        const newGuideIds = newIds.join(',');

        // Show saving state while the server writes and sends emails
        if (selector) {
            selector.innerHTML = renderGuideSelector(requestId, request.assigned_guide_id, { type: 'remove', id: String(guideIdToRemove) });
        }

        const response = await fetch('/api/assign-guide', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({
                request_id: String(requestId),
                assigned_guide_id: newGuideIds || null
            })
        });

        if (response.ok) {
            request.assigned_guide_id = newGuideIds || null;
            const guide = tourGuides.find(g => g.id == guideIdToRemove);
            showNotification('Guide Removed', `${guide.name} removed from tour`, 'info');

            // Re-render just this selector
            if (selector) {
                selector.innerHTML = renderGuideSelector(requestId, newGuideIds);
            }
        } else {
            showNotification('Error', 'Failed to remove guide', 'error');
            if (selector) {
                selector.innerHTML = renderGuideSelector(requestId, request.assigned_guide_id);
            }
        }
    } catch (error) {
        console.error('Error removing guide:', error);
        showNotification('Error', 'Failed to remove guide', 'error');
        if (selector && request) {
            selector.innerHTML = renderGuideSelector(requestId, request.assigned_guide_id);
        }
    }
}

// Legacy function - kept for backward compatibility
async function assignGuideToRequest(requestId, guideId) {
    try {
        const response = await fetch(`/api/assign-guide`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({request_id: String(requestId), assigned_guide_id: guideId ? String(guideId) : null})
        });

        if (response.ok) {
            const request = tourRequests.find(r => r.id == requestId);
            const guide = tourGuides.find(g => g.id == guideId);

            if (request) {
                request.assigned_guide_id = guideId || null;
            }

            if (guideId && guide) {
                showNotification('Guide Assigned', `${guide.name} assigned - emails sent to guide and visitor`, 'success');
            } else {
                showNotification('Guide Unassigned', 'Tour guide has been removed from the request', 'info');
            }

            console.log(`Guide assigned to request ${requestId}`);
        } else {
            console.error('Failed to assign guide');
            await loadData();
            renderTourRequests();
        }
    } catch (error) {
        console.error('Error assigning guide:', error);
        await loadData();
        renderTourRequests();
    }
}

// Update request status from dropdown
async function updateRequestStatusFromDropdown(id, newStatus) {
    try {
        const response = await fetch(`/api/tour-requests`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify({id: String(id), status: newStatus})
        });
        
        
        if (response.ok) {
            // Update local data
            const request = tourRequests.find(r => r.id == id);
            if (request) {
                const oldStatus = request.status;
                request.status = newStatus;
                
                // Show appropriate notification based on status change
                const statusMessages = {
                    'scheduled': 'Tour scheduled - ready for guide assignment',
                    'completed': 'Tour marked as completed',
                    'cancelled': 'Tour request cancelled',
                    'pending': 'Tour request marked as pending'
                };
                
                if (statusMessages[newStatus]) {
                    const notificationType = newStatus === 'cancelled' ? 'warning' : 'success';
                    showNotification('Status Updated', statusMessages[newStatus], notificationType);
                }
            }
            
            // Re-render the table to update guide dropdown visibility
            renderTourRequests();
            
            // Update overview stats
            updateOverview();
            
            console.log(`Status updated to: ${newStatus}`);
        } else {
            console.error('Failed to update status');
            // Revert dropdown to original value
            await loadData();
            renderTourRequests();
        }
    } catch (error) {
        console.error('Error updating status:', error);
        // Revert dropdown to original value
        await loadData();
        renderTourRequests();
    }
}

// Modal functions
function showNewRequestForm() {
    document.getElementById('newRequestModal').classList.remove('hidden');
}

function showNewGuideForm() {
    document.getElementById('newGuideModal').style.display = 'block';
}


function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('block');
        modal.style.display = 'none';
        
        // Reset button states when closing modals
        if (modalId === 'newRequestModal') {
            setSubmissionState(false);
        } else if (modalId === 'newPublicTourModal') {
            const submitBtn = document.getElementById('schedulePublicTourBtn');
            const btnText = document.getElementById('schedulePublicTourBtnText');
            const spinner = document.getElementById('schedulePublicTourSpinner');
            
            if (submitBtn && btnText && spinner) {
                submitBtn.disabled = false;
                btnText.textContent = 'Schedule Tour';
                spinner.classList.add('hidden');
                spinner.classList.remove('inline');
            }
        }
        
        
        // Clear any forms in the modal to ensure clean state
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => {
            if (form && typeof form.reset === 'function') {
                form.reset();
            }
        });
    }
}

// Notification system
function showNotification(title, message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = document.getElementById('notification-icon');
    const titleEl = document.getElementById('notification-title');
    const messageEl = document.getElementById('notification-message');
    
    // Set content
    titleEl.textContent = title;
    messageEl.textContent = message;
    
    // Set icon and colors based on type
    if (type === 'success') {
        icon.innerHTML = '<svg class="w-5 h-5 text-green-700 dark:text-green-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"></path></svg>';
        icon.className = 'w-5 h-5 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/50';
    } else if (type === 'error') {
        icon.innerHTML = '<svg class="w-5 h-5 text-red-700 dark:text-red-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"></path></svg>';
        icon.className = 'w-5 h-5 rounded-full flex items-center justify-center bg-red-100 dark:bg-red-900/50';
    } else if (type === 'warning') {
        icon.innerHTML = '<svg class="w-5 h-5 text-orange-700 dark:text-orange-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"></path></svg>';
        icon.className = 'w-5 h-5 rounded-full flex items-center justify-center bg-orange-100 dark:bg-orange-900/50';
    } else if (type === 'info') {
        icon.innerHTML = '<svg class="w-5 h-5 text-blue-700 dark:text-blue-200" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path></svg>';
        icon.className = 'w-5 h-5 rounded-full flex items-center justify-center bg-blue-100 dark:bg-blue-900/50';
    }
    
    // Show notification
    notification.classList.remove('hidden', 'translate-x-full');
    notification.classList.add('translate-x-0');
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        hideNotification();
    }, 5000);
}

function hideNotification() {
    const notification = document.getElementById('notification');
    notification.classList.remove('translate-x-0');
    notification.classList.add('translate-x-full');
    // Add hidden class after animation completes
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 300);
}

// Form submission state management
let isSubmitting = false;

function setSubmissionState(submitting) {
    isSubmitting = submitting;
    const button = document.getElementById('submitButton');
    const buttonText = document.getElementById('submitButtonText');
    const spinner = document.getElementById('submitButtonSpinner');
    
    if (submitting) {
        button.disabled = true;
        buttonText.textContent = 'Submitting...';
        spinner.classList.remove('hidden');
        spinner.classList.add('inline');
    } else {
        button.disabled = false;
        buttonText.textContent = 'Submit request';
        spinner.classList.add('hidden');
        spinner.classList.remove('inline');
    }
}

// Form submissions
document.getElementById('newRequestForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) {
        return;
    }
    
    setSubmissionState(true);
    
    const formData = new FormData(e.target);
    
    // Check if bot field is filled (spam protection)
    if (formData.get('bot-field')) {
        setSubmissionState(false);
        return; // Silent fail for bots
    }
    
    const data = Object.fromEntries(formData.entries());
    
    // Convert checkbox values from "on" to boolean
    data.tshirt_request = data.tshirt_request === 'on';
    data.newsletter_signup = data.newsletter_signup === 'on';
    
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
            showNotification('Error', 'Please select at least one t-shirt size or uncheck the t-shirt request option.', 'error');
            setSubmissionState(false);
            return;
        }
        
        // Validate maximum t-shirt quantity limit
        if (data.tshirt_total > 20) {
            showNotification('Error', 'Total t-shirt quantity cannot exceed 20. For larger orders, please visit our online store at https://www.aatwebstore.com/UMBOT/shop/home', 'error');
            setSubmissionState(false);
            return;
        }
    }
    
    try {
        // Submit to our API only (credentials identify the admin session,
        // which exempts this form from the public reCAPTCHA requirement)
        const apiResponse = await fetch('/api/tour-requests', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (apiResponse.ok) {
            setSubmissionState(false);
            closeModal('newRequestModal');
            await loadData();
            updateOverview();
            renderTourRequests();
            e.target.reset();
            
            // Show success notification
            showNotification(
                'Request Submitted!', 
                'Thank you for your tour request! You will receive a confirmation email shortly.',
                'success'
            );
        } else {
            showNotification(
                'Submission Failed', 
                'There was an error submitting your request. Please try again.',
                'error'
            );
        }
    } catch (error) {
        console.error('Error submitting request:', error);
        showNotification(
            'Submission Error', 
            'There was an error submitting your request. Please try again.',
            'error'
        );
    } finally {
        setSubmissionState(false);
    }
});

document.getElementById('newGuideForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch('/api/tour-guides', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('newGuideModal');
            await loadData();
            updateOverview();
            renderTourGuides();
            e.target.reset();
        }
    } catch (error) {
        console.error('Error adding guide:', error);
    }
});

document.getElementById('editRequestForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch('/api/tour-requests', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('editRequestModal');
            await loadData();
            renderTourRequests();
            updateOverview();
            showNotification('Success', 'Tour request updated successfully', 'success');
        } else {
            showNotification('Error', 'Failed to update tour request', 'error');
        }
    } catch (error) {
        console.error('Error updating request:', error);
        showNotification('Error', 'Failed to update tour request', 'error');
    }
});

document.getElementById('editGuideForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    try {
        const response = await fetch('/api/tour-guides', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('editGuideModal');
            await loadData();
            renderTourGuides();
            updateOverview();
            showNotification('Success', 'Tour guide updated successfully', 'success');
        } else {
            showNotification('Error', 'Failed to update tour guide', 'error');
        }
    } catch (error) {
        console.error('Error updating guide:', error);
        showNotification('Error', 'Failed to update tour guide', 'error');
    }
});

document.getElementById('newPublicTourForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    // Disable submit button and show spinner
    const submitBtn = document.getElementById('schedulePublicTourBtn');
    const btnText = document.getElementById('schedulePublicTourBtnText');
    const spinner = document.getElementById('schedulePublicTourSpinner');
    
    submitBtn.disabled = true;
    btnText.textContent = 'Scheduling...';
    spinner.classList.remove('hidden');
    spinner.classList.add('inline');
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Handle multiple guide selection - convert to comma-separated IDs
    const guideSelect = document.getElementById('newPublicTourGuide');
    const selectedGuides = Array.from(guideSelect.selectedOptions).map(opt => opt.value);
    data.assigned_guide_id = selectedGuides.join(',');

    // Keep time in 24-hour format (consistent with special tours)
    console.log('Creating tour with 24-hour time format:', data.time);

    try {
        const response = await fetch('/api/public-tours', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            // Re-enable submit button and hide spinner before closing modal
            submitBtn.disabled = false;
            btnText.textContent = 'Schedule Tour';
            spinner.classList.add('hidden');
            spinner.classList.remove('inline');
            
            closeModal('newPublicTourModal');
            await loadData();
            renderPublicTours();
            e.target.reset();
            showNotification('Success', 'Public tour scheduled successfully', 'success');
        } else {
            showNotification('Error', 'Failed to schedule public tour', 'error');
        }
    } catch (error) {
        console.error('Error creating public tour:', error);
        showNotification('Error', 'Failed to schedule public tour', 'error');
    } finally {
        // Re-enable submit button and hide spinner
        submitBtn.disabled = false;
        btnText.textContent = 'Schedule Tour';
        spinner.classList.add('hidden');
        spinner.classList.remove('inline');
    }
});

document.getElementById('editPublicTourForm').addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());

    // Handle multiple guide selection - convert to comma-separated IDs
    const guideSelect = document.getElementById('editPublicTourGuide');
    const selectedGuides = Array.from(guideSelect.selectedOptions).map(opt => opt.value);
    data.assigned_guide_id = selectedGuides.join(',');

    // Keep time in 24-hour format (consistent with special tours)
    console.log('Editing tour with 24-hour time format:', data.time);

    try {
        const response = await fetch('/api/public-tours', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            credentials: 'include',
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            closeModal('editPublicTourModal');
            try {
                await loadData();
                renderPublicTours();
                showNotification('Success', 'Public tour updated successfully', 'success');
            } catch (error) {
                console.error('Error after updating public tour:', error);
                showNotification('Warning', 'Tour updated but there was an issue refreshing the display', 'warning');
            }
        } else {
            showNotification('Error', 'Failed to update public tour', 'error');
        }
    } catch (error) {
        console.error('Error updating public tour:', error);
        showNotification('Error', 'Failed to update public tour', 'error');
    }
});


// Helper functions
function editRequest(id) {
    const request = tourRequests.find(r => r.id == id);
    if (request) {
        document.getElementById('editRequestId').value = request.id;
        document.getElementById('editVisitorName').value = request.visitor_name;
        document.getElementById('editVisitorEmail').value = request.visitor_email;
        document.getElementById('editVisitorPhone').value = request.visitor_phone || '';
        document.getElementById('editGroupSize').value = request.group_size;
        document.getElementById('editPreferredDate').value = request.preferred_date || '';
        document.getElementById('editPreferredTime').value = request.preferred_time || '';
        document.getElementById('editAdditionalInfo').value = request.additional_info || '';
        
        // Ensure modal is properly displayed with clean state
        const modal = document.getElementById('editRequestModal');
        // Force clean state before showing
        modal.style.display = 'none';
        modal.classList.add('hidden');
        modal.classList.remove('block');
        
        // Now show the modal
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.classList.add('block');
            modal.style.display = 'block';
        }, 50);
    }
}

function editGuide(id) {
    const guide = tourGuides.find(g => g.id == id);
    if (guide) {
        document.getElementById('editGuideId').value = guide.id;
        document.getElementById('editGuideName').value = guide.name;
        document.getElementById('editGuideEmail').value = guide.email;
        document.getElementById('editGuidePhone').value = guide.phone || '';
        document.getElementById('editGuideAvailability').value = Array.isArray(guide.availability) ? guide.availability.join(', ') : (guide.availability || '');
        
        document.getElementById('editGuideModal').style.display = 'block';
    }
}

async function deleteGuide(id) {
    const guide = tourGuides.find(g => g.id == id);
    if (!guide) {
        console.error('Guide not found for ID:', id);
        return;
    }
    
    if (confirm(`Are you sure you want to delete guide "${guide.name}"? This action cannot be undone.`)) {
        try {
            const response = await fetch('/api/tour-guides', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({id: String(id)})
            });
            
            if (response.ok) {
                // Remove from local data
                const index = tourGuides.findIndex(g => g.id == id);
                if (index > -1) {
                    tourGuides.splice(index, 1);
                }
                
                // Re-render guides
                renderTourGuides();
                
                showNotification('Success', `Guide "${guide.name}" deleted successfully`, 'success');
            } else {
                showNotification('Error', 'Failed to delete guide', 'error');
            }
        } catch (error) {
            console.error('Error deleting guide:', error);
            showNotification('Error', 'Failed to delete guide', 'error');
        }
    }
}

async function deleteGuideFromModal() {
    const guideId = document.getElementById('editGuideId').value;
    const guideName = document.getElementById('editGuideName').value;
    
    if (confirm(`Are you sure you want to delete guide "${guideName}"? This action cannot be undone.`)) {
        try {
            const response = await fetch('/api/tour-guides', {
                method: 'DELETE',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({id: String(guideId)})
            });
            
            if (response.ok) {
                // Remove from local data
                const index = tourGuides.findIndex(g => g.id == guideId);
                if (index > -1) {
                    tourGuides.splice(index, 1);
                }
                
                // Close modal and re-render guides
                closeModal('editGuideModal');
                renderTourGuides();
                
                showNotification('Success', `Guide "${guideName}" deleted successfully`, 'success');
            } else {
                showNotification('Error', 'Failed to delete guide', 'error');
            }
        } catch (error) {
            console.error('Error deleting guide:', error);
            showNotification('Error', 'Failed to delete guide', 'error');
        }
    }
}

// Friendly labels for Email Log entry types
const EMAIL_TYPE_LABELS = {
    request_confirmation: 'Request confirmation (visitor)',
    request_notification: 'New request notification (tours team)',
    visitor_scheduled: 'Tour scheduled (visitor)',
    guide_assignment: 'Guide assignment (guide)',
    guide_removed: 'Guide removed (guide)',
    registration_confirmation: 'Registration confirmation (visitor)',
    visitor_reminder: 'Day-before reminder (visitor)',
    guide_reminder: 'Day-before reminder (guide)',
    feedback_request: 'Feedback request (visitor)',
    tour_cancelled_guide: 'Cancellation notice (guide)'
};

// Fetch and render the email history for a tour into a modal section
async function loadEmailHistory(tourId, tourType, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    try {
        const response = await fetch(`/api/email-log?tour_id=${encodeURIComponent(tourId)}&tour_type=${encodeURIComponent(tourType)}`, {
            credentials: 'include'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const entries = await response.json();

        if (!entries.length) {
            container.innerHTML = `
                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Emails sent</label>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">No emails recorded for this tour yet</p>
            `;
            return;
        }

        const rows = entries.map(e => `
            <div class="flex flex-wrap items-baseline gap-x-2 py-1 border-b border-gray-100 dark:border-gray-700 last:border-0 text-sm">
                <span class="text-gray-500 dark:text-gray-400 whitespace-nowrap">${e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}</span>
                <span class="text-gray-900 dark:text-gray-100">${escapeHtml(EMAIL_TYPE_LABELS[e.email_type] || e.email_type)}</span>
                <span class="text-gray-500 dark:text-gray-400">→ ${escapeHtml(e.recipient)}</span>
            </div>
        `).join('');

        container.innerHTML = `
            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Emails sent</label>
            <div class="mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg max-h-40 overflow-y-auto">${rows}</div>
        `;
    } catch (error) {
        console.error('Error loading email history:', error);
        container.innerHTML = `
            <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Emails sent</label>
            <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Could not load email history</p>
        `;
    }
}

function viewRequest(id) {
    const request = tourRequests.find(r => r.id == id);
    if (request) {
        const content = document.getElementById('requestDetailsContent');
        
        // Get assigned guide name
        const guideName = getMultipleGuideNames(request.assigned_guide_id);
        
        // Build t-shirt section
        let tshirtSection = '';
        if (request.tshirt_request && request.tshirt_total > 0) {
            const sizes = Object.entries(request.tshirt_sizes || {})
                .filter(([size, qty]) => qty > 0)
                .map(([size, qty]) => `${escapeHtml(size.toUpperCase())}: ${escapeHtml(qty)}`)
                .join(', ');

            tshirtSection = `
                <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/50">
                    <h4 class="font-semibold mb-2 text-[#2F65A7] dark:text-blue-200">🎽 T-Shirt Order</h4>
                    <p class="text-[#00274C] dark:text-gray-100">Total: ${escapeHtml(request.tshirt_total)} shirts ($${escapeHtml(request.tshirt_cost)})</p>
                    <p class="text-sm text-[#2F65A7] dark:text-blue-200">Sizes: ${sizes}</p>
                </div>
            `;
        }
        
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Visitor Name</label>
                        <p class="text-gray-900 dark:text-gray-100 font-medium">${escapeHtml(request.visitor_name)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(request.visitor_email)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Phone</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(request.visitor_phone || 'Not provided')}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Group Size</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(request.group_size)}</p>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Preferred Date</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(request.preferred_date || 'Flexible')}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Preferred Time</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(request.preferred_time || 'Flexible')}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned Guide</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(guideName)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(request.status).classes}">
                            ${escapeHtml(request.status.charAt(0).toUpperCase() + request.status.slice(1))}
                        </span>
                    </div>
                </div>
            </div>
            
            ${request.additional_info ? `
                <div class="mt-6">
                    <label class="text-sm font-medium text-gray-500">Additional Information</label>
                    <p class="text-gray-900 dark:text-gray-100 mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">${escapeHtml(request.additional_info)}</p>
                </div>
            ` : ''}
            
            ${tshirtSection}
            
            ${request.newsletter_signup ? `
                <div class="mt-4 p-3 rounded-lg bg-green-50 dark:bg-green-900/50">
                    <p class="text-sm text-green-700 dark:text-green-200">📧 Signed up for quarterly newsletter</p>
                </div>
            ` : ''}
            
            <div class="mt-6" id="requestEmailHistory">
                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Emails sent</label>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Loading...</p>
            </div>

            <div class="mt-6 text-xs text-gray-500">
                Submitted: ${new Date(request.created_at).toLocaleString()}
            </div>
        `;

        loadEmailHistory(request.id, 'private', 'requestEmailHistory');

        // Ensure modal is properly shown with clean state
        const modal = document.getElementById('requestDetailsModal');
        // Force clean state before showing
        modal.style.display = 'none';
        modal.classList.add('hidden');
        modal.classList.remove('block');
        
        // Now show the modal
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.classList.add('block');
            modal.style.display = 'block';
        }, 50);
    }
}

function getStatusColor(status) {
    const colors = {
        'pending': { classes: 'bg-yellow-400 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' },
        'scheduled': { classes: 'bg-blue-400 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' },
        'completed': { classes: 'bg-green-400 dark:bg-green-900/50 text-green-800 dark:text-green-200' },
        'cancelled': { classes: 'bg-red-400 dark:bg-red-900/50 text-red-800 dark:text-red-200' }
    };
    return colors[status] || { classes: 'bg-gray-400 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200' };
}


// Email workflow accordion toggle function
function toggleEmailWorkflow() {
    const content = document.getElementById('emailWorkflowContent');
    const icon = document.getElementById('emailWorkflowIcon');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(-90deg)';
    }
}

function togglePublicTourEmailWorkflow() {
    const content = document.getElementById('publicTourEmailWorkflowContent');
    const icon = document.getElementById('publicTourEmailWorkflowIcon');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(-90deg)';
    }
}

// Public Tours Management Functions
function renderPublicTours() {
    renderUpcomingPublicTours();
    renderPublicTourStats();
    renderPublicToursTable();
}

function renderUpcomingPublicTours() {
    const container = document.getElementById('upcomingPublicTours');
    
    if (!publicTours || publicTours.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming public tours scheduled</p>';
        return;
    }
    
    // Get upcoming public tours (next 5)
    const now = new Date();
    const upcoming = publicTours
        .filter(tour => {
            if (tour.status !== 'active' || !tour.date) return false;
            // Parse date in local timezone to avoid UTC conversion issues
            const [year, month, day] = tour.date.split('-');
            const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
            return tourDate >= now;
        })
        .sort((a, b) => {
            // Parse dates in local timezone for comparison
            const [yearA, monthA, dayA] = a.date.split('-');
            const [yearB, monthB, dayB] = b.date.split('-');
            const dateA = new Date(parseInt(yearA), parseInt(monthA) - 1, parseInt(dayA));
            const dateB = new Date(parseInt(yearB), parseInt(monthB) - 1, parseInt(dayB));
            return dateA - dateB;
        })
        .slice(0, 5);
    
    if (upcoming.length === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-400 text-center py-4">No upcoming public tours scheduled</p>';
        return;
    }
    
    container.innerHTML = upcoming.map(tour => {
        // Parse date in local timezone to avoid UTC conversion issues
        const [year, month, day] = tour.date.split('-');
        const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const dateStr = tourDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        const timeStr = formatTimeToAMPM(tour.time);
        const totalRegistered = tour.registrations?.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0) || 0;
        const spotsLeft = tour.capacity - totalRegistered;
        
        return `
            <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <div class="flex-1">
                    <div class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(tour.title || 'Public Tour')}</div>
                    <div class="text-sm text-gray-600 dark:text-gray-300">
                        ${spotsLeft > 0 ? `${spotsLeft} spots left` : 'Full'} 
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <div class="text-right">
                        <div class="font-medium text-orange-600 dark:text-blue-400">${dateStr}</div>
                        <div class="text-sm text-gray-500 dark:text-gray-200">${escapeHtml(timeStr)}</div>
                    </div>
                    <button class="btn-secondary text-xs px-2 py-1" onclick="viewPublicTour(${tour.id})">View</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderPublicTourStats() {
    const container = document.getElementById('publicTourStats');
    
    const totalTours = publicTours.length;
    const activeTours = publicTours.filter(t => t.status === 'active').length;
    const totalRegistrations = publicTours.reduce((sum, tour) => sum + (tour.registrations?.length || 0), 0);
    
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-4">
            <div class="text-center">
                <div class="text-2xl font-bold text-teal-600">${activeTours}</div>
                <div class="text-sm text-gray-600 dark:text-gray-200">Active Tours</div>
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">${totalRegistrations}</div>
                <div class="text-sm text-gray-600 dark:text-gray-200">Total Registrations</div>
            </div>
            <div class="text-center">
            </div>
            <div class="text-center">
                <div class="text-2xl font-bold text-purple-600">${totalTours}</div>
                <div class="text-sm text-gray-600 dark:text-gray-200">Total Tours</div>
            </div>
        </div>
    `;
}

function renderPublicToursTable() {
    const tbody = document.querySelector('#publicToursTable tbody');

    // Completed tours are hidden unless the "Show completed" checkbox is on
    const showCompleted = document.getElementById('showCompletedPublicTours')?.checked;
    const visibleTours = showCompleted ? publicTours : (publicTours || []).filter(t => t.status !== 'completed');

    if (!visibleTours || visibleTours.length === 0) {
        const hiddenCount = (publicTours || []).length - (visibleTours || []).length;
        tbody.innerHTML = `<tr><td colspan="8" class="text-center text-gray-500 dark:text-gray-400 py-8">${hiddenCount > 0 ? `No upcoming public tours (${hiddenCount} completed hidden)` : 'No public tours scheduled'}</td></tr>`;
        return;
    }

    tbody.innerHTML = visibleTours.map(tour => {
        // Parse date in local timezone to avoid UTC conversion issues
        const [year, month, day] = tour.date.split('-');
        const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        const dateTimeStr = `${tourDate.toLocaleDateString()} ${formatTimeToAMPM(tour.time)}`;
        const registered = tour.registrations?.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0) || 0;
        const spotsLeft = tour.capacity - registered;
        
        // Get assigned guide name(s)
        const guideName = getMultipleGuideNames(tour.assigned_guide_id);
        
        return `
            <tr>
                <td>${escapeHtml(dateTimeStr)}</td>
                <td>${escapeHtml(tour.type || 'Standard')}</td>
                <td>${escapeHtml(guideName)}</td>
                <td>${escapeHtml(tour.capacity)}</td>
                <td>${registered}</td>
                <td>
                    <span class="inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPublicTourStatusColor(tour.status).classes}">
                        ${escapeHtml(tour.status.charAt(0).toUpperCase() + tour.status.slice(1))}
                    </span>
                </td>
                <td>
                    <div class="flex gap-1">
                        <button class="btn-secondary text-xs px-3 py-1" onclick="event.stopPropagation(); viewPublicTour(${tour.id});">View</button>
                        <button class="btn-secondary text-xs px-3 py-1" onclick="event.stopPropagation(); editPublicTour(${tour.id});">Edit</button>
                        ${tour.status === 'active' ? 
                            `<button class="text-red-600 dark:text-white bg-transparent border-2 border-red-400 dark:border-[#9A3324] hover:bg-red-400 dark:hover:bg-red-500 hover:text-white text-xs px-3 py-1 rounded transition-all duration-200 cursor-pointer" onclick="event.stopPropagation(); cancelPublicTour(${tour.id});">Cancel</button>` : ''
                        }
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getPublicTourStatusColor(status) {
    const colors = {
        'active': { classes: 'bg-green-400 dark:bg-green-900/50 text-green-800 dark:text-green-200' },
        'full': { classes: 'bg-yellow-400 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200' },
        'cancelled': { classes: 'bg-red-400 dark:bg-red-900/50 text-red-800 dark:text-red-200' },
        'completed': { classes: 'bg-blue-400 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' }
    };
    return colors[status] || { classes: 'bg-gray-400 dark:bg-gray-900/50 text-gray-800 dark:text-gray-200' };
}

function populateGuideDropdowns() {
    const newGuideSelect = document.getElementById('newPublicTourGuide');
    const editGuideSelect = document.getElementById('editPublicTourGuide');

    // Update to support multiple selection
    if (newGuideSelect) {
        newGuideSelect.setAttribute('multiple', 'multiple');
        newGuideSelect.setAttribute('size', '4');
        newGuideSelect.innerHTML = '';
        tourGuides.forEach(guide => {
            const option = document.createElement('option');
            option.value = guide.id;
            option.textContent = guide.name;
            newGuideSelect.appendChild(option);
        });
    }

    if (editGuideSelect) {
        editGuideSelect.setAttribute('multiple', 'multiple');
        editGuideSelect.setAttribute('size', '4');
        editGuideSelect.innerHTML = '';
        tourGuides.forEach(guide => {
            const option = document.createElement('option');
            option.value = guide.id;
            option.textContent = guide.name;
            editGuideSelect.appendChild(option);
        });
    }
}

function showNewPublicTourForm() {
    populateGuideDropdowns();
    document.getElementById('newPublicTourModal').classList.remove('hidden');
}

function viewPublicTour(id) {
    const tour = publicTours.find(t => t.id == id);
    if (tour) {
        const content = document.getElementById('publicTourDetailsContent');
        const registered = tour.registrations?.reduce((sum, reg) => sum + (parseInt(reg.group_size) || 0), 0) || 0;
        const spotsLeft = tour.capacity - registered;
        
        // Get assigned guide name(s)
        const guideName = getMultipleGuideNames(tour.assigned_guide_id);
        
        content.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Tour Title</label>
                        <p class="text-gray-900 dark:text-gray-100 font-medium">${escapeHtml(tour.title)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Date & Time</label>
                        <p class="text-gray-900 dark:text-gray-100">${(() => {
                            // Parse date in local timezone to avoid UTC conversion issues
                            const [year, month, day] = tour.date.split('-');
                            const tourDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                            return tourDate.toLocaleDateString();
                        })()} at ${escapeHtml(tour.time)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Type</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(tour.type)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Assigned Guide</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(guideName)}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Capacity</label>
                        <p class="text-gray-900 dark:text-gray-100">${escapeHtml(tour.capacity)} people</p>
                    </div>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPublicTourStatusColor(tour.status).classes}">
                            ${escapeHtml(tour.status.charAt(0).toUpperCase() + tour.status.slice(1))}
                        </span>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Registered</label>
                        <p class="text-gray-900 dark:text-gray-100">${registered} people</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">👕 T-Shirts Ordered</label>
                        <p class="text-gray-900 dark:text-gray-100">${(() => {
                            if (!tour.registrations || tour.registrations.length === 0) return 'None';
                            
                            // Aggregate all t-shirt sizes across registrations
                            const sizeBreakdown = {};
                            let totalTshirts = 0;
                            
                            tour.registrations.forEach(reg => {
                                if (reg.tshirt_sizes && typeof reg.tshirt_sizes === 'object') {
                                    Object.entries(reg.tshirt_sizes).forEach(([size, qty]) => {
                                        const quantity = parseInt(qty) || 0;
                                        if (quantity > 0) {
                                            sizeBreakdown[size.toUpperCase()] = (sizeBreakdown[size.toUpperCase()] || 0) + quantity;
                                            totalTshirts += quantity;
                                        }
                                    });
                                }
                            });
                            
                            if (totalTshirts === 0) return 'None';
                            
                            const sizeDisplay = Object.entries(sizeBreakdown)
                                .sort(([a], [b]) => {
                                    const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
                                    return order.indexOf(a) - order.indexOf(b);
                                })
                                .map(([size, qty]) => `${escapeHtml(size)}: ${qty}`)
                                .join(', ');
                            
                            return `${totalTshirts} total (${sizeDisplay})`;
                        })()}</p>
                    </div>
                    <div>
                        <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Spots Available</label>
                        <p class="text-gray-900 dark:text-gray-100">${Math.max(0, spotsLeft)} spots</p>
                    </div>
                </div>
            </div>
            
            ${tour.notes ? `
                <div class="mt-6">
                    <label class="text-sm font-medium text-gray-500">Notes</label>
                    <p class="text-gray-900 dark:text-gray-100 mt-1 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">${escapeHtml(tour.notes)}</p>
                </div>
            ` : ''}
            
            <div class="mt-6">
                <h4 class="font-medium mb-3">Registrations (${registered})</h4>
                <div class="space-y-2 max-h-60 overflow-y-auto">
                    ${tour.registrations && tour.registrations.length > 0 ?
                        tour.registrations.map(reg => `
                            <div class="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                                <div class="flex justify-between items-start">
                                    <div class="flex items-center gap-3 flex-1">
                                        <input
                                            type="checkbox"
                                            class="attendance-checkbox w-4 h-4 text-blue-600 rounded"
                                            data-registration-id="${reg.id}"
                                            ${reg.attendance === 'present' ? 'checked' : ''}
                                            onchange="updateAttendance('${reg.id}', this.checked)"
                                            title="Mark attendance"
                                        />
                                        <div>
                                            <span class="font-medium text-gray-900 dark:text-gray-100">${escapeHtml(reg.name)}</span>
                                            <span class="text-gray-600 dark:text-gray-300 ml-2">${escapeHtml(reg.email)}</span>
                                        </div>
                                    </div>
                                    <span class="text-sm text-gray-500">Group of ${escapeHtml(reg.group_size)}</span>
                                </div>
                                ${reg.tshirt_total > 0 ? `
                                    <div class="mt-2 ml-7 text-sm text-blue-600">
                                        👕 ${parseInt(reg.tshirt_total)} t-shirt${parseInt(reg.tshirt_total) > 1 ? 's' : ''} ordered
                                        ${reg.tshirt_sizes ? `(${Object.entries(reg.tshirt_sizes || {})
                                            .filter(([size, qty]) => qty > 0)
                                            .map(([size, qty]) => `${escapeHtml(size.toUpperCase())}: ${escapeHtml(qty)}`)
                                            .join(', ')})` : ''}
                                    </div>
                                ` : ''}
                            </div>
                        `).join('') :
                        '<p class="text-gray-500 text-center py-4">No registrations yet</p>'
                    }
                </div>
            </div>

            <div class="mt-6" id="publicTourEmailHistory">
                <label class="text-sm font-medium text-gray-500 dark:text-gray-400">Emails sent</label>
                <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Loading...</p>
            </div>
        `;

        loadEmailHistory(tour.id, 'public', 'publicTourEmailHistory');

        // Ensure modal is properly shown with clean state
        const modal = document.getElementById('publicTourDetailsModal');
        // Force clean state before showing
        modal.style.display = 'none';
        modal.classList.add('hidden');
        modal.classList.remove('block');
        
        // Now show the modal
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.classList.add('block');
            modal.style.display = 'block';
        }, 50);
    }
}

async function updateAttendance(registrationId, isPresent) {
    try {
        const response = await fetch('/api/public-tour-registrations', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                id: registrationId,
                attendance: isPresent ? 'present' : ''
            })
        });

        if (response.ok) {
            // Update local data
            await loadData();
            console.log('Attendance updated successfully');
        } else {
            showNotification('Error', 'Failed to update attendance', 'error');
            // Revert checkbox state on error
            const checkbox = document.querySelector(`input[data-registration-id="${registrationId}"]`);
            if (checkbox) {
                checkbox.checked = !isPresent;
            }
        }
    } catch (error) {
        console.error('Error updating attendance:', error);
        showNotification('Error', 'Failed to update attendance', 'error');
        // Revert checkbox state on error
        const checkbox = document.querySelector(`input[data-registration-id="${registrationId}"]`);
        if (checkbox) {
            checkbox.checked = !isPresent;
        }
    }
}

function editPublicTour(id) {
    const tour = publicTours.find(t => t.id == id);
    if (tour) {
        populateGuideDropdowns();
        
        document.getElementById('editPublicTourId').value = tour.id;
        document.getElementById('editPublicTourTitle').value = tour.title;
        document.getElementById('editPublicTourDate').value = tour.date;
        // Convert time from 12-hour format (2:00 PM) to 24-hour format (14:00) for HTML time input
        try {
            const convertTo24Hour = (time12h) => {
                if (!time12h) return '14:00'; // Default fallback
                const [time, modifier] = time12h.split(' ');
                let [hours, minutes] = time.split(':');
                
                if (hours === '12') {
                    hours = '00';
                }
                
                if (modifier && modifier.toUpperCase() === 'PM') {
                    hours = parseInt(hours, 10) + 12;
                }
                
                return `${hours.toString().padStart(2, '0')}:${minutes || '00'}`;
            };
            
            document.getElementById('editPublicTourTime').value = convertTo24Hour(tour.time);
        } catch (error) {
            console.error('Error converting time:', error);
            document.getElementById('editPublicTourTime').value = '14:00'; // Fallback
        }
        document.getElementById('editPublicTourType').value = tour.type;
        document.getElementById('editPublicTourCapacity').value = tour.capacity;
        document.getElementById('editPublicTourStatus').value = tour.status;
        document.getElementById('editPublicTourNotes').value = tour.notes || '';

        // Select multiple guides
        const guideSelect = document.getElementById('editPublicTourGuide');
        const selectedGuideIds = parseGuideIds(tour.assigned_guide_id);
        Array.from(guideSelect.options).forEach(option => {
            option.selected = selectedGuideIds.includes(option.value);
        });

        // Ensure modal is properly displayed with clean state
        const modal = document.getElementById('editPublicTourModal');
        // Force clean state before showing
        modal.style.display = 'none';
        modal.classList.add('hidden');
        modal.classList.remove('block');
        
        // Now show the modal
        setTimeout(() => {
            modal.classList.remove('hidden');
            modal.classList.add('block');
            modal.style.display = 'block';
        }, 50);
    }
}

async function cancelPublicTour(id) {
    if (confirm('Are you sure you want to cancel this public tour?')) {
        try {
            const response = await fetch('/api/public-tours', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({id: id, status: 'cancelled'})
            });
            
            if (response.ok) {
                await loadData();
                renderPublicTours();
                showNotification('Success', 'Public tour cancelled successfully', 'success');
            } else {
                showNotification('Error', 'Failed to cancel public tour', 'error');
            }
        } catch (error) {
            console.error('Error cancelling public tour:', error);
            showNotification('Error', 'Failed to cancel public tour', 'error');
        }
    }
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

// Close modals when clicking outside (improved event handling)
window.addEventListener('click', function(event) {
    // Only handle clicks on modal backgrounds, not their children
    if (event.target.classList.contains('modal')) {
        const modal = event.target;
        const modalId = modal.id;
        if (modalId) {
            closeModal(modalId);
        }
    }
});

// Close modals with escape key
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        // Close any visible modals
        const allModals = [
            'newRequestModal',
            'newGuideModal', 
            'editRequestModal',
            'editGuideModal',
            'requestDetailsModal',
            'newPublicTourModal',
            'editPublicTourModal',
            'publicTourDetailsModal',
            'feedbackDetailModal'
        ];
        
        allModals.forEach(modalId => {
            const modal = document.getElementById(modalId);
            if (modal && (!modal.classList.contains('hidden') || modal.style.display === 'block')) {
                if (modalId === 'feedbackDetailModal') {
                    closeFeedbackDetailModal();
                } else {
                    closeModal(modalId);
                }
            }
        });
    }
});

// Authentication functions
async function checkAuthentication() {
    try {
        const response = await fetch('/api/auth-status', { credentials: 'include' });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Authentication check failed:', error);
        return { authenticated: false };
    }
}

function addUserInfoToHeader(user) {
    const header = document.querySelector('header .flex');
    if (header && user.name) {
        // Create user info element
        const userInfo = document.createElement('div');
        userInfo.className = 'text-white text-sm flex items-center space-x-4';
        userInfo.innerHTML = `
            <span>Welcome, ${escapeHtml(user.name)}</span>
            <button onclick="logout()" class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded transition-colors">
                Logout
            </button>
        `;
        header.appendChild(userInfo);
    }
}

async function logout() {
    try {
        const response = await fetch('/api/auth-logout', {
            credentials: 'include',
            method: 'POST'
        });
        if (response.ok) {
            window.location.href = '/signup';
        }
    } catch (error) {
        console.error('Logout failed:', error);
    }
}

// Feedback Management Functions
function renderFeedback() {
    calculateNPS();
    renderFeedbackSummary();
    renderRecentFeedback();
    renderDrivingFactors();
    renderAdditionalComments();
    renderImpressionChange();
    renderUnderstandingRobotics();
    renderFeedbackTable();
}

function calculateNPS() {
    if (!feedback || feedback.length === 0) {
        document.getElementById('npsScore').textContent = '--';
        document.getElementById('npsCategory').textContent = 'No feedback available';
        document.getElementById('detractors').textContent = '--';
        document.getElementById('passives').textContent = '--';
        document.getElementById('promoters').textContent = '--';
        return;
    }

    // Filter feedback with NPS scores
    const npsResponses = feedback.filter(f => f.nps_score !== null && f.nps_score !== undefined && f.nps_score !== '');
    
    if (npsResponses.length === 0) {
        document.getElementById('npsScore').textContent = '--';
        document.getElementById('npsCategory').textContent = 'No NPS data available';
        document.getElementById('detractors').textContent = '--';
        document.getElementById('passives').textContent = '--';
        document.getElementById('promoters').textContent = '--';
        return;
    }

    // Categorize responses
    const detractors = npsResponses.filter(f => parseInt(f.nps_score) <= 6).length;
    const passives = npsResponses.filter(f => parseInt(f.nps_score) >= 7 && parseInt(f.nps_score) <= 8).length;
    const promoters = npsResponses.filter(f => parseInt(f.nps_score) >= 9).length;
    
    // Calculate NPS
    const totalResponses = npsResponses.length;
    const npsScore = Math.round(((promoters - detractors) / totalResponses) * 100);
    
    // Determine category
    let category = 'Poor';
    let categoryColor = '#dc2626';
    if (npsScore >= 70) {
        category = 'Excellent';
        categoryColor = '#16a34a';
    } else if (npsScore >= 50) {
        category = 'Great';
        categoryColor = '#16a34a';
    } else if (npsScore >= 30) {
        category = 'Good';
        categoryColor = '#eab308';
    } else if (npsScore >= 0) {
        category = 'Okay';
        categoryColor = '#f97316';
    }
    
    // Update display
    const npsElement = document.getElementById('npsScore');
    npsElement.textContent = npsScore;
    npsElement.style.color = categoryColor;
    
    document.getElementById('npsCategory').textContent = category;
    document.getElementById('detractors').textContent = detractors;
    document.getElementById('passives').textContent = passives;
    document.getElementById('promoters').textContent = promoters;
}

function renderFeedbackSummary() {
    if (!feedback || feedback.length === 0) {
        document.getElementById('totalResponses').textContent = '0';
        document.getElementById('averageRating').textContent = '--';
        return;
    }

    // Calculate summary statistics
    const totalResponses = feedback.length;
    const ratingsWithValues = feedback.filter(f => f.overall_rating && f.overall_rating !== '');
    const averageRating = ratingsWithValues.length > 0 
        ? (ratingsWithValues.reduce((sum, f) => sum + parseInt(f.overall_rating), 0) / ratingsWithValues.length).toFixed(1)
        : '--';
    
    document.getElementById('totalResponses').textContent = totalResponses;
    document.getElementById('averageRating').textContent = averageRating !== '--' ? `${averageRating}/10` : averageRating;
}

function renderRecentFeedback() {
    const container = document.getElementById('recentFeedback');
    
    if (!container) {
        return;
    }
    
    if (!feedback || feedback.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No recent feedback</p>';
        return;
    }
    
    // Get most recent 5 feedback items
    const recentItems = feedback
        .sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at))
        .slice(0, 5);
    
    container.innerHTML = recentItems.map(item => {
        const date = new Date(item.submission_date || item.created_at).toLocaleDateString();
        const rating = item.overall_rating ? `${escapeHtml(item.overall_rating)}/10` : 'No rating';
        const tourType = item.tour_type === 'public' ? 'Public' : 'Private';
        
        return `
            <div class="flex justify-between items-center">
                <div>
                    <div class="font-medium">${tourType} Tour</div>
                    <div class="text-gray-500 dark:text-gray-300">${date}</div>
                </div>
                <div class="text-right">
                    <div class="font-medium">${rating}</div>
                </div>
            </div>
        `;
    }).join('');
}

function renderDrivingFactors() {
    const container = document.getElementById('drivingFactors');
    
    if (!container) {
        return;
    }
    
    if (!feedback || feedback.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No feedback available</p>';
        return;
    }
    
    // Get recent driving factors (non-empty responses)
    const drivingFactors = feedback
        .filter(f => f.nps_reason && f.nps_reason.toString().trim() !== '')
        .sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at))
        .slice(0, 10);
    
    if (drivingFactors.length === 0) {
        container.innerHTML = '<p>No driving factors provided</p>';
        return;
    }
    
    container.innerHTML = drivingFactors.map(item => {
        const date = new Date(item.submission_date || item.created_at).toLocaleDateString();
        return `
            <div class="border-l-4 border-blue-500 pl-3">
                <p class="text-sm">"${escapeHtml(item.nps_reason)}"</p>
                <p class="text-xs text-gray-500 dark:text-gray-300 mt-1">${date} • Rating: ${escapeHtml(item.overall_rating || 'N/A')}/10</p>
            </div>
        `;
    }).join('');
}

function renderAdditionalComments() {
    const container = document.getElementById('additionalComments');
    
    if (!container) {
        return;
    }
    
    if (!feedback || feedback.length === 0) {
        container.innerHTML = '<p>No feedback available</p>';
        return;
    }
    
    // Get recent additional comments (only from other_comments field)
    const comments = feedback
        .filter(f => f.other_comments && f.other_comments.toString().trim() !== '')
        .sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at))
        .slice(0, 10);
    
    if (comments.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No additional comments provided</p>';
        return;
    }
    
    container.innerHTML = comments.map(item => {
        const date = new Date(item.submission_date || item.created_at).toLocaleDateString();
        return `
            <div class="border-l-4 border-green-500 pl-3">
                <p class="text-sm">"${escapeHtml(item.other_comments)}"</p>
                <p class="text-xs text-gray-500 dark:text-gray-300 mt-1">${date} • Rating: ${escapeHtml(item.overall_rating || 'N/A')}/10</p>
            </div>
        `;
    }).join('');
}

function renderImpressionChange() {
    const container = document.getElementById('impressionChange');
    
    if (!container) {
        return;
    }
    
    if (!feedback || feedback.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No feedback available</p>';
        return;
    }
    
    // Calculate impression change percentage
    const impressionResponses = feedback.filter(f => f.impression_changed && f.impression_changed.toString().trim() !== '');
    const changedImpressions = impressionResponses.filter(f => f.impression_changed.toLowerCase() === 'yes');
    const percentage = impressionResponses.length > 0 ? Math.round((changedImpressions.length / impressionResponses.length) * 100) : 0;
    
    // Get recent impression details for those who said "Yes"
    const recentChangedImpressions = feedback
        .filter(f => f.impression_changed && f.impression_changed.toLowerCase() === 'yes' && f.impression_details && f.impression_details.toString().trim() !== '')
        .sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at))
        .slice(0, 5);
    
    container.innerHTML = `
        <div class="mb-4">
            <div class="text-2xl font-bold text-[#CFC096]">${percentage}%</div>
            <div class="text-sm">of visitors changed their impression of Michigan Robotics</div>
            <div class="text-xs text-gray-500 dark:text-gray-300">${changedImpressions.length} of ${impressionResponses.length} responses</div>
        </div>
        ${recentChangedImpressions.length > 0 ? `
            <div class="space-y-3">
                ${recentChangedImpressions.map(item => {
                    const date = new Date(item.submission_date || item.created_at).toLocaleDateString();
                    return `
                        <div class="border-l-4 border-[#CFC096] pl-3">
                            <p class="text-sm">"${escapeHtml(item.impression_details)}"</p>
                            <p class="text-xs text-gray-500 dark:text-gray-300 mt-1">${date} • Rating: ${escapeHtml(item.overall_rating || 'N/A')}/10</p>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '<p class="text-gray-500 text-sm">No recent impression details available</p>'}
    `;
}

function renderUnderstandingRobotics() {
    const container = document.getElementById('understandingRobotics');
    
    if (!container) {
        return;
    }
    
    if (!feedback || feedback.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No feedback available</p>';
        return;
    }
    
    // Calculate understanding percentages for yes/somewhat/no responses
    const understandingResponses = feedback.filter(f => f.understanding_robotics && f.understanding_robotics.toString().trim() !== '');
    const totalResponses = understandingResponses.length;
    
    if (totalResponses === 0) {
        container.innerHTML = '<p class="text-gray-500 dark:text-gray-300">No understanding responses available</p>';
        return;
    }
    
    const yesCount = understandingResponses.filter(f => f.understanding_robotics.toLowerCase() === 'yes').length;
    const somewhatCount = understandingResponses.filter(f => f.understanding_robotics.toLowerCase() === 'somewhat').length;
    const noCount = understandingResponses.filter(f => f.understanding_robotics.toLowerCase() === 'no').length;
    
    const yesPercentage = Math.round((yesCount / totalResponses) * 100);
    const somewhatPercentage = Math.round((somewhatCount / totalResponses) * 100);
    const noPercentage = Math.round((noCount / totalResponses) * 100);
    
    // Calculate angles for pie chart
    const yesAngle = (yesPercentage / 100) * 360;
    const somewhatAngle = (somewhatPercentage / 100) * 360;
    const noAngle = (noPercentage / 100) * 360;
    
    // Create conic gradient for pie chart
    const gradientStops = [];
    let currentAngle = 0;
    
    if (yesPercentage > 0) {
        gradientStops.push(`#16a34a 0deg ${yesAngle}deg`);
        currentAngle += yesAngle;
    }
    if (somewhatPercentage > 0) {
        gradientStops.push(`#eab308 ${currentAngle}deg ${currentAngle + somewhatAngle}deg`);
        currentAngle += somewhatAngle;
    }
    if (noPercentage > 0) {
        gradientStops.push(`#ef4444 ${currentAngle}deg ${currentAngle + noAngle}deg`);
    }
    
    const gradient = `conic-gradient(${gradientStops.join(', ')})`;
    
    container.innerHTML = `
        <div class="text-center">
            <div class="text-lg font-semibold text-gray-700 dark:text-gray-100 mb-4">Understanding of robotics</div>
            
            <!-- Pie Chart -->
            <div class="flex justify-center mb-4">
                <div class="relative">
                    <div class="w-32 h-32 rounded-full" style="background: ${gradient};"></div>
                    <div class="absolute inset-0 flex items-center justify-center">
                        <div class="w-16 h-16 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center">
                            <span class="text-xs font-semibold text-gray-600 dark:text-gray-300">${totalResponses}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Legend -->
            <div class="space-y-2">
                <div class="flex items-center justify-between px-4">
                    <div class="flex items-center">
                        <div class="w-3 h-3 bg-green-600 rounded-full mr-2"></div>
                        <span class="text-sm">Yes</span>
                    </div>
                    <span class="text-sm font-semibold text-green-600">${yesPercentage}%</span>
                </div>
                <div class="flex items-center justify-between px-4">
                    <div class="flex items-center">
                        <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                        <span class="text-sm">Somewhat</span>
                    </div>
                    <span class="text-sm font-semibold text-yellow-600">${somewhatPercentage}%</span>
                </div>
                <div class="flex items-center justify-between px-4">
                    <div class="flex items-center">
                        <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                        <span class="text-sm">No</span>
                    </div>
                    <span class="text-sm font-semibold text-red-600">${noPercentage}%</span>
                </div>
            </div>
            
            <div class="text-xs text-gray-500 dark:text-gray-300 mt-3">${totalResponses} total responses</div>
        </div>
    `;
}

function renderFeedbackTable() {
    const tbody = document.getElementById('feedbackTable');
    
    if (!feedback || feedback.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center">No feedback available</td></tr>';
        return;
    }
    
    // Sort feedback by date (newest first)
    const sortedFeedback = feedback.sort((a, b) => new Date(b.submission_date || b.created_at) - new Date(a.submission_date || a.created_at));
    
    tbody.innerHTML = sortedFeedback.map(item => {
        const date = new Date(item.submission_date || item.created_at).toLocaleDateString();
        const tourType = item.tour_type === 'public' ? 'Public' : 'Private';
        const guide = item.guide_name || 'Unknown';
        const rating = item.overall_rating ? `${item.overall_rating}/10` : '--';
        const nps = item.nps_score || '--';
        
        // Get NPS category color
        let npsClass = 'text-gray-600';
        if (item.nps_score) {
            const score = parseInt(item.nps_score);
            if (score <= 6) npsClass = 'text-red-600';
            else if (score <= 8) npsClass = 'text-yellow-600';
            else npsClass = 'text-green-600';
        }
        
        // Combine comments
        const comments = [];
        if (item.nps_reason) comments.push(item.nps_reason);
        if (item.other_comments) comments.push(item.other_comments);
        if (item.what_liked_most) comments.push(item.what_liked_most);
        if (item.suggestions_improvement) comments.push(item.suggestions_improvement);
        const allComments = comments.join(' | ');
        
        return `
            <tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${date}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${tourType}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${escapeHtml(guide)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${escapeHtml(rating)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${npsClass}">${escapeHtml(nps)}</td>
                <td class="px-6 py-4 text-sm max-w-xs truncate" title="${escapeHtml(allComments)}">${escapeHtml(allComments) || '--'}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">
                    <button onclick="showFeedbackDetail('${item.id}')" class="btn-secondary text-xs px-2 py-1">View</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Feedback detail modal functions
function showFeedbackDetail(feedbackId) {
    const feedbackItem = feedback.find(f => f.id === feedbackId);
    if (!feedbackItem) {
        console.error('Feedback not found:', feedbackId);
        return;
    }
    
    const content = document.getElementById('feedbackDetailContent');
    const date = new Date(feedbackItem.submission_date || feedbackItem.created_at).toLocaleDateString();
    const tourType = feedbackItem.tour_type === 'public' ? 'Public' : 'Private';
    
    content.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Tour Information -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 class="font-semibold mb-3 text-[#00274C] dark:text-gray-100">Tour Information</h3>
                <div class="space-y-2 text-sm">
                    <div><strong>Tour Type:</strong> ${tourType}</div>
                    <div><strong>Date:</strong> ${date}</div>
                    <div><strong>Guide:</strong> ${escapeHtml(feedbackItem.guide_name || 'Unknown')}</div>
                    <div><strong>Visitor:</strong> ${escapeHtml(feedbackItem.visitor_name || 'Anonymous')}</div>
                    ${feedbackItem.tour_date ? `<div><strong>Tour Date:</strong> ${escapeHtml(feedbackItem.tour_date)}</div>` : ''}
                </div>
            </div>
            
            <!-- Ratings -->
            <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 class="font-semibold mb-3 text-[#00274C] dark:text-gray-100">Ratings</h3>
                <div class="space-y-2 text-sm">
                    <div><strong>Overall Rating:</strong> ${escapeHtml(feedbackItem.overall_rating || 'N/A')}/10</div>
                    <div><strong>NPS Score:</strong> ${escapeHtml(feedbackItem.nps_score || 'N/A')}/10</div>
                    <div><strong>Understanding of robotics:</strong> ${escapeHtml(feedbackItem.understanding_robotics || 'N/A')}</div>
                    <div><strong>Impression Changed:</strong> ${escapeHtml(feedbackItem.impression_changed || 'N/A')}</div>
                </div>
            </div>
        </div>
        
        <!-- Comments Section -->
        <div class="mt-6 space-y-4">
            ${feedbackItem.nps_reason ? `
                <div class="bg-blue-50 dark:bg-blue-900/50 rounded-lg p-4">
                    <h4 class="font-semibold mb-2 text-[#00274C] dark:text-gray-100">What drove your NPS rating?</h4>
                    <p class="text-sm text-gray-800 dark:text-blue-200">"${escapeHtml(feedbackItem.nps_reason)}"</p>
                </div>
            ` : ''}
            
            ${feedbackItem.impression_details ? `
                <div class="bg-green-50 dark:bg-green-900/50 rounded-lg p-4">
                    <h4 class="font-semibold mb-2 text-[#00274C] dark:text-gray-100">How did the tour change your impression?</h4>
                    <p class="text-sm text-gray-800 dark:text-green-200">"${escapeHtml(feedbackItem.impression_details)}"</p>
                </div>
            ` : ''}
            
            ${feedbackItem.what_liked_most ? `
                <div class="bg-yellow-50 dark:bg-yellow-900/50 rounded-lg p-4">
                    <h4 class="font-semibold mb-2 text-[#00274C] dark:text-gray-100">What did you like most?</h4>
                    <p class="text-sm text-gray-800 dark:text-yellow-200">"${escapeHtml(feedbackItem.what_liked_most)}"</p>
                </div>
            ` : ''}
            
            ${feedbackItem.suggestions_improvement ? `
                <div class="bg-purple-50 dark:bg-purple-900/50 rounded-lg p-4">
                    <h4 class="font-semibold mb-2 text-[#00274C] dark:text-gray-100">Suggestions for improvement</h4>
                    <p class="text-sm text-gray-800 dark:text-purple-200">"${escapeHtml(feedbackItem.suggestions_improvement)}"</p>
                </div>
            ` : ''}
            
            ${feedbackItem.other_comments ? `
                <div class="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 class="font-semibold mb-2 text-[#00274C] dark:text-gray-100">Additional comments</h4>
                    <p class="text-sm text-gray-800 dark:text-gray-200">"${escapeHtml(feedbackItem.other_comments)}"</p>
                </div>
            ` : ''}
        </div>
    `;
    
    document.getElementById('feedbackDetailModal').classList.remove('hidden');
}

function closeFeedbackDetailModal() {
    document.getElementById('feedbackDetailModal').classList.add('hidden');
}

// Toggle Tour Resources section
function toggleTourResources() {
    const content = document.getElementById('tour-resources-content');
    const icon = document.getElementById('tour-resources-chevron');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        icon.style.transform = 'rotate(0deg)';
    } else {
        content.classList.add('hidden');
        icon.style.transform = 'rotate(-90deg)';
    }
}
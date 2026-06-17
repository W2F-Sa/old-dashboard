/**
 * Session Manager for Dashboard Pages
 * Handles session validation on page load and periodic checks every 15 minutes
 */

class SessionManager {
    constructor() {
        this.checkInterval = 15 * 60 * 1000; // 15 minutes in milliseconds
        this.intervalId = null;
        this.isChecking = false;
        
        // Initialize session management
        this.init();
    }

    init() {
        // Check session immediately on page load
        this.checkSession();
        
        // Start periodic session checks
        this.startPeriodicChecks();
        
        // Check session when page becomes visible (user returns to tab)
        this.handleVisibilityChange();
    }

    /**
     * Validate session with the server
     * @returns {Promise<boolean>} Session validity status
     */
    async checkSession() {
        if (this.isChecking) {
            return true; // Avoid concurrent checks
        }

        this.isChecking = true;
        
        try {
            const userid = sessionStorage.getItem('userid');
            const session = sessionStorage.getItem('session');
            
            // If no session data exists, redirect to login
            if (!userid || !session) {
                this.redirectToLogin();
                return false;
            }

            const response = await this.validateSessionWithServer(userid, session);
            
            if (response && response.status === 'success') {
                console.log('Session validated successfully');
                return true;
            } else {
                console.log('Session validation failed:', response);
                this.handleSessionFailure();
                return false;
            }
        } catch (error) {
            console.error('Session validation error:', error);
            this.handleSessionError(error);
            return false;
        } finally {
            this.isChecking = false;
        }
    }

    /**
     * Make API call to validate session
     * @param {string} userid - User ID
     * @param {string} session - Session token
     * @returns {Promise<Object>} API response
     */
    validateSessionWithServer(userid, session) {
        return new Promise((resolve, reject) => {
            $.ajax({
                url: window.GIoTapiBaseUrl + '/sessionvalidate',
                type: 'POST',
                contentType: 'application/json',
                dataType: 'json',
                data: JSON.stringify({
                    userid: userid,
                    session: session
                }),
                timeout: 10000, // 10 second timeout
                success: function(response) {
                    resolve(response);
                },
                error: function(xhr, status, error) {
                    reject(new Error(`Session validation failed: ${error}`));
                }
            });
        });
    }

    /**
     * Start periodic session checks every 15 minutes
     */
    startPeriodicChecks() {
        // Clear any existing interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }

        // Set up new interval for periodic checks
        this.intervalId = setInterval(() => {
            console.log('Performing periodic session check...');
            this.checkSession();
        }, this.checkInterval);

        console.log('Periodic session checks started (every 15 minutes)');
    }

    /**
     * Stop periodic session checks
     */
    stopPeriodicChecks() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('Periodic session checks stopped');
        }
    }

    /**
     * Handle page visibility changes to check session when user returns
     */
    handleVisibilityChange() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                // Page became visible, check session
                console.log('Page became visible, checking session...');
                this.checkSession();
            }
        });
    }

    /**
     * Handle session validation failure
     */
    handleSessionFailure() {
        this.clearSessionData();
        this.showSessionExpiredMessage();
        this.redirectToLogin();
    }

    /**
     * Handle session validation error
     * @param {Error} error - The error that occurred
     */
    handleSessionError(error) {
        console.error('Session validation error:', error);
        
        // Show user-friendly error message if showNotification function exists
        if (typeof showNotification === 'function') {
            showNotification('خطا در اعتبارسنجی جلسه. لطفاً دوباره وارد شوید.', 'error');
        }
        
        // For network errors, don't immediately redirect - give user a chance
        // But for authentication errors, redirect immediately
        if (error.message.includes('authentication') || error.message.includes('unauthorized')) {
            this.handleSessionFailure();
        }
    }

    /**
     * Clear all session and local storage data
     */
    clearSessionData() {
        sessionStorage.clear();
        localStorage.clear();
    }

    /**
     * Show session expired message to user
     */
    showSessionExpiredMessage() {
        if (typeof showNotification === 'function') {
            showNotification('جلسه شما منقضی شده است. لطفاً دوباره وارد شوید.', 'warning');
        } else {
            alert('جلسه شما منقضی شده است. لطفاً دوباره وارد شوید.');
        }
    }

    /**
     * Redirect to login page
     */
    redirectToLogin() {
        // Small delay to allow any notifications to be shown
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1000);
    }

    /**
     * Manually trigger a session check
     * @returns {Promise<boolean>} Session validity status
     */
    async manualCheck() {
        return await this.checkSession();
    }

    /**
     * Get session info
     * @returns {Object} Current session information
     */
    getSessionInfo() {
        return {
            userid: sessionStorage.getItem('userid'),
            session: sessionStorage.getItem('session'),
            hasValidSession: !!(sessionStorage.getItem('userid') && sessionStorage.getItem('session'))
        };
    }

    /**
     * Destroy the session manager
     */
    destroy() {
        this.stopPeriodicChecks();
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }
}

// Initialize session manager when DOM is ready
$(document).ready(function() {
    // Create global session manager instance
    window.sessionManager = new SessionManager();
    
    console.log('Session Manager initialized for dashboard page');
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SessionManager;
}
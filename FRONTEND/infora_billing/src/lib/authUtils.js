// Authentication utility functions

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export const isAuthenticated = () => {
  const token = localStorage.getItem('token') || 
                (localStorage.getItem('furniture_user') ? JSON.parse(localStorage.getItem('furniture_user')).access_token : null);
  return !!token;
};

/**
 * Get authentication token
 * @returns {string|null}
 */
export const getAuthToken = () => {
  return localStorage.getItem('token') || 
         (localStorage.getItem('furniture_user') ? JSON.parse(localStorage.getItem('furniture_user')).access_token : null);
};

/**
 * Clear all authentication data
 */
export const clearAuthData = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('furniture_user');
};

/**
 * Handle authentication error and redirect to login
 * @param {string} currentPath - Current page path for return after login
 * @param {Function} navigate - React Router navigate function
 * @param {string} message - Optional message to show on login page
 */
export const handleAuthError = (currentPath, navigate, message = "Please login to continue") => {
  clearAuthData();
  navigate("/login", { 
    state: { 
      from: currentPath,
      message: message
    } 
  });
};

/**
 * Require authentication for a component
 * @param {Function} navigate - React Router navigate function
 * @param {string} currentPath - Current page path
 * @returns {boolean} - true if authenticated, false if redirected
 */
export const requireAuth = (navigate, currentPath) => {
  if (!isAuthenticated()) {
    handleAuthError(currentPath, navigate, "Please login to access this page");
    return false;
  }
  return true;
};

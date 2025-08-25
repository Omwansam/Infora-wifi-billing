# Role-Based Routing System

This document explains how the role-based routing system works in the Infora WiFi Billing application.

## Overview

The application now supports role-based access control with two main user roles:
- **Admin**: Full access to all features
- **Support**: Limited access to customer-facing features

## Authentication Flow

### Login Process
1. User enters credentials on `/login`
2. Backend validates credentials and returns user data with role information
3. Frontend checks user role and redirects accordingly:
   - **Admin users**: Redirected to `/` (main dashboard)
   - **Support users**: Redirected to `/customers` (customer management)

### Registration Process
1. User registers on `/signup`
2. New users are automatically assigned the "support" role
3. After successful registration, user is automatically logged in and redirected based on role

## Route Protection

### Route Types

1. **Public Routes** (no authentication required):
   - `/login`
   - `/signup`

2. **Protected Routes** (authentication required):
   - All authenticated users can access
   - Examples: Dashboard, Customers, Billing, etc.

3. **Admin-Only Routes** (admin role required):
   - Finance management
   - Communication tools
   - Device management
   - System settings

### Route Components

- `ProtectedRoute`: Basic authentication check
- `AdminRoute`: Admin-only access
- `SupportRoute`: Support-only access
- `AdminOrSupportRoute`: Both roles can access

## Navigation

### Sidebar Menu
The sidebar automatically shows/hides menu items based on user role:

**All Users:**
- Dashboard
- Customer Management
- Billing & Payments
- Service Plans
- Support Tickets
- Basic Settings

**Admin Only:**
- Finance Management
- Communication Tools
- Device Management
- System Users
- System Logs

### User Profile
The sidebar shows:
- User's full name
- Email address
- Role (Administrator/Support)

## Implementation Details

### Key Files

1. **`src/components/auth/RoleBasedRoute.jsx`**
   - Main role-based routing component
   - Handles role validation and redirects

2. **`src/components/auth/ProtectedRoute.jsx`**
   - Basic authentication protection
   - Updated to work with new AuthContext

3. **`src/contexts/AuthContext.jsx`**
   - Manages user authentication state
   - Provides role checking functions

4. **`src/components/auth/AppSidebar.jsx`**
   - Dynamic sidebar based on user role
   - Shows/hides menu items accordingly

5. **`src/App.jsx`**
   - Main routing configuration
   - Uses role-based route protection

### Role Checking

```javascript
// Check if user is admin
const { isAdmin } = useAuth();
if (isAdmin()) {
  // Admin-specific logic
}

// Check user role directly
const { user } = useAuth();
if (user?.role === 'admin') {
  // Admin-specific logic
}
```

## Security Features

1. **Route Protection**: Unauthorized users are redirected to appropriate pages
2. **Menu Filtering**: Sidebar only shows accessible features
3. **Token Validation**: JWT tokens are validated on each request
4. **Automatic Logout**: Expired tokens trigger automatic logout

## Testing

### Admin Login
1. Use admin credentials: `admin@infora.com` / `admin123`
2. Should be redirected to main dashboard
3. Should see all menu items in sidebar

### Support Login
1. Create a new account or use support credentials
2. Should be redirected to customers page
3. Should see limited menu items in sidebar

### Unauthorized Access
1. Try to access admin-only routes as support user
2. Should be redirected to dashboard or appropriate page
3. Admin-only menu items should be hidden

## Future Enhancements

1. **Role Hierarchy**: Support for multiple admin levels
2. **Permission Granularity**: Fine-grained permissions per feature
3. **Audit Logging**: Track user access to sensitive areas
4. **Session Management**: Better session handling and timeout

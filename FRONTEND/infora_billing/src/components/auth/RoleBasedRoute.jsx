import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function RoleBasedRoute({ 
  children, 
  allowedRoles = ['admin', 'support'], 
  fallbackRoute = '/login' 
}) {
  const { user, loading, isAdmin } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  const hasRequiredRole = allowedRoles.includes(user.role) || 
                         (user.is_admin && allowedRoles.includes('admin'));

  if (!hasRequiredRole) {
    return <Navigate to={fallbackRoute} replace />;
  }

  return children;
}

// Convenience components for specific roles
export function AdminRoute({ children, fallbackRoute = '/' }) {
  return (
    <RoleBasedRoute allowedRoles={['admin']} fallbackRoute={fallbackRoute}>
      {children}
    </RoleBasedRoute>
  );
}

export function SupportRoute({ children, fallbackRoute = '/' }) {
  return (
    <RoleBasedRoute allowedRoles={['support']} fallbackRoute={fallbackRoute}>
      {children}
    </RoleBasedRoute>
  );
}

export function AdminOrSupportRoute({ children, fallbackRoute = '/' }) {
  return (
    <RoleBasedRoute allowedRoles={['admin', 'support']} fallbackRoute={fallbackRoute}>
      {children}
    </RoleBasedRoute>
  );
}

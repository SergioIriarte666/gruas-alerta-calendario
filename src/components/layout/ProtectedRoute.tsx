
import React, { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { Navigate, useLocation } from 'react-router-dom';

const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { user: authUser } = useAuth();
  const { user: profileUser } = useUser();
  const location = useLocation();

  if (!authUser) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }
  
  if (authUser && !profileUser) {
    // Authenticated user but no profile, could be due to sign-up issue.
    // Redirect to auth to re-initiate flow.
    console.error("Authenticated user found without a profile. Redirecting to /auth.");
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  if (profileUser) {
    const isOperatorRoute = location.pathname.startsWith('/operator');
    const userRole = profileUser.role;

    if (userRole === 'operator' && !isOperatorRoute) {
      // Operator trying to access non-operator routes
      return <Navigate to="/operator" replace />;
    }

    if (userRole !== 'operator' && isOperatorRoute) {
      // Non-operator trying to access operator routes
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

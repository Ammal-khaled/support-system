import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requiredRole, allowTemporaryPassword = false }) {
  const { currentUser, role, loading, userProfile } = useAuth();

  if (loading) {
    return (
      <div className="page-bg flex items-center justify-center">
        <p className="text-semantic-neutral font-semibold">Verifying access...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (userProfile?.mustChangePassword && !allowTemporaryPassword) {
    return <Navigate to="/change-password" replace />;
  }

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  if (requiredRole && !allowedRoles.includes(role)) {
    return <Navigate to="/agent" replace />;
  }

  return children;
}


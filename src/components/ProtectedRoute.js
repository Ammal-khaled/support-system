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

  if (userProfile?.disabled || role === "disabled") {
    return (
      <div className="page-bg flex min-h-screen items-center justify-center p-4">
        <div className="card max-w-md p-6 text-center">
          <h1 className="text-2xl font-extrabold text-slate-950">Account Deactivated</h1>
          <p className="mt-2 text-sm text-semantic-neutral">
            This AquaDesk profile is not active. Contact your team lead if this is unexpected.
          </p>
        </div>
      </div>
    );
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


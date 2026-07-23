import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, requiredRole }) {
  const { currentUser, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="page-bg flex items-center justify-center">
        <p className="text-text-muted font-semibold">Verifying access...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && role !== requiredRole) {
    return <Navigate to="/agent" replace />;
  }

  return children;
}

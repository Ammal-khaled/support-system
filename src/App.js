import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AgentDashboard from "./pages/AgentDashboard";
import TeamLeadDashboard from "./pages/TeamLeadDashboard";
import CreateUser from "./pages/CreateUser";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Any logged-in user can access the Agent view */}
          <Route
            path="/agent"
            element={
              <ProtectedRoute>
                <AgentDashboard />
              </ProtectedRoute>
            }
          />

          {/* Only users with the team_lead role can access this view */}
          <Route
            path="/team-lead"
            element={
              <ProtectedRoute requiredRole="team_lead">
                <TeamLeadDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/create-user"
            element={
              <ProtectedRoute requiredRole="team_lead">
                <CreateUser />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;

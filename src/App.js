import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import AgentDashboard from "./pages/AgentDashboard";
import AgentOverviewPage from "./pages/AgentOverviewPage";
import TeamLeadDashboard from "./pages/TeamLeadDashboard";
import QualityDashboard from "./pages/QualityDashboard";
import CreateUser from "./pages/CreateUser";
import ChangePassword from "./pages/ChangePassword";
import PolicyDetailPage from "./pages/PolicyDetailPage";
import TicketsPage from "./pages/TicketsPage";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ErrorBoundary>
          <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/change-password"
            element={
              <ProtectedRoute allowTemporaryPassword>
                <ChangePassword />
              </ProtectedRoute>
            }
          />

          {/* Any logged-in user can access the Agent view */}
          <Route
            path="/agent/policies/:policyId"
            element={
              <ProtectedRoute>
                <PolicyDetailPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overview/agents/:agentName"
            element={
              <ProtectedRoute>
                <AgentOverviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/overview"
            element={
              <ProtectedRoute>
                <AgentOverviewPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tickets"
            element={
              <ProtectedRoute>
                <TicketsPage />
              </ProtectedRoute>
            }
          />

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
            path="/quality"
            element={
              <ProtectedRoute requiredRole={["team_lead", "quality_supervisor"]}>
                <QualityDashboard />
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
          </ErrorBoundary>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;


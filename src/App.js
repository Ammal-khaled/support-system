import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import AgentDashboard from "./pages/AgentDashboard";
import TeamLeadDashboard from "./pages/TeamLeadDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          
          <Route path="/login" element={<Login />} />
          
          <Route 
            path="/agent" 
            element={
              <ProtectedRoute>
                <AgentDashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/tl" 
            element={
              <ProtectedRoute>
                <TeamLeadDashboard />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../services/auth";

// Dummy data to simulate our Firebase database
const dummyProcesses = [
  { id: 1, title: "Password Reset", type: "Simple", description: "Standard steps to reset a customer password." },
  { id: 2, title: "Refund Request", type: "Complex", description: "Multi-step approval process for issuing refunds." },
  { id: 3, title: "Update Billing Info", type: "Simple", description: "How to update credit card details." },
  { id: 4, title: "Account Cancellation", type: "Complex", description: "Retention workflow and cancellation routing." },
];

export default function AgentDashboard() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const filteredProcesses = dummyProcesses.filter((process) =>
    process.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">CSR Knowledge Base</h1>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-red-600 hover:text-red-800 transition-colors"
        >
          Sign Out
        </button>
      </nav>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        
        {/* Search Section */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search processes (e.g., 'Refund')..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full md:w-1/2 px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
          />
        </div>

        {/* Process Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProcesses.length > 0 ? (
            filteredProcesses.map((process) => (
              <div
                key={process.id}
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-gray-800">{process.title}</h3>
                  <span
                    className={`text-xs font-bold px-2 py-1 rounded-full ${
                      process.type === "Simple"
                        ? "bg-green-100 text-green-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {process.type}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">{process.description}</p>
              </div>
            ))
          ) : (
            <p className="text-gray-500 col-span-full">No processes found matching your search.</p>
          )}
        </div>
      </main>
    </div>
  );
}

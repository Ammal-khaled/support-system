import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../services/auth";
import { useAuth } from "../context/AuthContext";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { role } = useAuth();

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const navItems =
    role === "team_lead"
      ? [
          { name: "KB Management", path: "/team-lead", icon: "\uD83D\uDCDA" },
          { name: "Create User", path: "/create-user", icon: "\uD83D\uDC65" },
          { name: "Agent View", path: "/agent", icon: "\uD83D\uDC40" },
        ]
      : [{ name: "Agent View", path: "/agent", icon: "\uD83D\uDC40" }];

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] bg-surface-card border-r border-surface-border flex flex-col overflow-y-auto z-50">
      <div className="p-6 mb-2">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-brand-primary flex items-center justify-center text-white">
            <span className="text-sm">{"\uD83C\uDFA7"}</span>
          </div>
          CSR Support
        </h2>
      </div>

      <nav className="flex-1 px-4 space-y-1.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium ${
                isActive
                  ? "bg-brand-faint text-brand-primary"
                  : "text-semantic-neutral hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-[1.1rem] w-5 text-center">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 mt-auto border-t border-surface-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 text-semantic-error hover:bg-red-50 rounded-xl transition-colors font-medium"
        >
          <span className="w-5 text-center">{"\uD83D\uDEAA"}</span>
          Sign Out
        </button>
      </div>
    </aside>
  );
}

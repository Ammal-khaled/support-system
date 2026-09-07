import { Link, useLocation, useNavigate } from "react-router-dom";
import { logoutUser } from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import FlagNotificationCenter from "./FlagNotificationCenter";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, role, userProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const canReceiveDesktopAlerts = ["team_lead", "quality_supervisor"].includes(role);

  const enableDesktopAlerts = async () => {
    if (typeof Notification === "undefined") return;
    await Notification.requestPermission();
  };

  const handleLogout = async () => {
    await logoutUser();
    navigate("/login");
  };

  const navItems =
    role === "team_lead"
      ? [
          { name: "Overview", path: "/overview", code: "OV" },
          { name: "Tickets", path: "/tickets", code: "TK" },
          { name: "Knowledge", path: "/team-lead", code: "KB" },
          { name: "Users", path: "/create-user", code: "CU" },
        ]
      : role === "quality_supervisor"
        ? [
            { name: "Overview", path: "/overview", code: "OV" },
            { name: "Tickets", path: "/tickets", code: "TK" },
            { name: "Agent", path: "/agent", code: "AV" },
          ]
      : [
          { name: "Overview", path: "/overview", code: "OV" },
          { name: "Tickets", path: "/tickets", code: "TK" },
          { name: "Agent", path: "/agent", code: "AV" },
        ];

  const navLink = (item, compact = false) => {
    const isActive =
      location.pathname === item.path ||
      (item.path === "/overview" && location.pathname.startsWith("/overview/agents")) ||
      (item.path === "/agent" && location.pathname.startsWith("/agent/policies"));

    return (
      <Link
        key={item.name}
        to={item.path}
        className={`group flex items-center gap-3 rounded-2xl text-sm font-bold transition-all ${
          compact ? "shrink-0 px-3 py-2" : "px-3 py-3"
        } ${
          isActive
            ? "bg-brand-faint text-brand-primary shadow-sm"
            : "text-semantic-neutral hover:bg-brand-faint/20 hover:text-brand-primary"
        }`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-xl text-[0.68rem] font-extrabold ${
            isActive
              ? "bg-surface-card text-brand-primary"
              : "bg-surface-bg text-semantic-neutral group-hover:text-brand-primary"
          }`}
        >
          {item.code}
        </span>
        {item.name}
      </Link>
    );
  };

  return (
    <>
      <FlagNotificationCenter />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-surface-border bg-surface-card/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-sm font-extrabold text-white shadow-card">
              AD
            </div>
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-current">AquaDesk</h2>
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-semantic-neutral">
                Aquacool Ops
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="rounded-xl border border-surface-border px-3 py-2 text-sm font-bold text-semantic-neutral transition-colors hover:border-brand-primary hover:text-brand-primary"
            >
              {isDark ? "Light" : "Dark"}
            </button>
            <button
              onClick={handleLogout}
              className="rounded-xl px-3 py-2 text-sm font-bold text-semantic-error transition-colors hover:bg-semantic-error/10"
            >
              Sign Out
            </button>
            {canReceiveDesktopAlerts && typeof Notification !== "undefined" && Notification.permission !== "granted" && (
              <button
                onClick={enableDesktopAlerts}
                className="rounded-xl border border-surface-border px-3 py-2 text-sm font-bold text-semantic-neutral transition-colors hover:border-brand-primary hover:text-brand-primary"
              >
                Enable alerts
              </button>
            )}
          </div>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3">
          {navItems.map((item) => navLink(item, true))}
        </nav>
      </header>

      <aside className="fixed inset-y-0 left-0 z-50 hidden w-[260px] flex-col border-r border-surface-border bg-surface-card lg:flex">
        <div className="px-5 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-primary text-sm font-extrabold text-white shadow-card">
              AD
            </div>
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-current">AquaDesk</h2>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-neutral">
                Aquacool Ops
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => navLink(item))}
        </nav>

        <div className="border-t border-surface-border p-4">
          <div className="mb-3 rounded-2xl bg-surface-bg p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-semantic-neutral">
              Session
            </p>
          <p className="mt-1 text-sm font-bold capitalize text-current">
              {userProfile?.name || currentUser?.displayName || currentUser?.email || "Agent"}
            </p>
            <p className="mt-1 text-xs font-semibold capitalize text-semantic-neutral">
              {(role || "agent").replace("_", " ")}
          </p>
          </div>
          <button
            onClick={toggleTheme}
            className="mb-2 flex w-full items-center justify-between rounded-2xl border border-surface-border px-3 py-3 text-sm font-bold text-semantic-neutral transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            <span>Theme</span>
            <span>{isDark ? "Dark" : "Light"}</span>
          </button>
          {canReceiveDesktopAlerts && typeof Notification !== "undefined" && (
            <button
              onClick={enableDesktopAlerts}
              disabled={Notification.permission === "granted" || Notification.permission === "denied"}
              className="mb-2 flex w-full items-center justify-between rounded-2xl border border-surface-border px-3 py-3 text-sm font-bold text-semantic-neutral transition-colors enabled:hover:border-brand-primary enabled:hover:text-brand-primary disabled:cursor-default disabled:opacity-70"
            >
              <span>Desktop alerts</span>
              <span>{Notification.permission === "granted" ? "On" : Notification.permission === "denied" ? "Blocked" : "Off"}</span>
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm font-bold text-semantic-error transition-colors hover:bg-semantic-error/10"
          >
            <span>Sign Out</span>
            <span aria-hidden="true">-&gt;</span>
          </button>
        </div>
      </aside>
    </>
  );
}

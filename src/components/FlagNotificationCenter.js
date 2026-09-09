import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { subscribeAgentActions, subscribeFlags } from "../services/firestore";

function getAgentName(flag) {
  return flag.agentName || flag.agentEmail || "Unknown Agent";
}

function isVisibleToUser(flag, currentUser, userProfile, role) {
  if (role === "team_lead" || role === "quality_supervisor") return true;

  const signedInName =
    userProfile?.name || currentUser?.displayName || currentUser?.email || "";

  return (
    flag.agentId === currentUser?.uid ||
    getAgentName(flag) === signedInName ||
    getAgentName(flag) === currentUser?.email
  );
}

export default function FlagNotificationCenter() {
  const navigate = useNavigate();
  const { currentUser, role, userProfile } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [supportNotifications, setSupportNotifications] = useState([]);
  const initializedFlagsRef = useRef(false);
  const initializedSupportRef = useRef(false);
  const reviewPath = role === "quality_supervisor" ? "/quality" : "/overview";
  const supportPath = "/quality?tab=support";

  const flagStorageKey = useMemo(
    () => `aquadesk_seen_flags_${currentUser?.uid || "guest"}`,
    [currentUser?.uid]
  );
  const supportStorageKey = useMemo(
    () => `aquadesk_seen_support_requests_${currentUser?.uid || "guest"}`,
    [currentUser?.uid]
  );

  useEffect(() => {
    setNotifications([]);
    initializedFlagsRef.current = false;
    if (!currentUser || !["team_lead", "quality_supervisor"].includes(role)) return undefined;

    const unsubscribe = subscribeFlags((flags) => {
      const seen = new Set(JSON.parse(localStorage.getItem(flagStorageKey) || "[]"));
      const visibleOpenFlags = flags.filter(
        (flag) => !flag.reviewed && isVisibleToUser(flag, currentUser, userProfile, role)
      );

      if (!initializedFlagsRef.current) {
        const newestIds = visibleOpenFlags.slice(0, 20).map((flag) => flag.id);
        localStorage.setItem(flagStorageKey, JSON.stringify(Array.from(new Set([...seen, ...newestIds]))));
        initializedFlagsRef.current = true;
        return;
      }

      const freshFlags = visibleOpenFlags.filter((flag) => !seen.has(flag.id)).slice(0, 3);
      if (!freshFlags.length) return;

      const updatedSeen = new Set([...seen, ...freshFlags.map((flag) => flag.id)]);
      localStorage.setItem(flagStorageKey, JSON.stringify(Array.from(updatedSeen).slice(-80)));
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        freshFlags
          .filter((flag) => flag.type === "critical")
          .forEach((flag) => {
            const notification = new Notification("AquaDesk critical flag", {
              body: `${getAgentName(flag)}: ${flag.matchedPhrase || "Critical policy issue detected."}`,
              tag: `aquadesk-flag-${flag.id}`,
            });
            notification.onclick = () => {
              window.focus();
              navigate(reviewPath);
              notification.close();
            };
          });
      }
      setNotifications((current) => [...freshFlags, ...current].slice(0, 3));
    });

    return unsubscribe;
  }, [currentUser, flagStorageKey, navigate, reviewPath, role, userProfile]);

  useEffect(() => {
    setSupportNotifications([]);
    initializedSupportRef.current = false;
    if (!currentUser || !["team_lead", "quality_supervisor"].includes(role)) return undefined;

    const unsubscribe = subscribeAgentActions((actions) => {
      const seen = new Set(JSON.parse(localStorage.getItem(supportStorageKey) || "[]"));

      if (!initializedSupportRef.current) {
        const newestIds = actions.slice(0, 20).map((action) => action.id);
        localStorage.setItem(supportStorageKey, JSON.stringify(Array.from(new Set([...seen, ...newestIds]))));
        initializedSupportRef.current = true;
        return;
      }

      const freshActions = actions.filter((action) => !seen.has(action.id)).slice(0, 3);
      if (!freshActions.length) return;

      const updatedSeen = new Set([...seen, ...freshActions.map((action) => action.id)]);
      localStorage.setItem(supportStorageKey, JSON.stringify(Array.from(updatedSeen).slice(-80)));

      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        freshActions.forEach((action) => {
          const notification = new Notification("AquaDesk support request", {
            body: `${action.agentName || "Unknown Agent"} needs support with ${action.actionType || "a customer case"}.`,
            tag: `aquadesk-support-${action.id}`,
          });
          notification.onclick = () => {
            window.focus();
            navigate(supportPath);
            notification.close();
          };
        });
      }

      setSupportNotifications((current) => [...freshActions, ...current].slice(0, 3));
    });

    return unsubscribe;
  }, [currentUser, navigate, role, supportPath, supportStorageKey]);

  if (!notifications.length && !supportNotifications.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3">
      {supportNotifications.map((action) => (
        <div
          key={action.id}
          className="glass-card border-white/80 p-4 shadow-xl"
          role="status"
          aria-live="polite"
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <span className="rounded-full bg-semantic-info/15 px-2.5 py-1 text-xs font-extrabold text-semantic-info">
              Support Request
            </span>
            <button
              type="button"
              onClick={() =>
                setSupportNotifications((current) => current.filter((item) => item.id !== action.id))
              }
              className="rounded-full px-2 text-lg leading-none text-slate-400 hover:bg-white hover:text-slate-700"
              aria-label="Dismiss support request"
            >
              x
            </button>
          </div>
          <p className="font-extrabold text-slate-950">{action.agentName || "Unknown Agent"}</p>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-semantic-neutral">
            Needs support with {action.actionType || "a customer case"}.
          </p>
          <button
            type="button"
            onClick={() => {
              setSupportNotifications((current) => current.filter((item) => item.id !== action.id));
              navigate(supportPath);
            }}
            className="mt-3 rounded-2xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light"
          >
            Open Support Requests
          </button>
        </div>
      ))}

      {notifications.map((flag) => {
        const isCritical = flag.type === "critical";

        return (
          <div
            key={flag.id}
            className="glass-card border-white/80 p-4 shadow-xl"
            role="status"
            aria-live="polite"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${
                  isCritical
                    ? "bg-semantic-error/15 text-semantic-error"
                    : "bg-semantic-warning/15 text-semantic-warning"
                }`}
              >
                {isCritical ? "Critical Mistake" : "Coaching Alert"}
              </span>
              <button
                type="button"
                onClick={() =>
                  setNotifications((current) => current.filter((item) => item.id !== flag.id))
                }
                className="rounded-full px-2 text-lg leading-none text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                x
              </button>
            </div>
            <p className="font-extrabold text-slate-950">{getAgentName(flag)}</p>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-semantic-neutral">
              {flag.matchedPhrase || flag.feedback || "A call review flag was created."}
            </p>
            <button
              type="button"
              onClick={() => {
                setNotifications((current) => current.filter((item) => item.id !== flag.id));
                navigate(reviewPath);
              }}
              className="mt-3 rounded-2xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light"
            >
              Open Review
            </button>
          </div>
        );
      })}
    </div>
  );
}

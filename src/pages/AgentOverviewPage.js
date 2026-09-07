import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import {
  getAgentActionsByDateRange,
  getAgentFlagsByDateRange,
  getUserById,
  markFlagReviewed,
  resolveAgentId,
  saveCoachingNote,
  subscribeAgentActions,
  subscribeAgentUsers,
  subscribeCoachingNote,
  subscribeFlags,
  subscribeTickets,
} from "../services/firestore";

const ALL_AGENTS = "All Agents";
const PERIODS = [
  { id: "day", label: "Today", days: 1 },
  { id: "week", label: "This Week", days: 7 },
  { id: "month", label: "This Month", days: 30 },
];
const TABS = ["Overview", "Mistakes", "Agents", "Tickets"];

function getDate(row, fields) {
  const value = fields.map((field) => row[field]).find(Boolean);
  if (value?.toDate) return value.toDate();
  if (value) return new Date(value);
  return null;
}

function getAgentName(row) {
  return row.agentName || row.agentEmail || row.createdByName || "Unknown Agent";
}

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return "Pending";
  return timestamp.toDate().toLocaleString();
}

function isInPeriod(row, fields, periodId) {
  const date = getDate(row, fields);
  if (!date || Number.isNaN(date.getTime())) return false;

  const period = PERIODS.find((item) => item.id === periodId) || PERIODS[1];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period.days - 1));
  return date >= start;
}

function countBy(rows, getKey) {
  const counts = rows.reduce((result, row) => {
    const key = getKey(row) || "Uncategorized";
    result[key] = (result[key] || 0) + 1;
    return result;
  }, {});

  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function toDateInputValue(date) {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
}

function csvCell(value) {
  return `"${String(value ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

function calculateQualityScore(actions, flags) {
  if (!actions.length && !flags.length) return 100;

  const openFlags = flags.filter((flag) => !flag.reviewed).length;
  const criticalFlags = flags.filter((flag) => flag.type === "critical").length;
  const mistakeRatePenalty = actions.length
    ? Math.min(35, Math.round((flags.length / actions.length) * 18))
    : Math.min(35, flags.length * 8);
  const penalty = mistakeRatePenalty + openFlags * 7 + criticalFlags * 12;

  return Math.max(0, Math.min(100, 100 - penalty));
}

function MetricCard({ label, value, tone = "neutral", helper }) {
  const toneStyles = {
    neutral: {
      accent: "bg-semantic-neutral",
      value: "text-current",
    },
    primary: {
      accent: "bg-brand-primary",
      value: "text-brand-primary",
    },
    success: {
      accent: "bg-semantic-success",
      value: "text-semantic-success",
    },
    warning: {
      accent: "bg-semantic-warning",
      value: "text-semantic-warning",
    },
    error: {
      accent: "bg-semantic-error",
      value: "text-semantic-error",
    },
  }[tone] || {
    accent: "bg-semantic-neutral",
    value: tone,
  };

  return (
    <div className="glass-card min-h-[112px] overflow-hidden p-0">
      <div className={`h-1.5 w-full ${toneStyles.accent}`} />
      <div className="p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
        {label}
      </p>
      <p className={`mt-2 font-mono text-3xl font-extrabold tracking-tight ${toneStyles.value}`}>{value}</p>
      {helper && <p className="mt-2 text-xs font-semibold text-semantic-neutral">{helper}</p>}
      </div>
    </div>
  );
}

function TrendBars({ title, subtitle, rows, emptyText = "No data yet." }) {
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-semantic-neutral">{subtitle}</p>}
        </div>
        {rows.length > 0 && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-500">{rows.length} categories</span>}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.slice(0, 6).map((row, index) => (
            <div key={row.label} className="rounded-2xl border border-surface-border bg-slate-50/70 px-3 py-2.5">
              <div className="flex items-center gap-3">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${index === 0 ? "bg-brand-primary text-white" : "bg-white text-slate-500"}`}>
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-extrabold text-slate-800">{row.label}</p>
                    <p className="font-mono text-sm font-extrabold text-slate-950">{row.value}</p>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${index === 0 ? "bg-brand-primary" : "bg-brand-light"}`} style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function getActivityBuckets(actions, flags, tickets, periodId) {
  const period = PERIODS.find((item) => item.id === periodId) || PERIODS[1];
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period.days - 1));
  const countRows = (rows, fields, from, to) => rows.filter((row) => {
    const rowDate = getDate(row, fields);
    return rowDate && rowDate >= from && rowDate < to;
  }).length;

  if (periodId === "day") {
    const buckets = Array.from({ length: 24 }, (_, hour) => {
      const from = new Date(start);
      from.setHours(hour, 0, 0, 0);
      const to = new Date(from);
      to.setHours(hour + 1);
      return { label: `${String(hour).padStart(2, "0")}:00`, actions: countRows(actions, ["timestamp"], from, to), flags: countRows(flags, ["timestamp"], from, to), tickets: countRows(tickets, ["createdAt", "updatedAt"], from, to) };
    });
    return buckets.filter((row) => row.actions + row.flags + row.tickets > 0);
  }

  const buckets = Array.from({ length: period.days }, (_, index) => {
    const from = new Date(start);
    from.setDate(start.getDate() + index);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return {
      label: periodId === "week"
        ? from.toLocaleDateString(undefined, { weekday: "short" })
        : from.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      actions: countRows(actions, ["timestamp"], from, to),
      flags: countRows(flags, ["timestamp"], from, to),
      tickets: countRows(tickets, ["createdAt", "updatedAt"], from, to),
    };
  });
  return buckets.filter((row) => row.actions + row.flags + row.tickets > 0);
}

function ActivityDashboard({ rows, period }) {
  const safeRows = rows.length ? rows : [{ label: "No activity", actions: 0, flags: 0, tickets: 0 }];
  const totals = safeRows.reduce((sum, row) => ({
    actions: sum.actions + row.actions, flags: sum.flags + row.flags, tickets: sum.tickets + row.tickets,
  }), { actions: 0, flags: 0, tickets: 0 });
  const max = Math.max(...safeRows.map((row) => row.actions + row.flags + row.tickets), 1);
  const linePoints = safeRows.map((row, index) => `${safeRows.length === 1 ? 300 : (index / (safeRows.length - 1)) * 560 + 20},${190 - ((row.actions + row.flags + row.tickets) / max) * 160}`).join(" ");
  const ringTotal = Math.max(totals.actions + totals.flags + totals.tickets, 1);
  const ringItems = [["Actions", totals.actions, "#0089BF"], ["Flags", totals.flags, "#EF4444"], ["Tickets", totals.tickets, "#3B82F6"]];

  return (
    <section className="glass-card p-5 sm:p-6 lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">{period === "day" ? "Today" : period === "month" ? "Active days this month" : "Activity by day this week"}</h2>
          <p className="mt-1 text-sm text-semantic-neutral">Only periods with recorded activity are shown.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-semantic-neutral">
          {ringItems.map(([label, , color]) => <span key={label} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.45fr_0.8fr]">
        <div className="rounded-2xl border border-surface-border bg-slate-50/70 p-4">
          <div className="flex h-48 items-end gap-2 overflow-x-auto" role="img" aria-label="Activity bar chart">
            {safeRows.map((row) => <div key={row.label} className="flex min-w-[42px] flex-1 flex-col items-center justify-end gap-2">
              <div className="flex h-40 w-full items-end justify-center gap-1">
                <i title={`${row.actions} actions`} className="w-2.5 rounded-t bg-brand-primary" style={{ height: `${Math.max(row.actions ? 8 : 0, (row.actions / max) * 100)}%` }} />
                <i title={`${row.flags} flags`} className="w-2.5 rounded-t bg-semantic-error" style={{ height: `${Math.max(row.flags ? 8 : 0, (row.flags / max) * 100)}%` }} />
                <i title={`${row.tickets} tickets`} className="w-2.5 rounded-t bg-semantic-info" style={{ height: `${Math.max(row.tickets ? 8 : 0, (row.tickets / max) * 100)}%` }} />
              </div>
              <span className="text-[0.65rem] font-extrabold text-slate-500">{row.label}</span>
            </div>)}
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-surface-border bg-slate-50/70 p-4">
          <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0 -rotate-90" role="img" aria-label="Activity mix ring chart">
            <circle cx="60" cy="60" r="46" fill="none" stroke="#E2E8F0" strokeWidth="12" />
            {ringItems.map(([label, value, color], index) => <circle key={label} cx="60" cy="60" r="46" fill="none" stroke={color} strokeWidth="12" strokeDasharray={`${(value / ringTotal) * 289} 289`} strokeDashoffset={-ringItems.slice(0, index).reduce((sum, item) => sum + (item[1] / ringTotal) * 289, 0)} />)}
          </svg>
          <div className="space-y-2 text-sm">
            {ringItems.map(([label, value, color]) => <div key={label} className="flex items-center justify-between gap-6"><span className="flex items-center gap-2 text-semantic-neutral"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span><strong className="font-mono text-slate-950">{value}</strong></div>)}
          </div>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-surface-border bg-slate-50/70 p-4">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">Activity line</p>
        <svg viewBox="0 0 600 220" className="h-40 w-full" preserveAspectRatio="none" role="img" aria-label="Activity line chart">
          <line x1="20" y1="190" x2="580" y2="190" stroke="#CBD5E1" />
          <polyline points={linePoints} fill="none" stroke="#0089BF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          {safeRows.map((row, index) => <circle key={`${row.label}-point`} cx={safeRows.length === 1 ? 300 : (index / (safeRows.length - 1)) * 560 + 20} cy={190 - ((row.actions + row.flags + row.tickets) / max) * 160} r="5" fill="#0089BF" />)}
        </svg>
      </div>
    </section>
  );
}

function CoachingNotes({ agentId, reviewerId, reviewerName }) {
  const [note, setNote] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!agentId) return undefined;
    return subscribeCoachingNote(
      agentId,
      (record) => {
        setNote(record?.note || "");
        setLastSaved(record || null);
      },
      () => setStatus("Could not load coaching notes.")
    );
  }, [agentId]);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");
    try {
      await saveCoachingNote(agentId, note.trim(), reviewerName, reviewerId);
      setStatus("Coaching notes saved.");
    } catch (error) {
      console.error("Could not save coaching note:", error);
      setStatus("Could not save coaching notes.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="glass-card p-5 sm:p-6">
      <h2 className="text-xl font-extrabold text-slate-950">Coaching Notes</h2>
      <p className="mt-1 text-sm leading-6 text-semantic-neutral">
        Keep a shared coaching note for this agent. Only team leads and quality supervisors can access it.
      </p>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        rows={6}
        maxLength={5000}
        className="input-field mt-5 resize-y"
        placeholder="Add coaching context, agreed actions, and follow-up points..."
      />
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-semibold text-semantic-neutral">
          {lastSaved?.updatedBy
            ? `Last saved by ${lastSaved.updatedBy} - ${formatTimestamp(lastSaved.updatedAt)}`
            : "No coaching note saved yet."}
        </p>
        <button type="button" onClick={handleSave} disabled={saving} className="btn-primary px-5">
          {saving ? "Saving..." : "Save Notes"}
        </button>
      </div>
      {status && <p className="mt-3 text-sm font-semibold text-brand-primary">{status}</p>}
    </section>
  );
}

export default function AgentOverviewPage() {
  const { agentName: agentNameParam } = useParams();
  const [searchParams] = useSearchParams();
  const routeAgentId = searchParams.get("agentId");
  const [detailAgentId, setDetailAgentId] = useState(null);
  const { currentUser, role, userProfile } = useAuth();
  const [actions, setActions] = useState([]);
  const [flags, setFlags] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [directoryAgents, setDirectoryAgents] = useState([]);
  const [detailUser, setDetailUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("week");
  const [tab, setTab] = useState("Overview");
  const [selectedAgentId, setSelectedAgentId] = useState(ALL_AGENTS);
  const [reviewingId, setReviewingId] = useState("");
  const [exportStart, setExportStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return toDateInputValue(date);
  });
  const [exportEnd, setExportEnd] = useState(() => toDateInputValue(new Date()));
  const [exporting, setExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState("");

  const canViewTeam = role === "team_lead" || role === "quality_supervisor";
  const signedInName = userProfile?.name || currentUser?.displayName || currentUser?.email || "Agent";

  useEffect(() => {
    setSelectedAgentId(ALL_AGENTS);
  }, [agentNameParam]);

  useEffect(() => {
    if (role !== "team_lead") {
      setDirectoryAgents([]);
      return undefined;
    }

    return subscribeAgentUsers(
      setDirectoryAgents,
      () => setError("The agent directory could not be loaded.")
    );
  }, [role]);

  useEffect(() => {
    let active = true;
    let unsubscribers = [];
    setActions([]);
    setFlags([]);
    setTickets([]);
    setDetailAgentId(null);
    setLoading(true);
    setError("");
    async function subscribe() {
      try {
        const id = canViewTeam && agentNameParam
          ? routeAgentId || await resolveAgentId(agentNameParam) : null;
        if (!active) return;
        setDetailAgentId(id);
        const pending = new Set(["actions", "flags", "tickets"]);
        const receive = (key, setter) => (data) => {
          if (!active) return;
          setter(data);
          pending.delete(key);
          setLoading(pending.size > 0);
        };
        const fail = (key) => () => {
          if (!active) return;
          setError("Some records could not be loaded. Totals may be incomplete.");
          pending.delete(key);
          setLoading(pending.size > 0);
        };
        unsubscribers.push(
          subscribeAgentActions(
            receive("actions", setActions),
            fail("actions"),
            canViewTeam ? id : currentUser?.uid
          ),
          subscribeFlags(
            receive("flags", setFlags),
            fail("flags"),
            canViewTeam ? id : currentUser?.uid
          )
        );
        unsubscribers.push(subscribeTickets(receive("tickets", setTickets), fail("tickets"),
          canViewTeam ? id : currentUser?.uid));
      } catch (err) {
        if (active) {
          setError(err.message);
          setLoading(false);
        }
      }
    }
    subscribe();
    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [canViewTeam, currentUser?.uid, agentNameParam, routeAgentId]);

  useEffect(() => {
    let active = true;
    if (!detailAgentId) {
      setDetailUser(null);
      return undefined;
    }

    getUserById(detailAgentId).then((user) => {
      if (active) setDetailUser(user);
    });

    return () => {
      active = false;
    };
  }, [detailAgentId]);

  const scopedActions = useMemo(() => {
    if (canViewTeam) return actions;
    return actions.filter((action) => action.agentId === currentUser?.uid);
  }, [actions, canViewTeam, currentUser?.uid]);

  const scopedFlags = useMemo(() => {
    if (canViewTeam) return flags;
    return flags.filter(
      (flag) =>
        flag.agentId === currentUser?.uid ||
        getAgentName(flag) === signedInName ||
        getAgentName(flag) === currentUser?.email
    );
  }, [canViewTeam, currentUser?.email, currentUser?.uid, flags, signedInName]);

  const scopedTickets = useMemo(() => {
    if (canViewTeam) return tickets;
    return tickets.filter((ticket) => ticket.createdById === currentUser?.uid);
  }, [canViewTeam, currentUser?.uid, tickets]);

  const observedAgents = useMemo(() => {
    const identities = new Map();
    [...scopedActions, ...scopedFlags, ...scopedTickets].forEach((row) => {
      const id = row.agentId || row.createdById;
      if (id) identities.set(id, getAgentName(row));
    });
    return [...identities].map(([id, name]) => ({ id, name }));
  }, [scopedActions, scopedFlags, scopedTickets]);

  const agentOptions = useMemo(() => {
    const source = role === "team_lead"
      ? directoryAgents.map((agent) => ({
          id: agent.id,
          name: agent.name || agent.email || "Unnamed Agent",
        }))
      : observedAgents;
    return [{ id: ALL_AGENTS, name: ALL_AGENTS }, ...source];
  }, [directoryAgents, observedAgents, role]);

  const selectedAgentName = agentNameParam ||
    agentOptions.find((agent) => agent.id === selectedAgentId)?.name || ALL_AGENTS;

  const periodActions = scopedActions.filter((action) => isInPeriod(action, ["timestamp"], period));
  const periodFlags = scopedFlags.filter((flag) => isInPeriod(flag, ["timestamp"], period));
  const periodTickets = scopedTickets.filter((ticket) =>
    isInPeriod(ticket, ["createdAt", "updatedAt"], period)
  );

  const visibleActions =
    canViewTeam && !detailAgentId && selectedAgentId !== ALL_AGENTS
      ? periodActions.filter((action) => action.agentId === selectedAgentId)
      : periodActions;
  const visibleFlags =
    canViewTeam && !detailAgentId && selectedAgentId !== ALL_AGENTS
      ? periodFlags.filter((flag) => flag.agentId === selectedAgentId)
      : periodFlags;
  const visibleTickets =
    canViewTeam && !detailAgentId && selectedAgentId !== ALL_AGENTS
      ? periodTickets.filter((ticket) => ticket.createdById === selectedAgentId)
      : periodTickets;

  const openFlags = visibleFlags.filter((flag) => !flag.reviewed);
  const criticalFlags = visibleFlags.filter((flag) => flag.type === "critical");
  const recentVisibleFlags = useMemo(
    () => [...visibleFlags]
      .sort((a, b) => (getDate(b, ["timestamp"])?.getTime() || 0) - (getDate(a, ["timestamp"])?.getTime() || 0))
      .slice(0, 6),
    [visibleFlags]
  );
  const todayFlags = visibleFlags.filter((flag) => isInPeriod(flag, ["timestamp"], "day"));
  const todayCriticalFlags = todayFlags.filter((flag) => flag.type === "critical");
  const todaySoftSkillFlags = todayFlags.filter((flag) => flag.type === "soft_skill");
  const qualityScore = calculateQualityScore(visibleActions, visibleFlags);
  const mistakeRate = visibleActions.length
    ? Math.round((visibleFlags.length / visibleActions.length) * 100)
    : 0;

  const agentBreakdown = useMemo(() => {
    const identities = new Map();
    [...periodActions, ...periodFlags, ...periodTickets].forEach((row) => {
      const id = row.agentId || row.createdById;
      if (id) identities.set(id, getAgentName(row));
    });
    return [...identities].map(([id, name]) => {
      const agentActions = periodActions.filter((row) => row.agentId === id);
      const agentFlags = periodFlags.filter((row) => row.agentId === id);
      const agentTickets = periodTickets.filter((row) => row.createdById === id);
      return {
        id, name, calls: agentActions.length, mistakes: agentFlags.length,
        open: agentFlags.filter((flag) => !flag.reviewed).length,
        tickets: agentTickets.length, score: calculateQualityScore(agentActions, agentFlags),
      };
    })
      .sort((a, b) => a.score - b.score || b.mistakes - a.mistakes);
  }, [periodActions, periodFlags, periodTickets]);

  const repeatedMistakes = countBy(visibleFlags, (flag) => flag.matchedPhrase || "Review needed");
  const actionTrends = countBy(visibleActions, (action) => action.actionType || "Unlabeled Action");
  const ticketDepartmentTrends = countBy(visibleTickets, (ticket) => ticket.department || "General");
  const ticketStatusTrends = countBy(visibleTickets, (ticket) => ticket.status || "Open");
  const ticketTitleTrends = countBy(visibleTickets, (ticket) => ticket.title || "Untitled Ticket");
  const activityBuckets = getActivityBuckets(visibleActions, visibleFlags, visibleTickets, period);

  const handleMarkReviewed = async (flagId) => {
    setReviewingId(flagId);
    try {
      await markFlagReviewed(flagId);
    } finally {
      setReviewingId("");
    }
  };

  const handleExport = async () => {
    if (!detailAgentId || !exportStart || !exportEnd) return;
    const startDate = new Date(`${exportStart}T00:00:00`);
    const endDate = new Date(`${exportEnd}T23:59:59.999`);
    if (startDate > endDate) {
      setExportStatus("The start date must be before the end date.");
      return;
    }

    setExporting(true);
    setExportStatus("");
    try {
      const [exportFlags, exportActions] = await Promise.all([
        getAgentFlagsByDateRange(detailAgentId, startDate, endDate),
        getAgentActionsByDateRange(detailAgentId, startDate, endDate),
      ]);
      const rows = [
        ...exportFlags.map((flag) => ({
          date: getDate(flag, ["timestamp"]),
          type: flag.type || "flag",
          matchedPhrase: flag.matchedPhrase || "",
          transcriptSnippet: flag.transcriptSnippet || "",
          reviewed: flag.reviewed ? "Yes" : "No",
        })),
        ...exportActions.map((action) => ({
          date: getDate(action, ["timestamp"]),
          type: "action",
          matchedPhrase: action.actionType || "",
          transcriptSnippet: action.source || "",
          reviewed: "",
        })),
      ].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

      const header = ["date", "type", "matchedPhrase", "transcriptSnippet", "reviewed"];
      const csv = [
        header.map(csvCell).join(","),
        ...rows.map((row) => [
          row.date ? row.date.toLocaleString() : "Pending",
          row.type,
          row.matchedPhrase,
          row.transcriptSnippet,
          row.reviewed,
        ].map(csvCell).join(",")),
      ].join("\r\n");
      const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${agentNameParam.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-history-${exportStart}-to-${exportEnd}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportStatus(`Exported ${rows.length} records.`);
    } catch (error) {
      console.error("Could not export agent history:", error);
      setExportStatus("Could not export this history. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const renderAgentSimpleOverview = () => (
    <>
      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Score"
          value={visibleActions.length || visibleFlags.length ? qualityScore : "New"}
          tone="primary"
          helper={visibleActions.length || visibleFlags.length ? "Current period" : "No coaching data yet"}
        />
        <MetricCard label="Calls" value={visibleActions.length} helper="Logged actions" />
        <MetricCard label="Mistakes" value={visibleFlags.length} tone="error" />
        <MetricCard label="Open Items" value={openFlags.length} tone="warning" />
        <MetricCard label="Tickets" value={visibleTickets.length} tone="success" />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <TrendBars
          title="Your Repeated Mistakes"
          subtitle="The coaching themes that appear most often for you."
          rows={repeatedMistakes}
          emptyText="Quality records are available to your team lead and quality supervisor."
        />
        <TrendBars
          title="Your Ticket Types"
          subtitle="The customer cases you handled most."
          rows={ticketDepartmentTrends}
          emptyText="No tickets in this period."
        />
      </div>
    </>
  );

  const renderLeadershipAnalytics = () => (
    <>
      {agentNameParam && detailAgentId && (
        <section className="glass-card mb-5 p-5 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-brand-faint text-xl font-extrabold text-brand-primary">
                {(detailUser?.name || agentNameParam).slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="label-field">User Profile</p>
                <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
                  {detailUser?.name || agentNameParam}
                </h2>
                <p className="mt-1 text-sm font-semibold text-semantic-neutral">
                  {detailUser?.email || "Email not available"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:min-w-[260px]">
              <div>
                <p className="label-field">Role</p>
                <p className="mt-1 font-bold capitalize text-slate-950">
                  {(detailUser?.role || "agent").replaceAll("_", " ")}
                </p>
              </div>
              <div>
                <p className="label-field">Account Created</p>
                <p className="mt-1 font-bold text-slate-950">
                  {detailUser?.createdAt ? formatTimestamp(detailUser.createdAt) : "Not available"}
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {agentNameParam && detailAgentId && (
        <section className="glass-card mb-5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-950">Export Flag History</h2>
              <p className="mt-1 text-sm leading-6 text-semantic-neutral">
                Download flags and logged actions for a coaching conversation.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="text-sm font-bold text-slate-700">
                From
                <input
                  type="date"
                  value={exportStart}
                  max={exportEnd}
                  onChange={(event) => setExportStart(event.target.value)}
                  className="input-field mt-2"
                />
              </label>
              <label className="text-sm font-bold text-slate-700">
                To
                <input
                  type="date"
                  value={exportEnd}
                  min={exportStart}
                  onChange={(event) => setExportEnd(event.target.value)}
                  className="input-field mt-2"
                />
              </label>
              <button type="button" onClick={handleExport} disabled={exporting} className="btn-primary px-5">
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>
          {exportStatus && <p className="mt-3 text-sm font-semibold text-brand-primary">{exportStatus}</p>}
        </section>
      )}

      <section className="sticky top-[118px] z-30 mb-5 space-y-3 py-2 lg:top-0">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {TABS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-extrabold transition-colors ${
                tab === item
                  ? "bg-brand-primary text-white shadow-card"
                  : "bg-white/70 text-semantic-neutral shadow-sm backdrop-blur hover:bg-white hover:text-brand-primary"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-3xl bg-white/70 p-3 shadow-sm backdrop-blur sm:flex-row sm:items-end">
          {PERIODS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPeriod(item.id)}
              className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${
                period === item.id
                  ? "bg-white text-brand-primary shadow-card"
                  : "bg-white/60 text-semantic-neutral backdrop-blur hover:bg-white"
              }`}
            >
              {item.label}
            </button>
          ))}

          {!agentNameParam && (
            <label className="sm:ml-auto sm:min-w-[240px]">
              <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-semantic-neutral">
                Agent filter
              </span>
              <select
                value={selectedAgentId}
                onChange={(event) => setSelectedAgentId(event.target.value)}
                className="input-field py-2.5"
                aria-label="Filter overview by agent"
              >
                {agentOptions.map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricCard label="Score" value={qualityScore} tone="primary" />
        <MetricCard label="Calls" value={visibleActions.length} />
        <MetricCard label="Tickets" value={visibleTickets.length} tone="success" />
        <MetricCard label="Mistakes" value={visibleFlags.length} tone="error" />
        <MetricCard label="Open" value={openFlags.length} tone="warning" />
        <MetricCard label="Mistake Rate" value={`${mistakeRate}%`} />
      </section>

      {agentNameParam && detailAgentId && (
        <div className="mb-5 grid grid-cols-1 gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="glass-card p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-slate-950">Today's Flags</h2>
            <p className="mt-1 text-sm text-semantic-neutral">Critical and coaching flags recorded since midnight.</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <MetricCard label="Critical" value={todayCriticalFlags.length} tone="error" />
              <MetricCard label="Soft Skill" value={todaySoftSkillFlags.length} tone="warning" />
            </div>
          </section>
        </div>
      )}

      {tab === "Overview" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <ActivityDashboard rows={activityBuckets} period={period} />
          <TrendBars title="Most Logged Call Actions" rows={actionTrends} />
          <TrendBars title="Most Raised Ticket Departments" rows={ticketDepartmentTrends} />
          <TrendBars title="Repeated Mistakes" rows={repeatedMistakes} />
          <TrendBars title="Ticket Status Mix" rows={ticketStatusTrends} />
        </div>
      )}

      {tab === "Mistakes" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <TrendBars title="Repeated Mistakes" rows={repeatedMistakes} />
          <section className="glass-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">Recent Mistakes</h2>
                <p className="mt-1 text-sm text-semantic-neutral">
                  Showing the latest {Math.min(recentVisibleFlags.length, 6)} of {visibleFlags.length} flags.
                </p>
              </div>
              <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-extrabold text-semantic-error">
                {criticalFlags.length} critical
              </span>
            </div>
            <div className="space-y-3">
              {recentVisibleFlags.map((flag) => (
                <article key={flag.id} className="rounded-2xl border border-surface-border bg-surface-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-faint text-sm font-extrabold text-brand-primary">
                          {getAgentName(flag).slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-extrabold text-slate-950">{getAgentName(flag)}</p>
                          <p className="text-xs font-semibold text-semantic-neutral">Responsible agent</p>
                        </div>
                        {flag.agentId && (
                          <Link
                            to={`/overview/agents/${encodeURIComponent(getAgentName(flag))}?agentId=${encodeURIComponent(flag.agentId)}`}
                            className="text-sm font-extrabold text-brand-primary hover:text-brand-light sm:ml-auto"
                          >
                            View agent
                          </Link>
                        )}
                      </div>
                      <p className="font-extrabold text-slate-950">
                        {flag.matchedPhrase || "Review needed"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-semantic-neutral">
                        {flag.type === "critical" ? "Critical" : "Soft skill"} · {formatTimestamp(flag.timestamp)}
                      </p>
                      {flag.transcriptSnippet && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">
                          {flag.transcriptSnippet}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={flag.reviewed || reviewingId === flag.id}
                      onClick={() => handleMarkReviewed(flag.id)}
                      className="rounded-2xl bg-brand-primary px-4 py-2 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light disabled:opacity-50"
                    >
                      {flag.reviewed ? "Reviewed" : reviewingId === flag.id ? "Saving..." : "Mark Reviewed"}
                    </button>
                  </div>
                </article>
              ))}
              {!visibleFlags.length && (
                <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
                  No mistakes in this period.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {tab === "Agents" && (
        <div className="space-y-5">
          <TrendBars
            title="Agent Quality Scores"
            subtitle="Select an agent card below to open their full diagrams and coaching record."
            rows={agentBreakdown.map((agent) => ({ label: agent.name, value: agent.score }))}
            emptyText="No agent performance records in this period."
          />
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {agentBreakdown.map((agent) => (
            <Link
              key={agent.id}
              to={`/overview/agents/${encodeURIComponent(agent.name)}?agentId=${encodeURIComponent(agent.id)}`}
              className="glass-card p-5 transition-all hover:-translate-y-0.5 hover:border-brand-primary"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-950">{agent.name}</h2>
                  <p className="mt-1 text-sm text-semantic-neutral">Open full agent diagrams</p>
                </div>
                <p className="text-3xl font-extrabold text-brand-primary">{agent.score}</p>
              </div>
              <div className="mt-5 grid grid-cols-4 gap-2 text-center text-sm">
                <span className="rounded-2xl border border-surface-border bg-surface-card px-2 py-3 font-bold text-semantic-neutral">{agent.calls} calls</span>
                <span className="rounded-2xl border border-surface-border bg-surface-card px-2 py-3 font-bold text-semantic-neutral">{agent.tickets} tickets</span>
                <span className="rounded-2xl border border-surface-border bg-surface-card px-2 py-3 font-bold text-semantic-neutral">{agent.mistakes} flags</span>
                <span className="rounded-2xl border border-surface-border bg-surface-card px-2 py-3 font-bold text-semantic-neutral">{agent.open} open</span>
              </div>
            </Link>
            ))}
          </section>
        </div>
      )}

      {tab === "Tickets" && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <TrendBars title="Most Raised Ticket Departments" rows={ticketDepartmentTrends} />
          <TrendBars title="Most Repeated Ticket Titles" rows={ticketTitleTrends} />
          <TrendBars title="Ticket Status Mix" rows={ticketStatusTrends} />
          <section className="glass-card p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-slate-950">Recent Tickets</h2>
            <div className="mt-5 space-y-3">
              {visibleTickets.slice(0, 8).map((ticket) => (
                <article key={ticket.id} className="rounded-2xl border border-surface-border bg-surface-card p-4">
                  <p className="font-extrabold text-slate-950">{ticket.title || "Untitled Ticket"}</p>
                  <p className="mt-1 text-sm text-semantic-neutral">
                    {ticket.department || "General"} · {ticket.status || "Open"} · {getAgentName(ticket)}
                  </p>
                </article>
              ))}
              {!visibleTickets.length && (
                <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
                  No tickets in this period.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {agentNameParam && detailAgentId && (
        <div className="mt-5">
          <CoachingNotes
            agentId={detailAgentId}
            reviewerId={currentUser?.uid || ""}
            reviewerName={signedInName}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="page-bg">
      <Sidebar />

      <main className="min-h-screen px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 glass-card p-5 sm:p-7">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              {canViewTeam ? "Analytics Command Center" : "My Overview"}
            </p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-4xl">
                  {canViewTeam ? "Trends & Performance" : "My Numbers"}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-semantic-neutral sm:text-base">
                  {canViewTeam
                    ? "Switch between tickets, mistakes, agents, and overall performance trends."
                    : "A simple view of your score, repeated mistakes, tickets, and recent call activity."}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {agentNameParam && (
                  <Link
                    to="/overview"
                    className="rounded-xl border border-surface-border bg-surface-card px-4 py-2.5 text-sm font-extrabold text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-faint"
                  >
                    Back to Overview
                  </Link>
                )}
                <div className="rounded-2xl border border-surface-border bg-surface-card px-4 py-3 text-sm font-bold text-semantic-neutral">
                  Viewing:{" "}
                  <span className="text-brand-primary">
                    {canViewTeam ? selectedAgentName : signedInName}
                  </span>
                </div>
              </div>
            </div>
          </header>

          {error && (
            <div className="mb-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-semantic-warning">
              {error}
            </div>
          )}

          {loading ? (
            <section className="glass-card p-10 text-center text-sm font-semibold text-semantic-neutral">
              Loading performance data...
            </section>
          ) : canViewTeam ? (
            renderLeadershipAnalytics()
          ) : (
            renderAgentSimpleOverview()
          )}
        </div>
      </main>
    </div>
  );
}

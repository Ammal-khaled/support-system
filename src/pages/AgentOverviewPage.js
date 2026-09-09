import { useCallback, useEffect, useMemo, useState } from "react";
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
  subscribeUsers,
} from "../services/firestore";

const ALL_AGENTS = "All Agents";
const PERIODS = [
  { id: "day", label: "Today", days: 1 },
  { id: "week", label: "This Week", days: 7 },
  { id: "month", label: "This Month", days: 30 },
];
const TABS = ["Overview", "Mistakes", "Support Requests", "Agents", "Tickets"];

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
  if (periodId === "month") {
    start.setDate(1);
  } else {
    start.setDate(start.getDate() - (period.days - 1));
  }
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

function recordMatchesSearch(row, fields, search) {
  if (!search) return true;
  return fields.some((field) => String(row[field] || "").toLowerCase().includes(search));
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

function MetricCard({ label, value, tone = "neutral", helper, onClick, destination }) {
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
  const clickable = typeof onClick === "function";
  const content = (
    <>
      <div className={`absolute inset-x-0 top-0 h-1.5 ${toneStyles.accent}`} />
      <div className="flex h-full min-h-[184px] flex-col justify-between p-5 pt-7">
        <p className="min-h-[32px] text-xs font-extrabold uppercase leading-4 tracking-[0.14em] text-semantic-neutral">
          {label}
        </p>
        <div>
          <p className={`font-mono text-3xl font-extrabold leading-none tracking-tight ${toneStyles.value}`}>{value}</p>
          {helper && <p className="mt-2 text-xs font-semibold text-semantic-neutral">{helper}</p>}
        </div>
        {destination && (
          <p className="min-h-[28px] text-[0.65rem] font-extrabold uppercase leading-4 tracking-[0.14em] text-semantic-neutral">
            Open {destination}
          </p>
        )}
      </div>
    </>
  );

  if (clickable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="glass-card relative min-h-[184px] overflow-hidden p-0 text-left transition-colors hover:border-brand-primary hover:bg-surface-panel focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      >
        {content}
      </button>
    );
  }

  return (
    <div className="glass-card relative min-h-[184px] overflow-hidden p-0">
      {content}
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

function RankedTiles({ title, subtitle, rows, emptyText = "No data yet.", tone = "primary" }) {
  const toneClasses = {
    primary: "border-brand-primary/40 bg-brand-primary/10 text-brand-primary",
    success: "border-semantic-success/40 bg-semantic-success/10 text-semantic-success",
    warning: "border-semantic-warning/40 bg-semantic-warning/10 text-semantic-warning",
    error: "border-semantic-error/40 bg-semantic-error/10 text-semantic-error",
  }[tone] || "border-brand-primary/40 bg-brand-primary/10 text-brand-primary";

  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-semantic-neutral">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.slice(0, 4).map((row, index) => (
            <div key={row.label} className="rounded-2xl border border-surface-border bg-surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm font-extrabold ${toneClasses}`}>
                  {index + 1}
                </span>
                <p className="font-mono text-2xl font-extrabold text-slate-950">{row.value}</p>
              </div>
              <p className="mt-4 text-sm font-extrabold leading-5 text-slate-900">{row.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function StatusMix({ title, subtitle, rows, emptyText = "No data yet." }) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const colors = ["#0089BF", "#22C55E", "#F59E0B", "#EF4444", "#64748B"];
  let offset = 25;
  const segments = rows.slice(0, 5).map((row, index) => {
    const length = total ? (row.value / total) * 75 : 0;
    const segment = {
      ...row,
      color: colors[index % colors.length],
      dasharray: `${length} ${100 - length}`,
      dashoffset: offset,
    };
    offset -= length;
    return segment;
  });

  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-semantic-neutral">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
          {emptyText}
        </p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[170px_1fr] sm:items-center">
          <div className="relative mx-auto h-40 w-40">
            <svg viewBox="0 0 42 42" className="h-full w-full rotate-[-90deg]" role="img" aria-label={`${title} distribution`}>
              <circle cx="21" cy="21" r="15.915" fill="none" stroke="#E2E8F0" strokeWidth="5" />
              {segments.map((row) => (
                <circle
                  key={row.label}
                  cx="21"
                  cy="21"
                  r="15.915"
                  fill="none"
                  stroke={row.color}
                  strokeWidth="5"
                  strokeDasharray={row.dasharray}
                  strokeDashoffset={row.dashoffset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="font-mono text-3xl font-extrabold text-slate-950">{total}</p>
              <p className="text-xs font-bold uppercase text-semantic-neutral">tickets</p>
            </div>
          </div>
          <div className="space-y-2">
            {segments.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl border border-surface-border bg-surface-card px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-extrabold text-slate-900">
                  <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="font-mono text-sm font-extrabold text-slate-950">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MistakeSummary({ title, subtitle, rows, emptyText = "No data yet." }) {
  return (
    <section className="glass-card p-5 sm:p-6">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-semantic-neutral">{subtitle}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
          {emptyText}
        </p>
      ) : (
        <div className="space-y-3">
          {rows.slice(0, 5).map((row, index) => (
            <div key={row.label} className="rounded-2xl border border-surface-border bg-surface-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-semantic-error">
                    Review theme {index + 1}
                  </p>
                  <p className="mt-1 truncate text-sm font-extrabold text-slate-950">{row.label}</p>
                </div>
                <span className="rounded-xl bg-red-50 px-3 py-2 font-mono text-sm font-extrabold text-semantic-error">
                  {row.value}
                </span>
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
  if (periodId === "month") {
    start.setDate(1);
  } else {
    start.setDate(start.getDate() - (period.days - 1));
  }
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
    return buckets;
  }

  if (periodId === "month") {
    const month = start.getMonth();
    const year = start.getFullYear();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const ranges = [
      [1, 8],
      [8, 15],
      [15, 22],
      [22, daysInMonth + 1],
    ];
    return ranges.map(([fromDay, toDay]) => {
      const from = new Date(year, month, fromDay);
      const to = new Date(year, month, toDay);
      return {
        label: `${fromDay}-${toDay - 1}`,
        actions: countRows(actions, ["timestamp"], from, to),
        flags: countRows(flags, ["timestamp"], from, to),
        tickets: countRows(tickets, ["createdAt", "updatedAt"], from, to),
      };
    });
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
  return buckets;
}

function ActivityDashboard({ rows, period }) {
  const safeRows = rows.length ? rows : [{ label: "No activity", actions: 0, flags: 0, tickets: 0 }];
  const totals = safeRows.reduce((sum, row) => ({
    actions: sum.actions + row.actions, flags: sum.flags + row.flags, tickets: sum.tickets + row.tickets,
  }), { actions: 0, flags: 0, tickets: 0 });
  const max = Math.max(...safeRows.map((row) => row.actions + row.flags + row.tickets), 1);
  const mid = Math.ceil(max / 2);
  const hasActivity = totals.actions + totals.flags + totals.tickets > 0;
  const ringItems = [["Support Requests", totals.actions, "#0089BF"], ["Flags", totals.flags, "#EF4444"], ["Tickets", totals.tickets, "#3B82F6"]];
  const periodLabel = period === "day" ? "today, by hour" : period === "month" ? "this month, by week segment" : "this week, by day";
  const chartLeft = 54;
  const chartRight = 610;
  const chartTop = 30;
  const chartBottom = 190;
  const chartHeight = chartBottom - chartTop;
  const groupWidth = (chartRight - chartLeft) / safeRows.length;
  const series = [["actions", "#0089BF"], ["flags", "#EF4444"], ["tickets", "#3B82F6"]];

  return (
    <section className="glass-card p-5 sm:p-6 lg:col-span-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-slate-950">Activity Timeline</h2>
          <p className="mt-1 text-sm text-semantic-neutral">
            Current view: {periodLabel}. Each bucket totals support requests, flags, and tickets.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-semantic-neutral">
          {ringItems.map(([label, , color]) => <span key={label} className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />{label}</span>)}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-surface-border bg-slate-50/70 p-4">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-semantic-neutral">
              Total Records Trend
            </p>
            <p className="mt-1 text-xs font-semibold text-semantic-neutral">
              Y-axis: records per bucket. X-axis: {period === "day" ? "hours" : period === "month" ? "1–7, 8–14, 15–21, 22–month end" : "days"}.
            </p>
          </div>
          <p className="font-mono text-xs font-extrabold text-brand-primary">
            Max bucket: {max}
          </p>
        </div>
        {!hasActivity ? (
          <p className="rounded-card border border-surface-border bg-surface-card p-5 text-sm font-semibold text-semantic-neutral">
            No activity has been recorded for this current filter yet.
          </p>
        ) : (
        <svg viewBox="0 0 640 250" className="h-56 w-full" preserveAspectRatio="none" role="img" aria-label="Bar chart of support requests, flags, and tickets grouped by time bucket">
          {[30, 110, 190].map((y) => (
            <line key={y} x1="54" y1={y} x2="610" y2={y} stroke="#CBD5E1" strokeDasharray={y === 190 ? "" : "5 7"} />
          ))}
          <line x1="54" y1="20" x2="54" y2="190" stroke="#94A3B8" />
          <line x1="54" y1="190" x2="610" y2="190" stroke="#94A3B8" />
          <text x="12" y="34" className="fill-slate-500 text-[13px] font-bold">{max}</text>
          <text x="12" y="114" className="fill-slate-500 text-[13px] font-bold">{mid}</text>
          <text x="12" y="194" className="fill-slate-500 text-[13px] font-bold">0</text>
          {safeRows.map((row, index) => {
            const barWidth = Math.min(24, Math.max(8, (groupWidth - 20) / 3));
            const barGap = 4;
            const totalBarsWidth = (barWidth * 3) + (barGap * 2);
            const groupStart = chartLeft + (index * groupWidth) + ((groupWidth - totalBarsWidth) / 2);
            const showLabel = period !== "day" || index % 4 === 0 || index === safeRows.length - 1;

            return (
              <g key={`${row.label}-bucket`}>
                {series.map(([key, color], seriesIndex) => {
                  const value = row[key];
                  const height = (value / max) * chartHeight;
                  const x = groupStart + (seriesIndex * (barWidth + barGap));
                  const y = chartBottom - height;
                  return (
                    <rect key={key} x={x} y={y} width={barWidth} height={Math.max(height, value ? 2 : 0)} rx="2" fill={color}>
                      <title>{`${row.label}: ${value} ${key === "actions" ? "support requests" : key}`}</title>
                    </rect>
                  );
                })}
                {showLabel && (
                  <text x={chartLeft + (index * groupWidth) + (groupWidth / 2)} y="226" textAnchor="middle" className="fill-slate-500 text-[12px] font-bold">
                    {row.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        )}
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ringItems.map(([label, value, color]) => (
          <div key={label} className="rounded-2xl border border-surface-border bg-surface-card px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-semantic-neutral">
              <i className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              {label}
            </p>
            <p className="mt-2 font-mono text-2xl font-extrabold text-slate-950">{value}</p>
          </div>
        ))}
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
        Keep a shared coaching note for this agent. Only team leads and Quality Control can access it.
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
  const [allUsers, setAllUsers] = useState([]);
  const [detailUser, setDetailUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("week");
  const [tab, setTab] = useState("Overview");
  const [recordQuery, setRecordQuery] = useState("");
  const [selectedMistake, setSelectedMistake] = useState(null);
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
    if (!canViewTeam) {
      setDirectoryAgents([]);
      return undefined;
    }

    return subscribeAgentUsers(
      setDirectoryAgents,
      () => setError("The agent directory could not be loaded.")
    );
  }, [canViewTeam]);

  useEffect(() => {
    if (!canViewTeam) {
      setAllUsers([]);
      return undefined;
    }

    return subscribeUsers(
      setAllUsers,
      () => setError("The user directory could not be loaded.")
    );
  }, [canViewTeam]);

  const inactiveUserIds = useMemo(
    () => new Set(allUsers
      .filter((user) => user.disabled || user.role === "disabled")
      .map((user) => user.id)),
    [allUsers]
  );

  const isActiveOperationalRecord = useCallback((row) => {
    if (!canViewTeam) return true;
    const id = row.agentId || row.createdById;
    return !id || !inactiveUserIds.has(id);
  }, [canViewTeam, inactiveUserIds]);

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
    if (canViewTeam) return actions.filter(isActiveOperationalRecord);
    return actions.filter((action) => action.agentId === currentUser?.uid);
  }, [actions, canViewTeam, currentUser?.uid, isActiveOperationalRecord]);

  const scopedFlags = useMemo(() => {
    if (canViewTeam) return flags.filter(isActiveOperationalRecord);
    return flags.filter(
      (flag) =>
        flag.agentId === currentUser?.uid ||
        getAgentName(flag) === signedInName ||
        getAgentName(flag) === currentUser?.email
    );
  }, [canViewTeam, currentUser?.email, currentUser?.uid, flags, isActiveOperationalRecord, signedInName]);

  const scopedTickets = useMemo(() => {
    if (canViewTeam) return tickets.filter(isActiveOperationalRecord);
    return tickets.filter((ticket) => ticket.createdById === currentUser?.uid);
  }, [canViewTeam, currentUser?.uid, isActiveOperationalRecord, tickets]);

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

  const search = recordQuery.trim().toLowerCase();
  const displayActions = visibleActions.filter((action) =>
    recordMatchesSearch(action, ["id", "agentId", "agentName", "actionType", "note", "responseNote", "status", "source"], search)
  );
  const displayFlags = visibleFlags.filter((flag) =>
    recordMatchesSearch(flag, ["id", "agentId", "agentName", "type", "matchedPhrase", "transcriptSnippet", "feedback", "source"], search)
  );
  const displayTickets = visibleTickets.filter((ticket) =>
    recordMatchesSearch(ticket, ["id", "createdById", "createdByName", "agentName", "title", "customerName", "customerPhone", "accountNumber", "department", "priority", "status", "description", "nextAction"], search)
  );

  const openFlags = displayFlags.filter((flag) => !flag.reviewed);
  const criticalFlags = displayFlags.filter((flag) => flag.type === "critical");
  const recentVisibleFlags = useMemo(
    () => [...displayFlags]
      .sort((a, b) => (getDate(b, ["timestamp"])?.getTime() || 0) - (getDate(a, ["timestamp"])?.getTime() || 0))
      .slice(0, 6),
    [displayFlags]
  );
  const todayFlags = displayFlags.filter((flag) => isInPeriod(flag, ["timestamp"], "day"));
  const todayCriticalFlags = todayFlags.filter((flag) => flag.type === "critical");
  const todaySoftSkillFlags = todayFlags.filter((flag) => flag.type === "soft_skill");
  const qualityScore = calculateQualityScore(displayActions, displayFlags);

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
        id, name, supportRequests: agentActions.length, mistakes: agentFlags.length,
        open: agentFlags.filter((flag) => !flag.reviewed).length,
        tickets: agentTickets.length, score: calculateQualityScore(agentActions, agentFlags),
      };
    })
      .sort((a, b) => a.score - b.score || b.mistakes - a.mistakes);
  }, [periodActions, periodFlags, periodTickets]);

  const repeatedMistakes = countBy(displayFlags, (flag) => flag.matchedPhrase || "Review needed");
  const actionTrends = countBy(displayActions, (action) => action.actionType || "Unlabeled Support Request");
  const ticketDepartmentTrends = countBy(displayTickets, (ticket) => ticket.department || "General");
  const ticketStatusTrends = countBy(displayTickets, (ticket) => ticket.status || "Open");
  const ticketTitleTrends = countBy(displayTickets, (ticket) => ticket.title || "Untitled Ticket");
  const activityBuckets = getActivityBuckets(displayActions, displayFlags, displayTickets, period);

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
          type: "support_request",
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
      <section className="mb-5 glass-card p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[auto_1fr] lg:items-end">
          <div>
            <p className="label-field mb-2">Period</p>
            <div className="flex gap-2 overflow-x-auto">
            {PERIODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  period === item.id
                    ? "bg-brand-primary text-white shadow-card"
                    : "border border-surface-border bg-surface-card text-semantic-neutral hover:border-brand-primary hover:text-brand-primary"
                }`}
              >
                {item.label}
              </button>
            ))}
            </div>
          </div>
          <label>
            <span className="label-field mb-2 block">Search Records</span>
            <input
              type="search"
              value={recordQuery}
              onChange={(event) => setRecordQuery(event.target.value)}
              className="input-field"
              placeholder="Search your tickets, support requests, mistakes, or IDs..."
            />
          </label>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard
          label="Score"
          value={displayActions.length || displayFlags.length ? qualityScore : "New"}
          tone="primary"
          helper={displayActions.length || displayFlags.length ? "Current period" : "No coaching data yet"}
        />
        <MetricCard label="Support Requests" value={displayActions.length} helper="Raised by you" />
        <MetricCard label="Mistakes" value={displayFlags.length} tone="error" />
        <MetricCard label="Open Items" value={openFlags.length} tone="warning" />
        <MetricCard label="Tickets" value={displayTickets.length} tone="success" />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <MistakeSummary
          title="Your Repeated Mistakes"
          subtitle="The coaching themes that appear most often for you."
          rows={repeatedMistakes}
          emptyText="Quality records are available to your team lead and Quality Control."
        />
        <RankedTiles
          title="Your Ticket Types"
          subtitle="The customer cases you handled most."
          rows={ticketDepartmentTrends}
          emptyText="No tickets in this period."
          tone="success"
        />
      </div>

      <section className="glass-card mt-5 p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="text-xl font-extrabold text-slate-950">Recent Mistake Details</h2>
          <p className="mt-1 text-sm text-semantic-neutral">
            Open a coaching item to see when it happened, what phrase was matched, and what feedback was recorded.
          </p>
        </div>
        {recentVisibleFlags.length === 0 ? (
          <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
            No mistakes match this period or search.
          </p>
        ) : (
          <div className="space-y-3">
            {recentVisibleFlags.map((flag) => (
              <button
                key={flag.id}
                type="button"
                onClick={() => setSelectedMistake(flag)}
                className="w-full rounded-2xl border border-surface-border bg-surface-card p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-faint/20"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-950">
                      {flag.matchedPhrase || "Review needed"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-semantic-neutral">
                      {flag.type === "critical" ? "Critical" : "Soft skill"} · {formatTimestamp(flag.timestamp)}
                    </p>
                  </div>
                  <span className="rounded-xl bg-brand-faint px-3 py-2 text-sm font-extrabold text-brand-primary">
                    Open details
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
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
                Download flags and support requests for a coaching conversation.
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

        <div className="grid gap-3 rounded-3xl bg-white/70 p-3 shadow-sm backdrop-blur xl:grid-cols-[auto_1fr_260px] xl:items-end">
          <div>
            <p className="label-field mb-2">Period</p>
            <div className="flex gap-2 overflow-x-auto">
              {PERIODS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setPeriod(item.id)}
                  className={`shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
                    period === item.id
                      ? "bg-brand-primary text-white shadow-card"
                      : "border border-surface-border bg-surface-card text-semantic-neutral hover:border-brand-primary hover:text-brand-primary"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <label>
            <span className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-semantic-neutral">
              Search records
            </span>
            <input
              type="search"
              value={recordQuery}
              onChange={(event) => setRecordQuery(event.target.value)}
              className="input-field py-2.5"
              placeholder="Search agent, ticket, phrase, status, note, or ID..."
            />
          </label>

          {!agentNameParam && (
            <label>
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

      <section className="metric-grid mb-6 grid gap-3">
        <MetricCard label="Score" value={qualityScore} tone="primary" destination="Overview" onClick={() => setTab("Overview")} />
        <MetricCard label="Support Requests" value={displayActions.length} destination="Support Requests" onClick={() => setTab("Support Requests")} />
        <MetricCard label="Tickets" value={displayTickets.length} tone="success" destination="Tickets" onClick={() => setTab("Tickets")} />
        <MetricCard label="Mistakes" value={displayFlags.length} tone="error" destination="Mistakes" onClick={() => setTab("Mistakes")} />
        <MetricCard label="Open" value={openFlags.length} tone="warning" destination="Mistakes" onClick={() => setTab("Mistakes")} />
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
          <RankedTiles
            title="Most Requested Support Areas"
            subtitle="Topics agents asked help with most often."
            rows={actionTrends}
            emptyText="No support requests in this period."
          />
          <RankedTiles
            title="Most Raised Ticket Departments"
            subtitle="Departments receiving the most ticket activity."
            rows={ticketDepartmentTrends}
            emptyText="No tickets in this period."
            tone="success"
          />
          <MistakeSummary
            title="Repeated Mistakes"
            subtitle="The most common coaching or quality themes."
            rows={repeatedMistakes}
            emptyText="No mistakes in this period."
          />
          <StatusMix
            title="Ticket Status Mix"
            subtitle="Open, pending, and resolved ticket distribution."
            rows={ticketStatusTrends}
            emptyText="No ticket status data in this period."
          />
        </div>
      )}

      {tab === "Support Requests" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <RankedTiles
            title="Most Requested Support Areas"
            subtitle="Where agents asked for help during the selected period."
            rows={actionTrends}
            emptyText="No support requests in this period."
          />
          <section className="glass-card p-5 sm:p-6">
            <div className="mb-5">
              <h2 className="text-xl font-extrabold text-slate-950">Recent Support Requests</h2>
              <p className="mt-1 text-sm text-semantic-neutral">
                Showing agents who raised help requests and the topic they selected.
              </p>
            </div>
            {displayActions.length === 0 ? (
              <p className="rounded-2xl bg-white/60 p-5 text-sm font-semibold text-semantic-neutral">
                No support requests in this period.
              </p>
            ) : (
              <div className="space-y-3">
                {displayActions.slice(0, 12).map((action) => (
                  <article key={action.id} className="rounded-2xl border border-surface-border bg-surface-card p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-extrabold text-slate-950">
                          {getAgentName(action)}
                        </p>
                        <p className="mt-1 text-sm text-semantic-neutral">
                          Needs support with <span className="font-extrabold text-brand-primary">{action.actionType || "customer support"}</span>
                        </p>
                        <p className="mt-2 text-xs font-semibold text-semantic-neutral">
                          {formatTimestamp(action.timestamp)}
                        </p>
                      </div>
                      {action.agentId && (
                        <Link
                          to={`/overview/agents/${encodeURIComponent(getAgentName(action))}?agentId=${encodeURIComponent(action.agentId)}`}
                          className="rounded-xl border border-surface-border px-3 py-2 text-sm font-extrabold text-brand-primary transition-colors hover:border-brand-primary hover:bg-brand-faint"
                        >
                          View agent
                        </Link>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "Mistakes" && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[420px_1fr]">
          <MistakeSummary title="Repeated Mistakes" rows={repeatedMistakes} />
          <section className="glass-card p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-extrabold text-slate-950">Recent Mistakes</h2>
                <p className="mt-1 text-sm text-semantic-neutral">
                  Showing the latest {Math.min(recentVisibleFlags.length, 6)} of {displayFlags.length} flags.
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
                        {flag.kbArticleId && (
                          <Link
                            to={`/agent/policies/${encodeURIComponent(flag.kbArticleId)}`}
                            className="text-sm font-extrabold text-brand-primary hover:text-brand-light"
                          >
                            Open KB card
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
              {!displayFlags.length && (
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
                <span className="rounded-2xl border border-surface-border bg-surface-card px-2 py-3 font-bold text-semantic-neutral">{agent.supportRequests} requests</span>
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
          <RankedTiles title="Most Raised Ticket Departments" rows={ticketDepartmentTrends} tone="success" />
          <RankedTiles title="Most Repeated Ticket Titles" rows={ticketTitleTrends} tone="warning" />
          <StatusMix title="Ticket Status Mix" rows={ticketStatusTrends} />
          <section className="glass-card p-5 sm:p-6">
            <h2 className="text-xl font-extrabold text-slate-950">Recent Tickets</h2>
            <div className="mt-5 space-y-3">
              {displayTickets.slice(0, 8).map((ticket) => (
                <Link
                  key={ticket.id}
                  to={`/tickets?highlight=${encodeURIComponent(ticket.id)}`}
                  className="block rounded-2xl border border-surface-border bg-surface-card p-4 transition-colors hover:border-brand-primary hover:bg-brand-faint/20"
                >
                  <p className="font-extrabold text-slate-950">{ticket.title || "Untitled Ticket"}</p>
                  <p className="mt-1 text-sm text-semantic-neutral">
                    {ticket.department || "General"} · {ticket.status || "Open"} · {getAgentName(ticket)}
                  </p>
                  <p className="mt-3 text-xs font-extrabold uppercase tracking-[0.12em] text-brand-primary">
                    Open ticket
                  </p>
                </Link>
              ))}
              {!displayTickets.length && (
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

      {selectedMistake && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-card border border-surface-border bg-surface-card p-6 shadow-[0_28px_90px_rgba(2,6,23,0.35)]">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="label-field">Mistake Details</p>
                <h2 className="mt-1 text-2xl font-extrabold text-slate-950">
                  {selectedMistake.matchedPhrase || "Review needed"}
                </h2>
                <p className="mt-1 text-sm font-semibold text-semantic-neutral">
                  {selectedMistake.type === "critical" ? "Critical" : "Soft skill"} · {formatTimestamp(selectedMistake.timestamp)}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedMistake(null)} className="btn-secondary px-4 text-sm font-bold">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-2xl border border-surface-border bg-surface-bg p-4">
                <p className="label-field">Transcript Snippet</p>
                <p className="mt-2 text-sm leading-6 text-slate-900">
                  {selectedMistake.transcriptSnippet || "No transcript snippet was saved for this item."}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-border bg-surface-bg p-4">
                <p className="label-field">Feedback</p>
                <p className="mt-2 text-sm leading-6 text-slate-900">
                  {selectedMistake.feedback || "No feedback note was added yet."}
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-surface-border bg-surface-bg p-4">
                  <p className="label-field">Status</p>
                  <p className="mt-2 text-sm font-extrabold text-slate-950">
                    {selectedMistake.reviewed ? "Reviewed" : "Open"}
                  </p>
                </div>
                <div className="rounded-2xl border border-surface-border bg-surface-bg p-4">
                  <p className="label-field">Record ID</p>
                  <p className="mt-2 break-all font-mono text-xs font-bold text-semantic-neutral">
                    {selectedMistake.id}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

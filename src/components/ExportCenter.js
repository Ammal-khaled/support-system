import { useState } from "react";
import { downloadWorkbook, enrichExport } from "../services/exportWorkbook";
import {
  getActionTypes,
  getAfterCallReports,
  getAgentActions,
  getBannedPhrases,
  getFlags,
  getPolicies,
  getTicketEditRequests,
  getTickets,
  getUsers,
  getCoachingNotes,
} from "../services/firestore";

const EXPORTS = [
  ["users", "Users", getUsers],
  ["tickets", "Tickets", getTickets],
  ["ticket_edit_requests", "Ticket Edit Requests", getTicketEditRequests],
  ["flags", "Quality Flags", getFlags],
  ["agent_actions", "Support Requests", getAgentActions],
  ["after_call_reports", "After-Call Reports", getAfterCallReports],
  ["knowledge_base", "Knowledge Base", getPolicies],
  ["banned_phrases", "Flag Rules", getBannedPhrases],
  ["action_types", "Support Topics", getActionTypes],
  ["coaching_notes", "Coaching Notes", getCoachingNotes],
];

const DATE_FIELDS = ["timestamp", "createdAt", "updatedAt", "reviewedAt", "usedAt", "passwordChangedAt"];

function asDate(value) {
  if (!value) return null;
  const candidate = value?.toDate ? value.toDate() : value instanceof Date ? value : new Date(value);
  return Number.isNaN(candidate.getTime()) ? null : candidate;
}

function getExportDate(row) {
  return DATE_FIELDS
    .map((field) => asDate(row[field]))
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime())[0] || null;
}

function isWithinExportRange(row, startDate, endDate) {
  if (!startDate && !endDate) return true;
  const rowDate = getExportDate(row);
  if (!rowDate) return false;
  if (startDate && rowDate < new Date(`${startDate}T00:00:00`)) return false;
  if (endDate && rowDate > new Date(`${endDate}T23:59:59.999`)) return false;
  return true;
}

function normalizeValue(value, seen = new WeakSet(), depth = 0) {
  if (value?.toDate) return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (value?.path && typeof value.path === "string") return value.path;
  if (Array.isArray(value)) {
    if (depth > 8) return "[Max depth reached]";
    return value.map((item) => normalizeValue(item, seen, depth + 1));
  }
  if (value && typeof value === "object") {
    if (seen.has(value)) return "[Circular reference]";
    if (depth > 8) return "[Max depth reached]";
    seen.add(value);
    if (value.constructor && value.constructor !== Object) {
      return String(value);
    }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item, seen, depth + 1)]));
  }
  return value ?? "";
}

function csvCell(value) {
  const normalized = normalizeValue(value);
  const stringValue = typeof normalized === "object" ? JSON.stringify(normalized) : String(normalized);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function downloadFile(fileName, content, type) {
  const blob = new Blob(["\uFEFF", content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function rowsToCsv(rows) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  if (!headers.length) return "No records\n";
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
}

export default function ExportCenter() {
  const [loadingKey, setLoadingKey] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const loadAllData = async () => {
    if (startDate && endDate && startDate > endDate) throw new Error("The start date must be before the end date.");
    const users = await getUsers();
    const entries = await Promise.all(
      EXPORTS.map(async ([key, label, loader]) => {
        const rows = (await loader()).filter((row) => isWithinExportRange(row, startDate, endDate));
        return [key, { label, rows: rows.map((row) => enrichExport(row, users)) }];
      })
    );
    return Object.fromEntries(entries);
  };

  const exportOne = async (key, label, loader) => {
    setLoadingKey(key);
    setStatus("");
    setError("");
    try {
      if (startDate && endDate && startDate > endDate) throw new Error("The start date must be before the end date.");
      const users = await getUsers();
      const rows = (await loader()).filter((row) => isWithinExportRange(row, startDate, endDate));
      downloadFile(`aquadesk-${key}.csv`, rowsToCsv(rows.map((row) => enrichExport(row, users))), "text/csv;charset=utf-8");
      setStatus(`Exported ${rows.length} ${label.toLowerCase()} records.`);
    } catch (err) {
      console.error(`Failed to export ${key}:`, err);
      setError(err.message || `Could not export ${label}.`);
    } finally {
      setLoadingKey("");
    }
  };

  const exportEverything = async () => {
    setLoadingKey("all");
    setStatus("");
    setError("");
    try {
      const data = await loadAllData();
      await downloadWorkbook(`aquadesk-full-export-${new Date().toISOString().slice(0, 10)}.xlsx`, data);
      const total = Object.values(data).reduce((sum, item) => sum + item.rows.length, 0);
      setStatus(`Exported ${total} records across ${EXPORTS.length} datasets.`);
    } catch (err) {
      console.error("Failed to export all data:", err);
      setError(err.message || "Could not export all data.");
    } finally {
      setLoadingKey("");
    }
  };

  return (
    <section className="card p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="label-field">Data Export</p>
          <h2 className="card-header">Export Center</h2>
          <p className="card-subtext max-w-2xl">
            Download operational data for Team Lead and Quality review: tickets, support requests, flags, reports, users, and setup records.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="label-field">From</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="input-field min-w-[160px]" />
          </div>
          <div>
            <label className="label-field">To</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="input-field min-w-[160px]" />
          </div>
          <button type="button" onClick={() => { setStartDate(""); setEndDate(""); }} className="btn-secondary px-4 text-sm font-bold">
            Clear Dates
          </button>
          <button type="button" onClick={exportEverything} disabled={Boolean(loadingKey)} className="btn-primary px-5 text-sm">
            {loadingKey === "all" ? "Exporting..." : "Export Everything (Excel)"}
          </button>
        </div>
      </div>
      <p className="-mt-3 mb-5 text-xs font-semibold text-semantic-neutral">
        Date range uses the newest available record date, such as created, updated, reviewed, or call timestamp.
      </p>

      {status && (
        <div className="mb-5 rounded-xl border border-semantic-success/30 bg-semantic-success/15 p-4 text-sm font-semibold text-semantic-success">
          {status}
        </div>
      )}
      {error && (
        <div className="mb-5 rounded-xl border border-semantic-error/30 bg-semantic-error/15 p-4 text-sm font-semibold text-semantic-error">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {EXPORTS.map(([key, label, loader]) => (
          <button
            key={key}
            type="button"
            onClick={() => exportOne(key, label, loader)}
            disabled={Boolean(loadingKey)}
            className="rounded-card border border-surface-border bg-surface-bg p-4 text-left transition-colors hover:border-brand-primary hover:bg-surface-panel disabled:opacity-60"
          >
            <p className="text-sm font-extrabold text-slate-950">{label}</p>
            <p className="mt-2 text-xs font-semibold text-semantic-neutral">
              {loadingKey === key ? "Preparing CSV..." : "Download CSV"}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

import { useState } from "react";
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
];

function normalizeValue(value) {
  if (value?.toDate) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
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

  const loadAllData = async () => {
    const entries = await Promise.all(
      EXPORTS.map(async ([key, label, loader]) => {
        const rows = await loader();
        return [key, { label, rows: rows.map(normalizeValue) }];
      })
    );
    return Object.fromEntries(entries);
  };

  const exportOne = async (key, label, loader) => {
    setLoadingKey(key);
    setStatus("");
    setError("");
    try {
      const rows = (await loader()).map(normalizeValue);
      downloadFile(`aquadesk-${key}.csv`, rowsToCsv(rows), "text/csv;charset=utf-8");
      setStatus(`Exported ${rows.length} ${label.toLowerCase()} records.`);
    } catch (err) {
      console.error(`Failed to export ${key}:`, err);
      setError(`Could not export ${label}.`);
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
      downloadFile(
        `aquadesk-full-export-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(data, null, 2),
        "application/json;charset=utf-8"
      );
      const total = Object.values(data).reduce((sum, item) => sum + item.rows.length, 0);
      setStatus(`Exported ${total} records across ${EXPORTS.length} datasets.`);
    } catch (err) {
      console.error("Failed to export all data:", err);
      setError("Could not export all data.");
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
        <button type="button" onClick={exportEverything} disabled={Boolean(loadingKey)} className="btn-primary px-5 text-sm">
          {loadingKey === "all" ? "Exporting..." : "Export Everything"}
        </button>
      </div>

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

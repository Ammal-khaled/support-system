import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import { useAuth } from "../context/AuthContext";
import { createTicket, subscribeTickets, updateTicket } from "../services/firestore";

const EMPTY_FORM = {
  customerName: "",
  customerPhone: "",
  accountNumber: "",
  title: "",
  department: "Billing",
  priority: "Medium",
  status: "Open",
  description: "",
  nextAction: "",
};

const DEPARTMENTS = [
  "Billing",
  "Refunds",
  "Move In",
  "Move Out",
  "Clearance",
  "Registration",
  "Payments",
  "Service Status",
  "Accounts",
];

const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
const STATUSES = ["Open", "In Progress", "Waiting Customer", "Escalated", "Resolved", "Closed"];

function formatTimestamp(timestamp) {
  if (!timestamp?.toDate) return "Pending";
  return timestamp.toDate().toLocaleString();
}

function statusTone(status) {
  if (status === "Resolved" || status === "Closed") return "text-semantic-success bg-semantic-success/15";
  if (status === "Escalated" || status === "Urgent") return "text-semantic-error bg-semantic-error/15";
  if (status === "Waiting Customer") return "text-semantic-warning bg-semantic-warning/15";
  return "text-brand-primary bg-brand-faint";
}

function priorityTone(priority) {
  if (priority === "Urgent" || priority === "High") return "text-semantic-error bg-semantic-error/15";
  if (priority === "Medium") return "text-semantic-warning bg-semantic-warning/15";
  return "text-semantic-success bg-semantic-success/15";
}

export default function TicketsPage() {
  const { currentUser, userProfile, role } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [draft, setDraft] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const agentName = userProfile?.name || currentUser?.displayName || currentUser?.email || "Agent";
  const canViewTeam = role === "team_lead" || role === "quality_supervisor";

  useEffect(() => {
    const unsubscribe = subscribeTickets(
      (data) => {
        setTickets(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load tickets.");
        setLoading(false);
      },
      canViewTeam ? undefined : currentUser?.uid
    );

    return unsubscribe;
  }, [canViewTeam, currentUser?.uid]);

  const visibleTickets = useMemo(() => {
    const search = query.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus = statusFilter === "All" || ticket.status === statusFilter;
      const matchesOwner = canViewTeam || ticket.createdById === currentUser?.uid;
      const matchesSearch =
        !search ||
        [
          ticket.title,
          ticket.status,
          ticket.customerName,
          ticket.customerPhone,
          ticket.accountNumber,
          ticket.department,
          ticket.description,
          ticket.nextAction,
          ticket.createdByName,
          ticket.agentName,
        ].some((field) => String(field || "").toLowerCase().includes(search));

      return matchesStatus && matchesOwner && matchesSearch;
    });
  }, [canViewTeam, currentUser?.uid, query, statusFilter, tickets]);

  const selectedTicket = visibleTickets.find((ticket) => ticket.id === selectedId) || null;

  useEffect(() => {
    if (!selectedTicket) {
      setDraft(null);
      return;
    }

    setDraft({
      title: selectedTicket.title || "",
      customerName: selectedTicket.customerName || "",
      customerPhone: selectedTicket.customerPhone || "",
      accountNumber: selectedTicket.accountNumber || "",
      department: selectedTicket.department || "Billing",
      priority: selectedTicket.priority || "Medium",
      status: selectedTicket.status || "Open",
      description: selectedTicket.description || "",
      nextAction: selectedTicket.nextAction || "",
    });
  }, [selectedTicket]);

  const stats = useMemo(() => {
    const mineOrTeam = canViewTeam
      ? tickets
      : tickets.filter((ticket) => ticket.createdById === currentUser?.uid);

    return {
      total: mineOrTeam.length,
      open: mineOrTeam.filter((ticket) => ticket.status === "Open").length,
      active: mineOrTeam.filter((ticket) =>
        ["In Progress", "Waiting Customer", "Escalated"].includes(ticket.status)
      ).length,
      resolved: mineOrTeam.filter((ticket) => ["Resolved", "Closed"].includes(ticket.status)).length,
    };
  }, [canViewTeam, currentUser?.uid, tickets]);

  const handleFormChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleDraftChange = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const openTicketEditor = (id) => {
    setSelectedId(id);
    setIsEditorOpen(true);
  };

  const closeTicketEditor = () => {
    setIsEditorOpen(false);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.customerName.trim() || saving) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const created = await createTicket({
        ...form,
        title: form.title.trim(),
        customerName: form.customerName.trim(),
        customerPhone: form.customerPhone.trim(),
        accountNumber: form.accountNumber.trim(),
        description: form.description.trim(),
        nextAction: form.nextAction.trim(),
        createdById: currentUser?.uid || "",
        createdByName: agentName,
        assignedToId: currentUser?.uid || "",
        assignedToName: agentName,
      });

      setSelectedId(created.id);
      setForm(EMPTY_FORM);
      setMessage("Ticket created.");
      setIsEditorOpen(true);
      window.setTimeout(() => setMessage(""), 2200);
    } catch (err) {
      console.error("Failed to create ticket:", err);
      setError("Unable to create ticket.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (event) => {
    event.preventDefault();
    if (!selectedTicket || !draft || saving || !canViewTeam) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      await updateTicket(selectedTicket.id, {
        ...draft,
        title: draft.title.trim(),
        customerName: draft.customerName.trim(),
        customerPhone: draft.customerPhone.trim(),
        accountNumber: draft.accountNumber.trim(),
        description: draft.description.trim(),
        nextAction: draft.nextAction.trim(),
        lastEditedById: currentUser?.uid || "",
        lastEditedByName: agentName,
      });
      setMessage("Ticket updated.");
      setIsEditorOpen(false);
      window.setTimeout(() => setMessage(""), 2200);
    } catch (err) {
      console.error("Failed to update ticket:", err);
      setError("Unable to update ticket.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-bg">
      <Sidebar />

      <main className="min-h-screen px-4 pb-8 pt-[142px] sm:px-6 lg:ml-[260px] lg:px-10 lg:py-10">
        <div className="mx-auto max-w-7xl">
          <header className="mb-6 glass-card p-5 sm:p-7">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.18em] text-brand-primary">
              Ticket Desk
            </p>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h1 className="font-heading text-3xl font-extrabold tracking-tight text-current sm:text-4xl">
                  Customer Tickets
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-semantic-neutral sm:text-base">
                  Create, track, and update customer cases from one clean support queue.
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {[
                  ["Total", stats.total],
                  ["Open", stats.open],
                  ["Active", stats.active],
                  ["Done", stats.resolved],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-card border border-surface-border bg-surface-panel px-3 py-2 text-center">
                    <p className="text-[0.65rem] font-extrabold uppercase tracking-[0.12em] text-semantic-neutral">
                      {label}
                    </p>
                    <p className="mt-1 font-mono text-xl font-extrabold text-current">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </header>

          {(message || error) && (
            <div
              className={`mb-5 rounded-card border px-4 py-3 text-sm font-semibold ${
                error
                  ? "border-semantic-error/20 bg-semantic-error/10 text-semantic-error"
                  : "border-semantic-success/20 bg-semantic-success/10 text-semantic-success"
              }`}
            >
              {error || message}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_1fr]">
            <section className="space-y-5">
              <form onSubmit={handleCreate} className="glass-card p-5">
                <h2 className="card-header">Create Ticket</h2>
                <p className="card-subtext">Capture the customer issue while the call is still fresh.</p>

                <div className="mt-5 space-y-4">
                  <div>
                    <label className="label-field">Customer Name</label>
                    <input
                      value={form.customerName}
                      onChange={(event) => handleFormChange("customerName", event.target.value)}
                      className="input-field"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <label className="label-field">Phone</label>
                      <input
                        value={form.customerPhone}
                        onChange={(event) => handleFormChange("customerPhone", event.target.value)}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="label-field">Account</label>
                      <input
                        value={form.accountNumber}
                        onChange={(event) => handleFormChange("accountNumber", event.target.value)}
                        className="input-field"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-field">Ticket Title</label>
                    <input
                      value={form.title}
                      onChange={(event) => handleFormChange("title", event.target.value)}
                      className="input-field"
                      placeholder="e.g., Refund follow-up"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div>
                      <label className="label-field">Department</label>
                      <select
                        value={form.department}
                        onChange={(event) => handleFormChange("department", event.target.value)}
                        className="input-field"
                      >
                        {DEPARTMENTS.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label-field">Priority</label>
                      <select
                        value={form.priority}
                        onChange={(event) => handleFormChange("priority", event.target.value)}
                        className="input-field"
                      >
                        {PRIORITIES.map((priority) => (
                          <option key={priority} value={priority}>
                            {priority}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label-field">Issue Details</label>
                    <textarea
                      value={form.description}
                      onChange={(event) => handleFormChange("description", event.target.value)}
                      rows={4}
                      className="input-field resize-y"
                    />
                  </div>

                  <div>
                    <label className="label-field">Next Action</label>
                    <input
                      value={form.nextAction}
                      onChange={(event) => handleFormChange("nextAction", event.target.value)}
                      className="input-field"
                      placeholder="e.g., Send refund form link"
                    />
                  </div>

                  <button type="submit" disabled={saving} className="btn-primary w-full">
                    {saving ? "Saving..." : "Create Ticket"}
                  </button>
                </div>
              </form>
            </section>

            <section className="glass-card p-5">
              <div className="mb-4">
                <h2 className="card-header">Ticket Queue</h2>
                <p className="card-subtext">
                  {visibleTickets.length} shown from {canViewTeam ? tickets.length : stats.total} tickets
                </p>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="input-field"
                  placeholder="Search tickets..."
                />
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="input-field"
                >
                  <option value="All">All Statuses</option>
                  {STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>

              {loading ? (
                <p className="py-8 text-center text-sm font-semibold text-semantic-neutral">
                  Loading tickets...
                </p>
              ) : visibleTickets.length === 0 ? (
                <div className="rounded-card border border-surface-border bg-surface-panel p-8 text-center">
                  <p className="font-extrabold text-current">No tickets found.</p>
                  <p className="mt-2 text-sm text-semantic-neutral">
                    Create a ticket or adjust the queue filters.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {visibleTickets.map((ticket) => {
                    const isSelected = selectedTicket?.id === ticket.id;

                    return (
                      <button
                        key={ticket.id}
                        type="button"
                        onClick={() => openTicketEditor(ticket.id)}
                        className={`w-full rounded-card border p-4 text-left transition-all ${
                          isSelected
                            ? "border-brand-primary bg-brand-faint/25 shadow-[0_14px_30px_rgba(88,59,255,0.14)]"
                            : "border-surface-border bg-surface-panel shadow-[0_8px_20px_rgba(15,23,42,0.06)] hover:border-brand-primary hover:shadow-[0_14px_30px_rgba(15,23,42,0.10)]"
                        }`}
                      >
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${statusTone(ticket.status)}`}>
                            {ticket.status || "Open"}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${priorityTone(ticket.priority)}`}>
                            {ticket.priority || "Medium"}
                          </span>
                        </div>
                        <h3 className="line-clamp-1 font-extrabold text-current">
                          {ticket.title || "Untitled Ticket"}
                        </h3>
                        <p className="mt-1 text-sm font-semibold text-semantic-neutral">
                          {ticket.customerName || "Unknown Customer"}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-semantic-neutral">
                          Agent: {ticket.createdByName || ticket.agentName || "Unknown"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-semantic-neutral">
                          {ticket.description || ticket.nextAction || "No details added."}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </div>
      </main>

      {isEditorOpen && selectedTicket && draft && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 px-4 py-6 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-card border border-surface-border bg-surface-card shadow-[0_28px_90px_rgba(2,6,23,0.35)]">
            <form onSubmit={handleUpdate} className="p-5 sm:p-6">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="label-field">Edit Ticket</p>
                  <h2 className="font-heading text-2xl font-extrabold tracking-tight text-current">
                    {selectedTicket.customerName || "Customer"}
                  </h2>
                  <p className="mt-1 text-sm text-semantic-neutral">
                    Created by {selectedTicket.createdByName || "Unknown"} on {formatTimestamp(selectedTicket.createdAt)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-brand-primary">
                    {canViewTeam ? "Team edit mode" : "Read-only: team leads and quality supervisors can edit"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={closeTicketEditor} className="btn-secondary">
                    Close
                  </button>
                  <button type="submit" disabled={saving || !canViewTeam} className="btn-primary px-5">
                    {!canViewTeam ? "Read Only" : saving ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>

              <fieldset disabled={!canViewTeam || saving} className="min-w-0">

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="lg:col-span-2">
                    <label className="label-field">Ticket Title</label>
                    <input
                      value={draft.title}
                      onChange={(event) => handleDraftChange("title", event.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label-field">Customer Name</label>
                    <input
                      value={draft.customerName}
                      onChange={(event) => handleDraftChange("customerName", event.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label-field">Phone</label>
                    <input
                      value={draft.customerPhone}
                      onChange={(event) => handleDraftChange("customerPhone", event.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label-field">Account</label>
                    <input
                      value={draft.accountNumber}
                      onChange={(event) => handleDraftChange("accountNumber", event.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div>
                    <label className="label-field">Department</label>
                    <select
                      value={draft.department}
                      onChange={(event) => handleDraftChange("department", event.target.value)}
                      className="input-field"
                    >
                      {DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-field">Priority</label>
                    <select
                      value={draft.priority}
                      onChange={(event) => handleDraftChange("priority", event.target.value)}
                      className="input-field"
                    >
                      {PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {priority}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="label-field">Status</label>
                    <select
                      value={draft.status}
                      onChange={(event) => handleDraftChange("status", event.target.value)}
                      className="input-field"
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="lg:col-span-2">
                    <label className="label-field">Issue Details</label>
                    <textarea
                      value={draft.description}
                      onChange={(event) => handleDraftChange("description", event.target.value)}
                      rows={4}
                      className="input-field resize-y"
                    />
                  </div>

                  <div className="lg:col-span-2">
                    <label className="label-field">Next Action / Internal Note</label>
                    <textarea
                      value={draft.nextAction}
                      onChange={(event) => handleDraftChange("nextAction", event.target.value)}
                      rows={3}
                      className="input-field resize-y"
                    />
                  </div>
                </div>

                <div className="mt-5 rounded-card border border-surface-border bg-surface-panel p-4 text-sm leading-6 text-semantic-neutral">
                  Last updated {formatTimestamp(selectedTicket.updatedAt)}
                  {selectedTicket.lastEditedByName ? ` by ${selectedTicket.lastEditedByName}` : ""}.
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import {
  addActionType,
  deleteActionType,
  getActionTypeName,
  subscribeActionTypes,
  updateActionType,
} from "../services/firestore";

export default function ActionTypesManager() {
  const [actionTypes, setActionTypes] = useState([]);
  const [selected, setSelected] = useState(null);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeActionTypes(
      (data) => {
        setActionTypes(data);
        setLoading(false);
        setError("");
      },
      () => {
        setError("Unable to load action types.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, []);

  const clearForm = () => {
    setSelected(null);
    setName("");
  };

  const handleSelect = (actionType) => {
    setSelected(actionType);
    setName(getActionTypeName(actionType));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (selected) {
      await updateActionType(selected.id, name.trim());
    } else {
      await addActionType(name.trim());
    }

    clearForm();
  };

  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Delete support topic "${getActionTypeName(selected)}"? This cannot be undone.`)) return;
    const success = await deleteActionType(selected.id);
    if (success) clearForm();
    else setError("Could not delete the action. Please try again.");
  };

  const visibleActionTypes = actionTypes.filter((actionType) => {
    const search = query.trim().toLowerCase();
    if (!search) return true;
    return [actionType.id, getActionTypeName(actionType)]
      .some((field) => String(field || "").toLowerCase().includes(search));
  });

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 sm:p-8">
        <h2 className="text-xl font-extrabold text-slate-950 mb-1">
          {selected ? "Edit Support Topic" : "Add Support Topic"}
        </h2>
        <p className="text-sm leading-6 text-semantic-neutral mb-6">
          Manage the support-request topics agents can raise from their dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Support Topic</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder='e.g. "Clearance"'
              required
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            {selected && (
              <button type="button" onClick={handleDelete} className="min-h-[48px] rounded-2xl bg-semantic-error px-4 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-600">
                Delete
              </button>
            )}
            <button type="button" onClick={clearForm} className="btn-secondary min-h-[48px] px-4 py-3 text-sm font-bold">
              Clear
            </button>
            <button type="submit" className="btn-primary px-6 text-sm">
              {selected ? "Update Topic" : "Add Topic"}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card p-5 sm:p-8">
        <h3 className="text-xl font-extrabold text-slate-950 mb-4">Existing Support Topics ({actionTypes.length})</h3>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="input-field mb-4"
          placeholder="Search support topics by name or ID..."
        />

        {loading ? (
          <p className="text-semantic-neutral">Loading support topics...</p>
        ) : error ? (
          <p className="text-semantic-error text-sm font-semibold">{error}</p>
        ) : visibleActionTypes.length === 0 ? (
          <p className="text-semantic-neutral">No support topics match this search.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleActionTypes.map((actionType) => (
              <button
                key={actionType.id}
                type="button"
                onClick={() => handleSelect(actionType)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selected?.id === actionType.id
                    ? "border-brand-primary bg-brand-faint/20"
                    : "border-surface-border bg-surface-card hover:border-brand-primary hover:bg-surface-panel"
                }`}
              >
                <span className="font-sans font-semibold text-slate-900">{getActionTypeName(actionType)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


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
    if (!window.confirm(`Delete action "${getActionTypeName(selected)}"? This cannot be undone.`)) return;
    const success = await deleteActionType(selected.id);
    if (success) clearForm();
    else setError("Could not delete the action. Please try again.");
  };

  return (
    <div className="space-y-6">
      <div className="glass-card p-5 sm:p-8">
        <h2 className="text-xl font-extrabold text-slate-950 mb-1">
          {selected ? "Edit Action Type" : "Add Action Type"}
        </h2>
        <p className="text-sm leading-6 text-semantic-neutral mb-6">
          Manage the quick-action buttons agents see on their dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Action Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-white/80 bg-white/75 p-3 text-sm font-medium text-slate-900 shadow-sm backdrop-blur outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-faint"
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
            <button type="button" onClick={clearForm} className="min-h-[48px] rounded-2xl border border-white/80 bg-white/70 px-4 py-3 text-sm font-bold text-slate-700 shadow-sm backdrop-blur transition-colors hover:bg-white">
              Clear
            </button>
            <button type="submit" className="min-h-[48px] rounded-2xl bg-brand-primary px-4 py-3 text-sm font-bold text-white shadow-card transition-colors hover:bg-brand-light disabled:cursor-not-allowed disabled:opacity-60 px-6">
              {selected ? "Update Action" : "Add Action"}
            </button>
          </div>
        </form>
      </div>

      <div className="glass-card p-5 sm:p-8">
        <h3 className="text-xl font-extrabold text-slate-950 mb-4">Existing Action Types ({actionTypes.length})</h3>

        {loading ? (
          <p className="text-semantic-neutral">Loading action types...</p>
        ) : error ? (
          <p className="text-semantic-error text-sm font-semibold">{error}</p>
        ) : actionTypes.length === 0 ? (
          <p className="text-semantic-neutral">No action types configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {actionTypes.map((actionType) => (
              <button
                key={actionType.id}
                type="button"
                onClick={() => handleSelect(actionType)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selected?.id === actionType.id
                    ? "border-brand-primary bg-surface-bg"
                    : "border-surface-border hover:bg-surface-bg"
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


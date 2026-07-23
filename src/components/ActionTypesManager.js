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
    await deleteActionType(selected.id);
    clearForm();
  };

  return (
    <div className="space-y-6">
      <div className="card p-8">
        <h2 className="card-header mb-1">
          {selected ? "Edit Action Type" : "Add Action Type"}
        </h2>
        <p className="card-subtext mb-6">
          Manage the quick-action buttons agents see on their dashboard.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label-field">Action Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-field"
              placeholder='e.g. "Clearance"'
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            {selected && (
              <button type="button" onClick={handleDelete} className="btn-danger">
                Delete
              </button>
            )}
            <button type="button" onClick={clearForm} className="btn-secondary">
              Clear
            </button>
            <button type="submit" className="btn-primary px-6">
              {selected ? "Update Action" : "Add Action"}
            </button>
          </div>
        </form>
      </div>

      <div className="card p-8">
        <h3 className="card-header mb-4">Existing Action Types ({actionTypes.length})</h3>

        {loading ? (
          <p className="text-text-muted">Loading action types...</p>
        ) : error ? (
          <p className="text-accent-coral text-sm font-semibold">{error}</p>
        ) : actionTypes.length === 0 ? (
          <p className="text-text-muted">No action types configured yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {actionTypes.map((actionType) => (
              <button
                key={actionType.id}
                type="button"
                onClick={() => handleSelect(actionType)}
                className={`p-4 rounded-enterprise border text-left transition-all ${
                  selected?.id === actionType.id
                    ? "border-accent-cyan bg-mission-bg"
                    : "border-mission-border hover:bg-mission-bg"
                }`}
              >
                <span className="font-display font-semibold text-text-main">{getActionTypeName(actionType)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

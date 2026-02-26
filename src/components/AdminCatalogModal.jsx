import { useEffect, useState } from "react";

function Section({ title, onAdd, children }) {
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h3>{title}</h3>
        <button type="button" className="ghost" onClick={onAdd}>Add</button>
      </div>
      <div className="admin-section-body">{children}</div>
    </section>
  );
}

export default function AdminCatalogModal({ open, catalog, onClose, onSave, saving }) {
  const [draft, setDraft] = useState(catalog);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(catalog);
      setStatus("");
    }
  }, [open, catalog]);

  if (!open) return null;

  const patchArrayItem = (key, index, field, value) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: [...prev[key]] };
      next[key][index] = { ...next[key][index], [field]: value };
      return next;
    });
  };

  const addRow = (key) => {
    const id = `${key}-${Date.now()}`;
    const template =
      key === "packages"
        ? { id, name: "New Package", ppp: 0 }
        : key === "addons"
          ? { id, name: "New Add-on", type: "per_person", price: 0 }
          : { id, name: "New Rental", price: 0, qtyPerGuests: 10 };

    setDraft((prev) => ({ ...prev, [key]: [...prev[key], template] }));
  };

  const removeRow = (key, index) => {
    setDraft((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  };

  const patchSettings = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: Number(value || 0)
      }
    }));
  };

  const handleSave = async () => {
    const result = await onSave(draft);
    if (result.ok) {
      setStatus("Catalog saved.");
      return;
    }
    setStatus(result.error || "Save failed.");
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card">
        <div className="modal-head">
          <h2>Catalog Admin</h2>
          <button type="button" className="ghost" onClick={onClose}>Close</button>
        </div>

        <Section title="Packages" onAdd={() => addRow("packages")}>
          {draft.packages.map((item, i) => (
            <div className="admin-row" key={item.id}>
              <input value={item.id} disabled />
              <input value={item.name} onChange={(e) => patchArrayItem("packages", i, "name", e.target.value)} />
              <input type="number" value={item.ppp} onChange={(e) => patchArrayItem("packages", i, "ppp", Number(e.target.value))} />
              <button type="button" className="ghost" onClick={() => removeRow("packages", i)}>Delete</button>
            </div>
          ))}
        </Section>

        <Section title="Add-ons" onAdd={() => addRow("addons")}>
          {draft.addons.map((item, i) => (
            <div className="admin-row" key={item.id}>
              <input value={item.id} disabled />
              <input value={item.name} onChange={(e) => patchArrayItem("addons", i, "name", e.target.value)} />
              <select value={item.type} onChange={(e) => patchArrayItem("addons", i, "type", e.target.value)}>
                <option value="per_person">per_person</option>
                <option value="per_event">per_event</option>
              </select>
              <input type="number" value={item.price} onChange={(e) => patchArrayItem("addons", i, "price", Number(e.target.value))} />
              <button type="button" className="ghost" onClick={() => removeRow("addons", i)}>Delete</button>
            </div>
          ))}
        </Section>

        <Section title="Rentals" onAdd={() => addRow("rentals")}>
          {draft.rentals.map((item, i) => (
            <div className="admin-row" key={item.id}>
              <input value={item.id} disabled />
              <input value={item.name} onChange={(e) => patchArrayItem("rentals", i, "name", e.target.value)} />
              <input type="number" value={item.price} onChange={(e) => patchArrayItem("rentals", i, "price", Number(e.target.value))} />
              <input type="number" value={item.qtyPerGuests} onChange={(e) => patchArrayItem("rentals", i, "qtyPerGuests", Number(e.target.value))} />
              <button type="button" className="ghost" onClick={() => removeRow("rentals", i)}>Delete</button>
            </div>
          ))}
        </Section>

        <section className="admin-section">
          <div className="admin-section-head"><h3>Settings</h3></div>
          <div className="admin-grid-settings">
            <label>Per-mile rate<input type="number" step="0.01" value={draft.settings.perMileRate} onChange={(e) => patchSettings("perMileRate", e.target.value)} /></label>
            <label>Service fee pct<input type="number" step="0.01" value={draft.settings.serviceFeePct} onChange={(e) => patchSettings("serviceFeePct", e.target.value)} /></label>
            <label>Tax rate<input type="number" step="0.01" value={draft.settings.taxRate} onChange={(e) => patchSettings("taxRate", e.target.value)} /></label>
            <label>Deposit pct<input type="number" step="0.01" value={draft.settings.depositPct} onChange={(e) => patchSettings("depositPct", e.target.value)} /></label>
            <label>Quote validity days<input type="number" step="1" min="1" value={draft.settings.quoteValidityDays} onChange={(e) => patchSettings("quoteValidityDays", e.target.value)} /></label>
            <label>Server rate<input type="number" step="0.01" value={draft.settings.serverRate} onChange={(e) => patchSettings("serverRate", e.target.value)} /></label>
            <label>Chef rate<input type="number" step="0.01" value={draft.settings.chefRate} onChange={(e) => patchSettings("chefRate", e.target.value)} /></label>
          </div>
        </section>

        <div className="modal-foot">
          <span className="source-note">{status}</span>
          <button type="button" className="cta" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Catalog"}</button>
        </div>
      </div>
    </div>
  );
}

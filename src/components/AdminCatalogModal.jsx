import { useEffect, useState } from "react";

const JSON_FIELD_META = [
  {
    key: "serviceFeeTiers",
    label: "Service Fee Tiers JSON",
    hint: "Array of { id, minGuests, maxGuests, pct }."
  },
  {
    key: "taxRegions",
    label: "Tax Regions JSON",
    hint: "Array of { id, name, rate }."
  },
  {
    key: "eventTemplates",
    label: "Event Templates JSON",
    hint: "Array of defaults used by template picker in Step 1."
  },
  {
    key: "seasonalProfiles",
    label: "Seasonal Profiles JSON",
    hint: "Array of { id, name, startMonth, startDay, endMonth, endDay, multipliers }."
  }
];

function buildJsonDrafts(catalog) {
  const settings = catalog?.settings || {};
  return {
    serviceFeeTiers: JSON.stringify(settings.serviceFeeTiers || [], null, 2),
    taxRegions: JSON.stringify(settings.taxRegions || [], null, 2),
    eventTemplates: JSON.stringify(settings.eventTemplates || [], null, 2),
    seasonalProfiles: JSON.stringify(settings.seasonalProfiles || [], null, 2)
  };
}

function Section({ title, onAdd, children }) {
  return (
    <section className="admin-section">
      <div className="admin-section-head">
        <h3>{title}</h3>
        {onAdd && <button type="button" className="ghost" onClick={onAdd}>Add</button>}
      </div>
      <div className="admin-section-body">{children}</div>
    </section>
  );
}

export default function AdminCatalogModal({ open, catalog, onClose, onSave, saving }) {
  const [draft, setDraft] = useState(catalog);
  const [status, setStatus] = useState("");
  const [jsonDrafts, setJsonDrafts] = useState(() => buildJsonDrafts(catalog));

  useEffect(() => {
    if (open) {
      setDraft(catalog);
      setJsonDrafts(buildJsonDrafts(catalog));
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

  const patchMenuSection = (sectionIndex, field, value) => {
    setDraft((prev) => {
      const menuSections = [...(prev.settings?.menuSections || [])];
      const section = { ...(menuSections[sectionIndex] || {}) };
      section[field] = value;
      menuSections[sectionIndex] = section;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          menuSections
        }
      };
    });
  };

  const patchMenuItem = (sectionIndex, itemIndex, field, value) => {
    setDraft((prev) => {
      const menuSections = [...(prev.settings?.menuSections || [])];
      const section = { ...(menuSections[sectionIndex] || {}) };
      const items = [...(section.items || [])];
      const item = { ...(items[itemIndex] || {}) };
      item[field] = value;
      items[itemIndex] = item;
      section.items = items;
      menuSections[sectionIndex] = section;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          menuSections
        }
      };
    });
  };

  const addMenuItem = (sectionIndex) => {
    const itemId = `menu-item-${Date.now()}`;
    setDraft((prev) => {
      const menuSections = [...(prev.settings?.menuSections || [])];
      const section = { ...(menuSections[sectionIndex] || {}) };
      const items = [...(section.items || [])];
      items.push({
        id: itemId,
        name: "New Menu Item",
        type: "per_event",
        price: 0
      });
      section.items = items;
      menuSections[sectionIndex] = section;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          menuSections
        }
      };
    });
  };

  const removeMenuItem = (sectionIndex, itemIndex) => {
    setDraft((prev) => {
      const menuSections = [...(prev.settings?.menuSections || [])];
      const section = { ...(menuSections[sectionIndex] || {}) };
      section.items = (section.items || []).filter((_, i) => i !== itemIndex);
      menuSections[sectionIndex] = section;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          menuSections
        }
      };
    });
  };

  const patchNumericSetting = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: Number(value || 0)
      }
    }));
  };

  const patchTextSetting = (field, value) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: value
      }
    }));
  };

  const patchJsonDraft = (field, value) => {
    setJsonDrafts((prev) => ({ ...prev, [field]: value }));
  };

  const parseJsonArray = (field, label) => {
    try {
      const parsed = JSON.parse(jsonDrafts[field] || "[]");
      if (!Array.isArray(parsed)) {
        throw new Error("Must be a JSON array.");
      }
      return parsed;
    } catch (err) {
      throw new Error(`${label}: ${err.message}`);
    }
  };

  const handleSave = async () => {
    try {
      const serviceFeeTiers = parseJsonArray("serviceFeeTiers", "Service Fee Tiers JSON");
      const taxRegions = parseJsonArray("taxRegions", "Tax Regions JSON");
      const eventTemplates = parseJsonArray("eventTemplates", "Event Templates JSON");
      const seasonalProfiles = parseJsonArray("seasonalProfiles", "Seasonal Profiles JSON");

      const nextDraft = {
        ...draft,
        settings: {
          ...draft.settings,
          serviceFeeTiers,
          taxRegions,
          eventTemplates,
          seasonalProfiles
        }
      };

      const result = await onSave(nextDraft);
      if (result.ok) {
        setStatus("Catalog saved.");
        return;
      }
      setStatus(result.error || "Save failed.");
    } catch (err) {
      setStatus(err?.message || "Invalid JSON in advanced settings.");
    }
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
          <div className="admin-section-head"><h3>Menu Item Pricing</h3></div>
          <div className="admin-section-body">
            {(draft.settings?.menuSections || []).map((section, sectionIndex) => (
              <div className="admin-menu-section" key={section.id || sectionIndex}>
                <div className="admin-menu-head">
                  <input
                    type="text"
                    value={section.name || ""}
                    onChange={(e) => patchMenuSection(sectionIndex, "name", e.target.value)}
                  />
                  <button type="button" className="ghost compact" onClick={() => addMenuItem(sectionIndex)}>Add Menu Item</button>
                </div>

                <div className="admin-section-body">
                  {(section.items || []).map((item, itemIndex) => (
                    <div className="admin-menu-row" key={item.id || itemIndex}>
                      <input value={item.id || ""} disabled />
                      <input
                        type="text"
                        value={item.name || ""}
                        onChange={(e) => patchMenuItem(sectionIndex, itemIndex, "name", e.target.value)}
                      />
                      <select
                        value={item.type || "per_event"}
                        onChange={(e) => patchMenuItem(sectionIndex, itemIndex, "type", e.target.value)}
                      >
                        <option value="per_event">per_event</option>
                        <option value="per_person">per_person</option>
                      </select>
                      <input
                        type="number"
                        step="0.01"
                        value={Number(item.price || 0)}
                        onChange={(e) => patchMenuItem(sectionIndex, itemIndex, "price", Number(e.target.value))}
                      />
                      <button type="button" className="ghost compact" onClick={() => removeMenuItem(sectionIndex, itemIndex)}>Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head"><h3>Numeric Settings</h3></div>
          <div className="admin-grid-settings">
            <label>Per-mile rate<input type="number" step="0.01" value={draft.settings.perMileRate} onChange={(e) => patchNumericSetting("perMileRate", e.target.value)} /></label>
            <label>Long-distance per-mile<input type="number" step="0.01" value={draft.settings.longDistancePerMileRate} onChange={(e) => patchNumericSetting("longDistancePerMileRate", e.target.value)} /></label>
            <label>Delivery threshold miles<input type="number" step="1" min="0" value={draft.settings.deliveryThresholdMiles} onChange={(e) => patchNumericSetting("deliveryThresholdMiles", e.target.value)} /></label>
            <label>Bartender rate<input type="number" step="0.01" min="0" value={draft.settings.bartenderRate} onChange={(e) => patchNumericSetting("bartenderRate", e.target.value)} /></label>
            <label>Service fee pct fallback<input type="number" step="0.01" value={draft.settings.serviceFeePct} onChange={(e) => patchNumericSetting("serviceFeePct", e.target.value)} /></label>
            <label>Tax rate fallback<input type="number" step="0.01" value={draft.settings.taxRate} onChange={(e) => patchNumericSetting("taxRate", e.target.value)} /></label>
            <label>Deposit pct<input type="number" step="0.01" value={draft.settings.depositPct} onChange={(e) => patchNumericSetting("depositPct", e.target.value)} /></label>
            <label>Quote validity days<input type="number" step="1" min="1" value={draft.settings.quoteValidityDays} onChange={(e) => patchNumericSetting("quoteValidityDays", e.target.value)} /></label>
            <label>Server rate<input type="number" step="0.01" value={draft.settings.serverRate} onChange={(e) => patchNumericSetting("serverRate", e.target.value)} /></label>
            <label>Chef rate<input type="number" step="0.01" value={draft.settings.chefRate} onChange={(e) => patchNumericSetting("chefRate", e.target.value)} /></label>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head"><h3>Quote Meta</h3></div>
          <div className="admin-grid-settings">
            <label>
              Quote prepared by
              <input
                type="text"
                value={draft.settings.quotePreparedBy || ""}
                onChange={(e) => patchTextSetting("quotePreparedBy", e.target.value)}
              />
            </label>
            <label>
              Business phone
              <input
                type="text"
                value={draft.settings.businessPhone || ""}
                onChange={(e) => patchTextSetting("businessPhone", e.target.value)}
              />
            </label>
            <label>
              Business email
              <input
                type="text"
                value={draft.settings.businessEmail || ""}
                onChange={(e) => patchTextSetting("businessEmail", e.target.value)}
              />
            </label>
            <label>
              Business address
              <input
                type="text"
                value={draft.settings.businessAddress || ""}
                onChange={(e) => patchTextSetting("businessAddress", e.target.value)}
              />
            </label>
            <label>
              Acceptance email
              <input
                type="text"
                value={draft.settings.acceptanceEmail || ""}
                onChange={(e) => patchTextSetting("acceptanceEmail", e.target.value)}
              />
            </label>
            <label>
              Disposables note
              <input
                type="text"
                value={draft.settings.disposablesNote || ""}
                onChange={(e) => patchTextSetting("disposablesNote", e.target.value)}
              />
            </label>
            <label>
              Deposit notice
              <input
                type="text"
                value={draft.settings.depositNotice || ""}
                onChange={(e) => patchTextSetting("depositNotice", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head"><h3>Default Selectors</h3></div>
          <div className="admin-grid-settings">
            <label>
              Default tax region id
              <input
                type="text"
                value={draft.settings.defaultTaxRegion || ""}
                onChange={(e) => patchTextSetting("defaultTaxRegion", e.target.value)}
              />
            </label>
            <label>
              Default season profile id
              <input
                type="text"
                value={draft.settings.defaultSeasonProfile || "auto"}
                onChange={(e) => patchTextSetting("defaultSeasonProfile", e.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head"><h3>Advanced Config (JSON)</h3></div>
          <div className="admin-section-body">
            {JSON_FIELD_META.map((field) => (
              <label key={field.key} className="json-label">
                <span>{field.label}</span>
                <textarea
                  className="json-editor"
                  value={jsonDrafts[field.key]}
                  onChange={(e) => patchJsonDraft(field.key, e.target.value)}
                />
                <small>{field.hint}</small>
              </label>
            ))}
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

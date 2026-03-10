import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { firebaseReady, storage } from "../lib/firebase";

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
  },
  {
    key: "brandCrew",
    label: "Brand Crew JSON",
    hint: "Array of { label, imageUrl } shown in header and proposal."
  }
];

function buildJsonDrafts(catalog) {
  const settings = catalog?.settings || {};
  return {
    serviceFeeTiers: JSON.stringify(settings.serviceFeeTiers || [], null, 2),
    taxRegions: JSON.stringify(settings.taxRegions || [], null, 2),
    eventTemplates: JSON.stringify(settings.eventTemplates || [], null, 2),
    seasonalProfiles: JSON.stringify(settings.seasonalProfiles || [], null, 2),
    brandCrew: JSON.stringify(settings.brandCrew || [], null, 2)
  };
}

function toDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
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
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [jsonDrafts, setJsonDrafts] = useState(() => buildJsonDrafts(catalog));

  useEffect(() => {
    if (open) {
      setDraft(catalog);
      setJsonDrafts(buildJsonDrafts(catalog));
      setStatus("");
      setUploadingLogo(false);
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

  const patchToggleSetting = (field, checked) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        [field]: Boolean(checked)
      }
    }));
  };

  const patchJsonDraft = (field, value) => {
    setJsonDrafts((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (file) => {
    if (!file) return;
    if (!String(file.type || "").startsWith("image/")) {
      setStatus("Logo upload failed: choose an image file.");
      return;
    }

    setUploadingLogo(true);
    try {
      if (firebaseReady && storage) {
        const safeName = String(file.name || "logo").replace(/[^\w.-]+/g, "_");
        const path = `brand-assets/logos/${Date.now()}-${safeName}`;
        const logoRef = storageRef(storage, path);
        await uploadBytes(logoRef, file, { contentType: file.type || "image/png" });
        const downloadUrl = await getDownloadURL(logoRef);
        patchTextSetting("brandLogoUrl", downloadUrl);
        setStatus("Logo uploaded. Click Save Catalog to persist.");
      } else {
        const dataUrl = await toDataUrl(file);
        patchTextSetting("brandLogoUrl", dataUrl);
        setStatus("Logo loaded locally. Click Save Catalog to persist.");
      }
    } catch (err) {
      setStatus(err?.message || "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
    }
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
      const brandCrew = parseJsonArray("brandCrew", "Brand Crew JSON");

      const nextDraft = {
        ...draft,
        settings: {
          ...draft.settings,
          serviceFeeTiers,
          taxRegions,
          eventTemplates,
          seasonalProfiles,
          brandCrew
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
            <label>Capacity limit<input type="number" step="1" min="1" value={draft.settings.capacityLimit || 400} onChange={(e) => patchNumericSetting("capacityLimit", e.target.value)} /></label>
            <label>Bartender rate<input type="number" step="0.01" min="0" value={draft.settings.bartenderRate} onChange={(e) => patchNumericSetting("bartenderRate", e.target.value)} /></label>
            <label>Service fee pct fallback<input type="number" step="0.01" value={draft.settings.serviceFeePct} onChange={(e) => patchNumericSetting("serviceFeePct", e.target.value)} /></label>
            <label>Tax rate fallback<input type="number" step="0.01" value={draft.settings.taxRate} onChange={(e) => patchNumericSetting("taxRate", e.target.value)} /></label>
            <label>Deposit pct<input type="number" step="0.01" value={draft.settings.depositPct} onChange={(e) => patchNumericSetting("depositPct", e.target.value)} /></label>
            <label>Quote validity days<input type="number" step="1" min="1" value={draft.settings.quoteValidityDays} onChange={(e) => patchNumericSetting("quoteValidityDays", e.target.value)} /></label>
            <label>Server rate<input type="number" step="0.01" value={draft.settings.serverRate} onChange={(e) => patchNumericSetting("serverRate", e.target.value)} /></label>
            <label>Chef rate<input type="number" step="0.01" value={draft.settings.chefRate} onChange={(e) => patchNumericSetting("chefRate", e.target.value)} /></label>
            <label>Integration retry limit<input type="number" step="1" min="1" max="10" value={draft.settings.integrationRetryLimit || 3} onChange={(e) => patchNumericSetting("integrationRetryLimit", e.target.value)} /></label>
            <label>Integration audit retention<input type="number" step="1" min="10" max="200" value={draft.settings.integrationAuditRetention || 50} onChange={(e) => patchNumericSetting("integrationAuditRetention", e.target.value)} /></label>
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
          <div className="admin-section-head"><h3>Integrations</h3></div>
          <div className="admin-grid-settings">
            <label>
              CRM provider
              <input
                type="text"
                value={draft.settings.crmProvider || "webhook"}
                onChange={(e) => patchTextSetting("crmProvider", e.target.value)}
              />
            </label>
            <label>
              CRM webhook URL
              <input
                type="url"
                value={draft.settings.crmWebhookUrl || ""}
                onChange={(e) => patchTextSetting("crmWebhookUrl", e.target.value)}
              />
            </label>
            <label>
              <span>Enable CRM sync</span>
              <input
                type="checkbox"
                checked={Boolean(draft.settings.crmEnabled)}
                onChange={(e) => patchToggleSetting("crmEnabled", e.target.checked)}
              />
            </label>
            <label>
              <span>CRM auto-sync on sent</span>
              <input
                type="checkbox"
                checked={Boolean(draft.settings.crmAutoSyncOnSent)}
                onChange={(e) => patchToggleSetting("crmAutoSyncOnSent", e.target.checked)}
              />
            </label>
            <label>
              <span>CRM auto-sync on booked</span>
              <input
                type="checkbox"
                checked={Boolean(draft.settings.crmAutoSyncOnBooked)}
                onChange={(e) => patchToggleSetting("crmAutoSyncOnBooked", e.target.checked)}
              />
            </label>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head"><h3>Branding</h3></div>
          <div className="admin-grid-settings">
            <label>
              Brand name
              <input
                type="text"
                value={draft.settings.brandName || ""}
                onChange={(e) => patchTextSetting("brandName", e.target.value)}
              />
            </label>
            <label>
              Brand tagline
              <input
                type="text"
                value={draft.settings.brandTagline || ""}
                onChange={(e) => patchTextSetting("brandTagline", e.target.value)}
              />
            </label>
            <label>
              Brand logo URL/path
              <input
                type="text"
                value={draft.settings.brandLogoUrl || ""}
                onChange={(e) => patchTextSetting("brandLogoUrl", e.target.value)}
              />
            </label>
            <label>
              Upload logo image
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
                disabled={uploadingLogo}
              />
            </label>
            <label>
              Primary color
              <input
                type="color"
                value={draft.settings.brandPrimaryColor || "#c99334"}
                onChange={(e) => patchTextSetting("brandPrimaryColor", e.target.value)}
              />
            </label>
            <label>
              Accent color
              <input
                type="color"
                value={draft.settings.brandAccentColor || "#f0d29a"}
                onChange={(e) => patchTextSetting("brandAccentColor", e.target.value)}
              />
            </label>
            <label>
              Deep accent color
              <input
                type="color"
                value={draft.settings.brandDarkAccentColor || "#8d611a"}
                onChange={(e) => patchTextSetting("brandDarkAccentColor", e.target.value)}
              />
            </label>
            <label>
              Background start
              <input
                type="color"
                value={draft.settings.brandBackgroundStart || "#100d09"}
                onChange={(e) => patchTextSetting("brandBackgroundStart", e.target.value)}
              />
            </label>
            <label>
              Background mid
              <input
                type="color"
                value={draft.settings.brandBackgroundMid || "#221a12"}
                onChange={(e) => patchTextSetting("brandBackgroundMid", e.target.value)}
              />
            </label>
            <label>
              Background end
              <input
                type="color"
                value={draft.settings.brandBackgroundEnd || "#ae7d2b"}
                onChange={(e) => patchTextSetting("brandBackgroundEnd", e.target.value)}
              />
            </label>
            <label>
              Hero eyebrow
              <input
                type="text"
                value={draft.settings.heroEyebrow || ""}
                onChange={(e) => patchTextSetting("heroEyebrow", e.target.value)}
              />
            </label>
            <label>
              Hero headline
              <input
                type="text"
                value={draft.settings.heroHeadline || ""}
                onChange={(e) => patchTextSetting("heroHeadline", e.target.value)}
              />
            </label>
            <label>
              Hero description
              <textarea
                value={draft.settings.heroDescription || ""}
                onChange={(e) => patchTextSetting("heroDescription", e.target.value)}
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

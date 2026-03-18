import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { firebaseReady, storage } from "../lib/firebase";
import {
  createCategory,
  createEventType,
  createMenuItem,
  deleteMenuItem,
  getEventTypes,
  getMenuCategories,
  getMenuItems,
  updateMenuItem
} from "../lib/menuService";

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

const RULE_KIND_META = [
  { value: "addon", label: "Add-on" },
  { value: "rental", label: "Rental" },
  { value: "package", label: "Package" }
];

function defaultRuleName(kind) {
  if (kind === "rental") return "Rental recommendation";
  if (kind === "package") return "Package recommendation";
  return "Add-on recommendation";
}

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
  const [selectedEventType, setSelectedEventType] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [menuEventTypes, setMenuEventTypes] = useState([]);
  const [menuCategories, setMenuCategories] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuActionLoading, setMenuActionLoading] = useState(false);
  const [newEventTypeName, setNewEventTypeName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newItemDraft, setNewItemDraft] = useState({
    name: "",
    price: 0,
    type: "per_event"
  });

  useEffect(() => {
    if (open) {
      setDraft(catalog);
      setJsonDrafts(buildJsonDrafts(catalog));
      setStatus("");
      setUploadingLogo(false);
      setSelectedEventType("");
      setSelectedCategory("");
      setMenuEventTypes([]);
      setMenuCategories([]);
      setMenuItems([]);
      setMenuLoading(false);
      setMenuActionLoading(false);
      setNewEventTypeName("");
      setNewCategoryName("");
      setNewItemDraft({ name: "", price: 0, type: "per_event" });
    }
  }, [open, catalog]);

  useEffect(() => {
    if (!open) return;
    let alive = true;

    async function loadEventTypeOptions() {
      setMenuLoading(true);
      try {
        const eventTypes = await getEventTypes();
        if (!alive) return;
        setMenuEventTypes(eventTypes);
        setSelectedEventType((current) => current || eventTypes[0]?.id || "");
      } catch (err) {
        if (!alive) return;
        setStatus(err?.message || "Failed to load menu event types.");
      } finally {
        if (alive) setMenuLoading(false);
      }
    }

    loadEventTypeOptions();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const eventTypeId = String(selectedEventType || "").trim();
    if (!eventTypeId) {
      setMenuCategories([]);
      setMenuItems([]);
      setSelectedCategory("");
      return;
    }

    let alive = true;
    async function loadEventMenuData() {
      setMenuLoading(true);
      try {
        const [categories, items] = await Promise.all([
          getMenuCategories(eventTypeId),
          getMenuItems(eventTypeId)
        ]);
        if (!alive) return;
        setMenuCategories(categories);
        setMenuItems(items);
        setSelectedCategory((current) => {
          const keepCurrent = current && categories.some((category) => category.id === current);
          if (keepCurrent) return current;
          return categories[0]?.id || "";
        });
      } catch (err) {
        if (!alive) return;
        setStatus(err?.message || "Failed to load menu categories/items.");
      } finally {
        if (alive) setMenuLoading(false);
      }
    }

    loadEventMenuData();
    return () => {
      alive = false;
    };
  }, [open, selectedEventType]);

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

  const patchBartenderRateType = (index, field, value) => {
    setDraft((prev) => {
      const rateTypes = [...(prev.settings?.bartenderRateTypes || [])];
      const current = { ...(rateTypes[index] || {}) };
      current[field] = field === "rate" ? Number(value || 0) : value;
      rateTypes[index] = current;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          bartenderRateTypes: rateTypes
        }
      };
    });
  };

  const patchStaffingRateType = (index, field, value) => {
    setDraft((prev) => {
      const rateTypes = [...(prev.settings?.staffingRateTypes || [])];
      const current = { ...(rateTypes[index] || {}) };
      if (field === "serverRate" || field === "chefRate") {
        current[field] = Number(value || 0);
      } else {
        current[field] = value;
      }
      rateTypes[index] = current;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          staffingRateTypes: rateTypes
        }
      };
    });
  };

  const addBartenderRateType = () => {
    const nextType = {
      id: `bartender-rate-${Date.now()}`,
      name: "New Bartender Type",
      rate: Number(draft.settings?.bartenderRate || 0)
    };
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        bartenderRateTypes: [...(prev.settings?.bartenderRateTypes || []), nextType]
      }
    }));
  };

  const addStaffingRateType = () => {
    const nextType = {
      id: `staffing-rate-${Date.now()}`,
      name: "New Staffing Type",
      serverRate: Number(draft.settings?.serverRate || 0),
      chefRate: Number(draft.settings?.chefRate || 0)
    };
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        staffingRateTypes: [...(prev.settings?.staffingRateTypes || []), nextType]
      }
    }));
  };

  const removeBartenderRateType = (index) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        bartenderRateTypes: (prev.settings?.bartenderRateTypes || []).filter((_, idx) => idx !== index)
      }
    }));
  };

  const removeStaffingRateType = (index) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        staffingRateTypes: (prev.settings?.staffingRateTypes || []).filter((_, idx) => idx !== index)
      }
    }));
  };

  const patchUpsellRule = (index, field, value) => {
    setDraft((prev) => {
      const rules = [...(prev.settings?.upsellRules || [])];
      const current = { ...(rules[index] || {}) };

      if (field === "enabled") {
        current.enabled = Boolean(value);
      } else if (field === "minGuests" || field === "minHours") {
        current[field] = Math.max(0, Number(value || 0));
      } else if (field === "kind") {
        current.kind = value;
        current.targetId =
          value === "rental"
            ? prev.rentals?.[0]?.id || ""
            : value === "package"
              ? ""
              : prev.addons?.[0]?.id || "";
        current.name = current.name || defaultRuleName(value);
      } else {
        current[field] = value;
      }

      rules[index] = current;
      return {
        ...prev,
        settings: {
          ...prev.settings,
          upsellRules: rules
        }
      };
    });
  };

  const addUpsellRule = () => {
    const fallbackAddon = draft.addons?.[0]?.id || "";
    const nextRule = {
      id: `upsell-rule-${Date.now()}`,
      name: "New recommendation rule",
      kind: "addon",
      targetId: fallbackAddon,
      enabled: true,
      minGuests: 0,
      minHours: 0,
      reason: "Upsell rule matched this quote."
    };

    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        upsellRules: [...(prev.settings?.upsellRules || []), nextRule]
      }
    }));
  };

  const removeUpsellRule = (index) => {
    setDraft((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        upsellRules: (prev.settings?.upsellRules || []).filter((_, idx) => idx !== index)
      }
    }));
  };

  const getUpsellTargetOptions = (kind) => {
    if (kind === "rental") {
      return (draft.rentals || []).map((item) => ({ value: item.id, label: item.name }));
    }
    if (kind === "package") {
      return (draft.packages || []).map((item) => ({ value: item.id, label: `${item.name} (${item.ppp}/person)` }));
    }
    return (draft.addons || []).map((item) => ({ value: item.id, label: item.name }));
  };

  const patchJsonDraft = (field, value) => {
    setJsonDrafts((prev) => ({ ...prev, [field]: value }));
  };

  const refreshEventTypes = async (preferredId = "") => {
    const items = await getEventTypes();
    setMenuEventTypes(items);
    setSelectedEventType((current) => {
      if (preferredId && items.some((item) => item.id === preferredId)) return preferredId;
      if (current && items.some((item) => item.id === current)) return current;
      return items[0]?.id || "";
    });
    return items;
  };

  const refreshEventMenuData = async (eventTypeId = selectedEventType) => {
    const nextEventTypeId = String(eventTypeId || "").trim();
    if (!nextEventTypeId) {
      setMenuCategories([]);
      setMenuItems([]);
      setSelectedCategory("");
      return;
    }
    const [categories, items] = await Promise.all([
      getMenuCategories(nextEventTypeId),
      getMenuItems(nextEventTypeId)
    ]);
    setMenuCategories(categories);
    setMenuItems(items);
    setSelectedCategory((current) => {
      if (current && categories.some((category) => category.id === current)) return current;
      return categories[0]?.id || "";
    });
  };

  const handleCreateEventType = async () => {
    const name = String(newEventTypeName || "").trim();
    if (!name) {
      setStatus("Enter an event type name first.");
      return;
    }
    setMenuActionLoading(true);
    try {
      const created = await createEventType({ name });
      setNewEventTypeName("");
      await refreshEventTypes(created.id);
      await refreshEventMenuData(created.id);
      setStatus(`Event type "${created.name}" added.`);
    } catch (err) {
      setStatus(err?.message || "Failed to create event type.");
    } finally {
      setMenuActionLoading(false);
    }
  };

  const handleCreateCategory = async () => {
    const name = String(newCategoryName || "").trim();
    if (!selectedEventType) {
      setStatus("Choose an event type before adding a category.");
      return;
    }
    if (!name) {
      setStatus("Enter a category name first.");
      return;
    }
    setMenuActionLoading(true);
    try {
      const created = await createCategory({
        eventTypeId: selectedEventType,
        name
      });
      setNewCategoryName("");
      await refreshEventMenuData(selectedEventType);
      setSelectedCategory(created.id);
      setStatus(`Category "${created.name}" added.`);
    } catch (err) {
      setStatus(err?.message || "Failed to create category.");
    } finally {
      setMenuActionLoading(false);
    }
  };

  const handleCreateMenuItem = async () => {
    const name = String(newItemDraft.name || "").trim();
    if (!selectedEventType || !selectedCategory) {
      setStatus("Choose event type and category before adding an item.");
      return;
    }
    if (!name) {
      setStatus("Enter a menu item name first.");
      return;
    }
    setMenuActionLoading(true);
    try {
      await createMenuItem({
        eventTypeId: selectedEventType,
        categoryId: selectedCategory,
        name,
        price: Number(newItemDraft.price || 0),
        type: newItemDraft.type
      });
      setNewItemDraft({ name: "", price: 0, type: "per_event" });
      await refreshEventMenuData(selectedEventType);
      setStatus("Menu item added.");
    } catch (err) {
      setStatus(err?.message || "Failed to add menu item.");
    } finally {
      setMenuActionLoading(false);
    }
  };

  const patchManagedMenuItem = (id, field, value) => {
    setMenuItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const handleUpdateManagedMenuItem = async (item) => {
    setMenuActionLoading(true);
    try {
      await updateMenuItem(item.id, {
        name: item.name,
        price: Number(item.price || 0),
        type: item.type
      });
      setStatus("Menu item updated.");
      await refreshEventMenuData(selectedEventType);
    } catch (err) {
      setStatus(err?.message || "Failed to update menu item.");
    } finally {
      setMenuActionLoading(false);
    }
  };

  const handleDeleteManagedMenuItem = async (id) => {
    setMenuActionLoading(true);
    try {
      await deleteMenuItem(id);
      setStatus("Menu item deleted.");
      await refreshEventMenuData(selectedEventType);
    } catch (err) {
      setStatus(err?.message || "Failed to delete menu item.");
    } finally {
      setMenuActionLoading(false);
    }
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

  const selectedCategoryItems = menuItems.filter((item) => item.categoryId === selectedCategory);

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
          <div className="admin-section-head"><h3>Menu Management</h3></div>
          <div className="admin-section-body">
            <div className="admin-menu-management-grid">
              <label>
                Event type
                <select
                  value={selectedEventType}
                  onChange={(e) => setSelectedEventType(e.target.value)}
                  disabled={menuLoading}
                >
                  <option value="">Choose event type</option>
                  {menuEventTypes.map((eventType) => (
                    <option key={eventType.id} value={eventType.id}>{eventType.name}</option>
                  ))}
                </select>
              </label>
              <div className="admin-inline-actions">
                <input
                  type="text"
                  placeholder="New event type"
                  value={newEventTypeName}
                  onChange={(e) => setNewEventTypeName(e.target.value)}
                />
                <button type="button" className="ghost compact" onClick={handleCreateEventType} disabled={menuActionLoading}>
                  {menuActionLoading ? "Saving..." : "Add Event Type"}
                </button>
              </div>
            </div>

            <div className="admin-menu-management-grid">
              <label>
                Category
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  disabled={!selectedEventType || menuLoading}
                >
                  <option value="">Choose category</option>
                  {menuCategories.map((category) => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </label>
              <div className="admin-inline-actions">
                <input
                  type="text"
                  placeholder="New category"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  disabled={!selectedEventType}
                />
                <button type="button" className="ghost compact" onClick={handleCreateCategory} disabled={menuActionLoading || !selectedEventType}>
                  {menuActionLoading ? "Saving..." : "Add Category"}
                </button>
              </div>
            </div>

            <div className="admin-inline-actions">
              <input
                type="text"
                placeholder="New item name"
                value={newItemDraft.name}
                onChange={(e) => setNewItemDraft((prev) => ({ ...prev, name: e.target.value }))}
                disabled={!selectedCategory}
              />
              <input
                type="number"
                step="0.01"
                value={Number(newItemDraft.price || 0)}
                onChange={(e) => setNewItemDraft((prev) => ({ ...prev, price: Number(e.target.value) }))}
                disabled={!selectedCategory}
              />
              <select
                value={newItemDraft.type}
                onChange={(e) => setNewItemDraft((prev) => ({ ...prev, type: e.target.value }))}
                disabled={!selectedCategory}
              >
                <option value="per_event">per_event</option>
                <option value="per_person">per_person</option>
              </select>
              <button type="button" className="ghost compact" onClick={handleCreateMenuItem} disabled={menuActionLoading || !selectedCategory}>
                {menuActionLoading ? "Saving..." : "Add Item"}
              </button>
            </div>

            {menuLoading && <p className="source-note">Loading menu data...</p>}
            {!menuLoading && selectedCategory && selectedCategoryItems.length === 0 && (
              <p className="source-note">No menu items in this category yet.</p>
            )}

            {!menuLoading && selectedCategoryItems.map((item) => (
              <div className="admin-menu-row admin-menu-row-managed" key={item.id}>
                <input value={item.id || ""} disabled />
                <input
                  type="text"
                  value={item.name || ""}
                  onChange={(e) => patchManagedMenuItem(item.id, "name", e.target.value)}
                />
                <select
                  value={item.type || "per_event"}
                  onChange={(e) => patchManagedMenuItem(item.id, "type", e.target.value)}
                >
                  <option value="per_event">per_event</option>
                  <option value="per_person">per_person</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={Number(item.price || 0)}
                  onChange={(e) => patchManagedMenuItem(item.id, "price", Number(e.target.value))}
                />
                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => handleUpdateManagedMenuItem(item)}
                  disabled={menuActionLoading}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ghost compact"
                  onClick={() => handleDeleteManagedMenuItem(item.id)}
                  disabled={menuActionLoading}
                >
                  Delete
                </button>
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
          <div className="admin-section-head">
            <h3>Labor Rate Types</h3>
            <div className="admin-inline-actions">
              <button type="button" className="ghost compact" onClick={addBartenderRateType}>Add Bartender Type</button>
              <button type="button" className="ghost compact" onClick={addStaffingRateType}>Add Staffing Type</button>
            </div>
          </div>
          <div className="admin-section-body">
            <h4>Bartender Rate Types</h4>
            {(draft.settings?.bartenderRateTypes || []).map((rateType, index) => (
              <div className="admin-row" key={rateType.id || `bartender-rate-${index}`}>
                <input
                  value={rateType.id || ""}
                  onChange={(e) => patchBartenderRateType(index, "id", e.target.value)}
                />
                <input
                  value={rateType.name || ""}
                  onChange={(e) => patchBartenderRateType(index, "name", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number(rateType.rate || 0)}
                  onChange={(e) => patchBartenderRateType(index, "rate", e.target.value)}
                />
                <button type="button" className="ghost compact" onClick={() => removeBartenderRateType(index)}>Delete</button>
              </div>
            ))}
            {(draft.settings?.bartenderRateTypes || []).length === 0 && (
              <p className="source-note">No bartender rate types configured. Use the button above to add one.</p>
            )}
            <label>
              Default bartender type
              <select
                value={draft.settings?.defaultBartenderRateType || ""}
                onChange={(e) => patchTextSetting("defaultBartenderRateType", e.target.value)}
              >
                <option value="">Use numeric fallback</option>
                {(draft.settings?.bartenderRateTypes || []).map((rateType) => (
                  <option key={rateType.id} value={rateType.id}>
                    {rateType.name || rateType.id}
                  </option>
                ))}
              </select>
            </label>

            <h4>Staffing Rate Types</h4>
            {(draft.settings?.staffingRateTypes || []).map((rateType, index) => (
              <div className="admin-row" key={rateType.id || `staffing-rate-${index}`}>
                <input
                  value={rateType.id || ""}
                  onChange={(e) => patchStaffingRateType(index, "id", e.target.value)}
                />
                <input
                  value={rateType.name || ""}
                  onChange={(e) => patchStaffingRateType(index, "name", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number(rateType.serverRate || 0)}
                  onChange={(e) => patchStaffingRateType(index, "serverRate", e.target.value)}
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={Number(rateType.chefRate || 0)}
                  onChange={(e) => patchStaffingRateType(index, "chefRate", e.target.value)}
                />
                <button type="button" className="ghost compact" onClick={() => removeStaffingRateType(index)}>Delete</button>
              </div>
            ))}
            {(draft.settings?.staffingRateTypes || []).length === 0 && (
              <p className="source-note">No staffing rate types configured. Use the button above to add one.</p>
            )}
            <label>
              Default staffing type
              <select
                value={draft.settings?.defaultStaffingRateType || ""}
                onChange={(e) => patchTextSetting("defaultStaffingRateType", e.target.value)}
              >
                <option value="">Use numeric fallback</option>
                {(draft.settings?.staffingRateTypes || []).map((rateType) => (
                  <option key={rateType.id} value={rateType.id}>
                    {rateType.name || rateType.id}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Guided Selling & Staffing Controls</h3>
            <button type="button" className="ghost" onClick={addUpsellRule}>Add Rule</button>
          </div>
          <div className="admin-grid-settings">
            <label>
              <span>Enable guided selling recommendations</span>
              <input
                type="checkbox"
                checked={draft.settings.guidedSellingEnabled !== false}
                onChange={(e) => patchToggleSetting("guidedSellingEnabled", e.target.checked)}
              />
            </label>
            <label>
              <span>Include staffing labor automation in totals</span>
              <input
                type="checkbox"
                checked={draft.settings.staffingLaborEnabled !== false}
                onChange={(e) => patchToggleSetting("staffingLaborEnabled", e.target.checked)}
              />
            </label>
          </div>
          <div className="rule-config-list">
            {(draft.settings?.upsellRules || []).map((rule, ruleIndex) => {
              const kind = String(rule.kind || "addon");
              const targets = getUpsellTargetOptions(kind);
              return (
                <article className="rule-config-card" key={rule.id || `rule-${ruleIndex}`}>
                  <div className="rule-config-head">
                    <strong>{rule.name || `Rule ${ruleIndex + 1}`}</strong>
                    <label className="rule-toggle">
                      <span>Enabled</span>
                      <input
                        type="checkbox"
                        checked={Boolean(rule.enabled)}
                        onChange={(e) => patchUpsellRule(ruleIndex, "enabled", e.target.checked)}
                      />
                    </label>
                  </div>
                  <div className="rule-config-grid">
                    <label>
                      Rule name
                      <input
                        type="text"
                        value={rule.name || ""}
                        onChange={(e) => patchUpsellRule(ruleIndex, "name", e.target.value)}
                      />
                    </label>
                    <label>
                      Rule type
                      <select
                        value={kind}
                        onChange={(e) => patchUpsellRule(ruleIndex, "kind", e.target.value)}
                      >
                        {RULE_KIND_META.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Target item
                      <select
                        value={rule.targetId || ""}
                        onChange={(e) => patchUpsellRule(ruleIndex, "targetId", e.target.value)}
                      >
                        {kind === "package" && <option value="">Auto next higher package</option>}
                        {kind !== "package" && <option value="">Choose target</option>}
                        {targets.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Min guests
                      <input
                        type="number"
                        min="0"
                        max="400"
                        value={Number(rule.minGuests || 0)}
                        onChange={(e) => patchUpsellRule(ruleIndex, "minGuests", e.target.value)}
                      />
                    </label>
                    <label>
                      Min hours
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={Number(rule.minHours || 0)}
                        onChange={(e) => patchUpsellRule(ruleIndex, "minHours", e.target.value)}
                      />
                    </label>
                    <label className="rule-reason-field">
                      Reason shown in quote wizard
                      <input
                        type="text"
                        value={rule.reason || ""}
                        onChange={(e) => patchUpsellRule(ruleIndex, "reason", e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="rule-config-actions">
                    <button type="button" className="ghost compact" onClick={() => removeUpsellRule(ruleIndex)}>Delete Rule</button>
                  </div>
                </article>
              );
            })}
            {(draft.settings?.upsellRules || []).length === 0 && (
              <p className="source-note">No upsell rules are configured yet. Add at least one to power guided selling.</p>
            )}
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

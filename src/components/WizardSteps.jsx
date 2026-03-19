import { currency } from "../lib/quoteCalculator";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StepEvent({
  form,
  setForm,
  styles,
  settings,
  onTemplateChange,
  eventTypes = [],
  onEventTypeChange
}) {
  const templates = Array.isArray(settings?.eventTemplates) ? settings.eventTemplates : [];
  const taxRegions = Array.isArray(settings?.taxRegions) ? settings.taxRegions : [];
  const seasonProfiles = Array.isArray(settings?.seasonalProfiles) ? settings.seasonalProfiles : [];
  const bartenderRateTypes = Array.isArray(settings?.bartenderRateTypes) ? settings.bartenderRateTypes : [];
  const staffingRateTypes = Array.isArray(settings?.staffingRateTypes) ? settings.staffingRateTypes : [];

  return (
    <div className="grid two-col">
      <Field label="Event template">
        <select value={form.eventTemplateId || "custom"} onChange={(e) => onTemplateChange(e.target.value)}>
          <option value="custom">Custom</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </Field>
      <Field label="Event type">
        <select
          value={form.eventTypeId || ""}
          onChange={(e) => (typeof onEventTypeChange === "function"
            ? onEventTypeChange(e.target.value)
            : setForm((f) => ({ ...f, eventTypeId: e.target.value })))}
        >
          <option value="">
            {eventTypes.length ? "Select event type" : "No event types available"}
          </option>
          {eventTypes.map((eventType) => (
            <option key={eventType.id} value={eventType.id}>{eventType.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Event date"><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
      <Field label="Start time"><input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} /></Field>
      <Field label="Event hours"><input type="number" min="1" max="12" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: Number(e.target.value) }))} /></Field>
      <Field label="Bartenders"><input type="number" min="0" max="10" value={form.bartenders} onChange={(e) => setForm((f) => ({ ...f, bartenders: Number(e.target.value) }))} /></Field>
      <Field label="Bartender rate type">
        <select
          value={form.bartenderRateTypeId || ""}
          onChange={(e) => setForm((f) => ({ ...f, bartenderRateTypeId: e.target.value }))}
        >
          <option value="">Default bartender rate</option>
          {bartenderRateTypes.map((rateType) => (
            <option key={rateType.id} value={rateType.id}>
              {rateType.name} ({currency(rateType.rate)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Bartender rate override (optional)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.bartenderRateOverride ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, bartenderRateOverride: e.target.value }))}
          placeholder="Use selected/default bartender type"
        />
      </Field>
      <Field label="Staffing rate type">
        <select
          value={form.staffingRateTypeId || ""}
          onChange={(e) => setForm((f) => ({ ...f, staffingRateTypeId: e.target.value }))}
        >
          <option value="">Default staffing rate</option>
          {staffingRateTypes.map((rateType) => (
            <option key={rateType.id} value={rateType.id}>
              {rateType.name} (Server {currency(rateType.serverRate)} / Chef {currency(rateType.chefRate)})
            </option>
          ))}
        </select>
      </Field>
      <Field label="Server rate override (optional)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.serverRateOverride ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, serverRateOverride: e.target.value }))}
          placeholder="Use selected/default staffing type"
        />
      </Field>
      <Field label="Chef rate override (optional)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={form.chefRateOverride ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, chefRateOverride: e.target.value }))}
          placeholder="Use selected/default staffing type"
        />
      </Field>
      <Field label="Guests (max 400)"><input type="number" min="1" max="400" value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: Number(e.target.value) }))} /></Field>
      <Field label="Event name"><input type="text" value={form.eventName} onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))} /></Field>
      <Field label="Venue"><input type="text" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} /></Field>
      <Field label="Venue address"><input type="text" value={form.venueAddress || ""} onChange={(e) => setForm((f) => ({ ...f, venueAddress: e.target.value }))} /></Field>
      <Field label="Client / Organization"><input type="text" value={form.clientOrg} onChange={(e) => setForm((f) => ({ ...f, clientOrg: e.target.value }))} /></Field>
      <Field label="Service style">
        <select value={form.style} onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}>
          {styles.map((style) => <option key={style} value={style}>{style}</option>)}
        </select>
      </Field>
      <Field label="Tax region">
        <select value={form.taxRegion || ""} onChange={(e) => setForm((f) => ({ ...f, taxRegion: e.target.value }))}>
          {taxRegions.map((region) => (
            <option key={region.id} value={region.id}>
              {region.name} ({Math.round(Number(region.rate || 0) * 1000) / 10}%)
            </option>
          ))}
        </select>
      </Field>
      <Field label="Season profile">
        <select
          value={form.seasonProfileId || "auto"}
          onChange={(e) => setForm((f) => ({ ...f, seasonProfileId: e.target.value }))}
        >
          <option value="auto">Auto detect</option>
          {seasonProfiles.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}
        </select>
      </Field>
      <Field label="Show disposables on quote">
        <select
          value={form.includeDisposables === false ? "no" : "yes"}
          onChange={(e) => setForm((f) => ({ ...f, includeDisposables: e.target.value === "yes" }))}
        >
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </Field>
      <Field label="Your name"><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
    </div>
  );
}

export function StepMenu({
  form,
  setForm,
  menuSections,
  menuLoading = false
}) {
  const resolvedMenuSections = Array.isArray(menuSections) ? menuSections : [];
  const resolvePricingType = (item) => {
    const raw = String(item?.pricingType || item?.type || "").trim().toLowerCase();
    if (raw === "per_person" || raw === "per_item" || raw === "per_event") return raw;
    return "per_event";
  };
  const pricingLabel = (item) => {
    const pricingType = resolvePricingType(item);
    if (pricingType === "per_person") return `${currency(item.price)}/person`;
    if (pricingType === "per_item") return `${currency(item.price)}/item`;
    return currency(item.price);
  };
  const menuQuantities = form.menuItemQuantities || {};

  const toggleMenuItem = (item, checked) => {
    const itemId = String(item?.id || "").trim();
    if (!itemId) return;
    const pricingType = resolvePricingType(item);
    setForm((f) => {
      const nextSelected = new Set(Array.isArray(f.menuItems) ? f.menuItems : []);
      const nextQuantities = { ...(f.menuItemQuantities || {}) };
      if (checked) {
        nextSelected.add(itemId);
        if (pricingType === "per_item") {
          nextQuantities[itemId] = Math.max(1, Number(nextQuantities[itemId] || 1));
        }
      } else {
        nextSelected.delete(itemId);
        delete nextQuantities[itemId];
      }
      return {
        ...f,
        menuItems: [...nextSelected],
        menuItemQuantities: nextQuantities
      };
    });
  };

  const patchMenuQuantity = (itemId, value) => {
    const quantity = Math.max(1, Math.round(Number(value || 1)));
    setForm((f) => ({
      ...f,
      menuItemQuantities: {
        ...(f.menuItemQuantities || {}),
        [itemId]: quantity
      }
    }));
  };

  return (
    <div className="grid two-col">
      {resolvedMenuSections.length > 0 && (
        <div className="menu-library">
          <h4>Customized Cuisine Menu</h4>
          {menuLoading && <p className="source-note">Loading menu for selected event type...</p>}
          <p className="source-note">Select menu items to include in this quote proposal.</p>
          <div className="menu-grid">
            {resolvedMenuSections.map((section) => (
              <section className="menu-category" key={section.id}>
                <div className="menu-category-head">
                  <strong>{section.name}</strong>
                  <small>
                    {
                      (section.items || []).filter((item) => form.menuItems.includes(item.id)).length
                    }/{(section.items || []).length}
                  </small>
                </div>
                <div className="checklist">
                  {(section.items || []).map((item) => (
                    <label className="checkrow checkrow-quantity" key={item.id}>
                      <input
                        type="checkbox"
                        checked={form.menuItems.includes(item.id)}
                        onChange={(e) => toggleMenuItem(item, e.target.checked)}
                      />
                      <span>{item.name}</span>
                      <small>{pricingLabel(item)}</small>
                      {resolvePricingType(item) === "per_item" && form.menuItems.includes(item.id) && (
                        <input
                          className="qty-input"
                          type="number"
                          min="1"
                          step="1"
                          value={Math.max(1, Number(menuQuantities[item.id] || 1))}
                          onChange={(e) => patchMenuQuantity(item.id, e.target.value)}
                        />
                      )}
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
      {resolvedMenuSections.length === 0 && !menuLoading && (
        <div className="menu-library">
          <h4>Customized Cuisine Menu</h4>
          <p className="source-note">Select an event type to load menu categories and items.</p>
        </div>
      )}
    </div>
  );
}

export function StepServices({
  form,
  setForm,
  catalog,
  recommendations,
  onApplyRecommendation,
  guidedSellingEnabled: guidedSellingEnabledProp
}) {
  const guidedSellingEnabled =
    guidedSellingEnabledProp !== undefined
      ? guidedSellingEnabledProp !== false
      : catalog.settings?.guidedSellingEnabled !== false;
  const resolvePricingType = (item, fallback = "per_event") => {
    const raw = String(item?.pricingType || item?.type || "").trim().toLowerCase();
    if (raw === "per_person" || raw === "per_item" || raw === "per_event") return raw;
    return fallback;
  };
  const pricingLabel = (item, fallback = "per_event") => {
    const pricingType = resolvePricingType(item, fallback);
    if (pricingType === "per_person") return `${currency(item.price)}/person`;
    if (pricingType === "per_item") return `${currency(item.price)}/item`;
    return currency(item.price);
  };

  const toggle = (key, quantityKey, item, checked, fallbackQty = 1) => {
    const id = String(item?.id || "").trim();
    if (!id) return;
    const pricingType = resolvePricingType(item, key === "rentals" ? "per_item" : "per_event");
    setForm((f) => {
      const set = new Set(Array.isArray(f[key]) ? f[key] : []);
      const quantityMap = { ...(f[quantityKey] || {}) };
      if (checked) {
        set.add(id);
        if (pricingType === "per_item") {
          quantityMap[id] = Math.max(1, Number(quantityMap[id] || fallbackQty || 1));
        }
      } else {
        set.delete(id);
        delete quantityMap[id];
      }
      return {
        ...f,
        [key]: [...set],
        [quantityKey]: quantityMap
      };
    });
  };

  const patchQuantity = (quantityKey, id, value) => {
    const quantity = Math.max(1, Math.round(Number(value || 1)));
    setForm((f) => ({
      ...f,
      [quantityKey]: {
        ...(f[quantityKey] || {}),
        [id]: quantity
      }
    }));
  };

  return (
    <div className="grid two-col">
      <Field label="Package tier">
        <select value={form.pkg} onChange={(e) => setForm((f) => ({ ...f, pkg: e.target.value }))}>
          {catalog.packages.map((p) => <option key={p.id} value={p.id}>{p.name} - {currency(p.ppp)}/person</option>)}
        </select>
      </Field>
      <Field label="Travel (round trip miles)">
        <input
          type="number"
          min="0"
          value={form.milesRT}
          onChange={(e) => setForm((f) => ({ ...f, milesRT: Number(e.target.value) }))}
        />
      </Field>

      <div>
        <h4>Add-ons</h4>
        <div className="checklist">
          {catalog.addons.map((item) => {
            const pricingType = resolvePricingType(item, "per_person");
            const selected = form.addons.includes(item.id);
            return (
              <label className="checkrow checkrow-quantity" key={item.id}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => toggle("addons", "addonQuantities", item, e.target.checked, 1)}
                />
                <span>{item.name}</span>
                <small>{pricingLabel(item, "per_person")}</small>
                {pricingType === "per_item" && selected && (
                  <input
                    className="qty-input"
                    type="number"
                    min="1"
                    step="1"
                    value={Math.max(1, Number(form.addonQuantities?.[item.id] || 1))}
                    onChange={(e) => patchQuantity("addonQuantities", item.id, e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <h4>Rentals</h4>
        <div className="checklist">
          {catalog.rentals.map((item) => {
            const pricingType = resolvePricingType(item, "per_item");
            const selected = form.rentals.includes(item.id);
            const fallbackQty = typeof item.qtyRule === "function"
              ? item.qtyRule(Math.max(0, Number(form.guests || 0)))
              : 1;
            return (
              <label className="checkrow checkrow-quantity" key={item.id}>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => toggle("rentals", "rentalQuantities", item, e.target.checked, fallbackQty)}
                />
                <span>{item.name}</span>
                <small>{pricingLabel(item, "per_item")}</small>
                {pricingType === "per_item" && selected && (
                  <input
                    className="qty-input"
                    type="number"
                    min="1"
                    step="1"
                    value={Math.max(1, Number(form.rentalQuantities?.[item.id] || fallbackQty))}
                    onChange={(e) => patchQuantity("rentalQuantities", item.id, e.target.value)}
                  />
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="recommendation-panel">
        <h4>Recommended Upgrades</h4>
        {!guidedSellingEnabled && (
          <p className="source-note">Guided selling is currently disabled in Catalog Admin.</p>
        )}
        {guidedSellingEnabled && recommendations.length === 0 && (
          <p className="source-note">No rule matches this quote yet. Increase guests/hours or adjust rule triggers.</p>
        )}
        {guidedSellingEnabled && recommendations.length > 0 && (
          <div className="recommendation-list">
            {recommendations.map((item) => (
              <article className="recommendation-card" key={item.key}>
                <div>
                  <strong>{item.label}</strong>
                  <p>{item.reason}</p>
                  <small>{item.impact}</small>
                </div>
                <button type="button" className="ghost compact" onClick={() => onApplyRecommendation(item)}>
                  Apply
                </button>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function StepReview({ form, totals, settings }) {
  const quoteDate = new Date().toLocaleDateString();
  const eventDateLabel = form.date ? new Date(`${form.date}T12:00:00`).toLocaleDateString() : "-";
  const eventTimeLabel = form.time ? new Date(`2000-01-01T${form.time}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "-";
  const menuLookup = new Map(
    (settings.menuSections || []).flatMap((section) =>
      (section.items || []).map((item) => [item.id, item.name])
    )
  );
  const menuNames = (form.menuItems || []).map((id) => menuLookup.get(id)).filter(Boolean);
  const effectivePerPerson = totals.guests > 0 ? totals.base / totals.guests : 0;
  const staffingOnly = Math.max(0, totals.labor - totals.bartenderLabor);
  const staffingLaborEnabled = totals.staffingLaborEnabled !== false;
  const validityDays = Math.max(1, Number(settings.quoteValidityDays || 30));
  const businessContact = [
    settings.businessAddress,
    settings.businessPhone,
    settings.businessEmail
  ].filter(Boolean).join("  •  ");

  return (
    <div className="review">
      <article className="quote-sheet">
        <h2>Catering Quote</h2>

        <div className="quote-sheet-meta">
          <p><strong>Quote Date:</strong> {quoteDate}</p>
          <p className="quote-sheet-meta-wide">
            <strong>Responsible Party / Client:</strong> {form.name || "-"}
            {form.clientOrg ? ` / ${form.clientOrg}` : ""}
          </p>
          <p><strong>Phone #:</strong> {form.phone || "-"}</p>
          <p><strong>Email Address:</strong> {form.email || "-"}</p>
          <p><strong># of Guests:</strong> {form.guests || 0}</p>
          <p><strong>Time of Event:</strong> {eventTimeLabel}</p>
          <p><strong>Name of Event:</strong> {form.eventName || "-"}</p>
          <p><strong>Date of Event:</strong> {eventDateLabel}</p>
          <p className="quote-sheet-meta-wide"><strong>Event Location:</strong> {form.venue || "-"}</p>
          <p className="quote-sheet-meta-wide"><strong>Venue Address:</strong> {form.venueAddress || "-"}</p>
        </div>

        <section className="quote-sheet-menu">
          <h3>Menu</h3>
          <p>{menuNames.join(", ") || "-"}</p>
        </section>

        <section className="quote-sheet-charges">
          <div className="quote-charge"><span>Per Person: {currency(effectivePerPerson)} x ({totals.guests})</span><strong>{currency(totals.base)}</strong></div>
          <div className="quote-charge"><span>Tax: ({Math.round(totals.taxRateApplied * 1000) / 10}%)</span><strong>{currency(totals.tax)}</strong></div>
          {staffingLaborEnabled && <div className="quote-charge"><span>Staffing</span><strong>{currency(staffingOnly)}</strong></div>}
          <div className="quote-charge"><span>Travel Fee</span><strong>{currency(totals.travel)}</strong></div>
          {staffingLaborEnabled && <div className="quote-charge"><span>Bartender</span><strong>{currency(totals.bartenderLabor)}</strong></div>}
          {!staffingLaborEnabled && (
            <div className="quote-charge quote-charge-wide">
              <span>Staffing labor automation</span>
              <strong>Disabled</strong>
            </div>
          )}
          <div className="quote-charge"><span>Gratuity</span><strong>{currency(totals.serviceFee)}</strong></div>
          {(totals.addons > 0 || totals.rentals > 0 || totals.menu > 0) && (
            <div className="quote-charge quote-charge-wide">
              <span>Add-ons/Rentals/Menu</span>
              <strong>{currency(totals.addons + totals.rentals + totals.menu)}</strong>
            </div>
          )}
        </section>

        {form.includeDisposables !== false && (
          <p className="quote-center-note"><strong>{settings.disposablesNote || "All disposables are included in this quote."}</strong></p>
        )}
        <p className="quote-total-line">TOTAL: <strong>{currency(totals.total)}</strong></p>

        <div className="quote-sheet-bottom">
          <p><strong>Quote prepared by:</strong> {settings.quotePreparedBy || "-"}</p>
          <p><strong>Quote is valid for {validityDays} days.</strong></p>
        </div>
        <p className="quote-acceptance">To accept quote, please sign and return to {settings.acceptanceEmail || settings.businessEmail || "-"}</p>
        <p className="quote-deposit-tag"><strong>{settings.depositNotice || "30% deposit is required to lock in your date."}</strong></p>
        <p className="quote-signoff">Gratuity is never expected but is always appreciated!</p>
        <p className="quote-contact-strip">{businessContact || "-"}</p>
      </article>

      <div className="summary-total">
        <p>Deposit ({Math.round(settings.depositPct * 100)}%): <strong>{currency(totals.deposit)}</strong></p>
      </div>
    </div>
  );
}

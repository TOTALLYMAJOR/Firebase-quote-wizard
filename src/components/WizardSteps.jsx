import { currency } from "../lib/quoteCalculator";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StepEvent({ form, setForm, styles, settings, onTemplateChange }) {
  const templates = Array.isArray(settings?.eventTemplates) ? settings.eventTemplates : [];
  const taxRegions = Array.isArray(settings?.taxRegions) ? settings.taxRegions : [];
  const seasonProfiles = Array.isArray(settings?.seasonalProfiles) ? settings.seasonalProfiles : [];

  return (
    <div className="grid two-col">
      <Field label="Event template">
        <select value={form.eventTemplateId || "custom"} onChange={(e) => onTemplateChange(e.target.value)}>
          <option value="custom">Custom</option>
          {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
        </select>
      </Field>
      <Field label="Event date"><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
      <Field label="Start time"><input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} /></Field>
      <Field label="Event hours"><input type="number" min="1" max="12" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: Number(e.target.value) }))} /></Field>
      <Field label="Bartenders"><input type="number" min="0" max="10" value={form.bartenders} onChange={(e) => setForm((f) => ({ ...f, bartenders: Number(e.target.value) }))} /></Field>
      <Field label="Guests (max 400)"><input type="number" min="1" max="400" value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: Number(e.target.value) }))} /></Field>
      <Field label="Event name"><input type="text" value={form.eventName} onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))} /></Field>
      <Field label="Venue"><input type="text" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} /></Field>
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
      <Field label="Your name"><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="Phone"><input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
    </div>
  );
}

export function StepMenu({ form, setForm, catalog, recommendations, onApplyRecommendation }) {
  const menuSections = Array.isArray(catalog.settings?.menuSections) ? catalog.settings.menuSections : [];

  const toggle = (key, id, checked) => {
    setForm((f) => {
      const set = new Set(f[key]);
      if (checked) set.add(id);
      else set.delete(id);
      return { ...f, [key]: [...set] };
    });
  };

  return (
    <div className="grid two-col">
      <Field label="Package tier">
        <select value={form.pkg} onChange={(e) => setForm((f) => ({ ...f, pkg: e.target.value }))}>
          {catalog.packages.map((p) => <option key={p.id} value={p.id}>{p.name} - {currency(p.ppp)}/person</option>)}
        </select>
      </Field>
      <Field label="Travel (round trip miles)"><input type="number" min="0" value={form.milesRT} onChange={(e) => setForm((f) => ({ ...f, milesRT: Number(e.target.value) }))} /></Field>

      <div>
        <h4>Add-ons</h4>
        <div className="checklist">
          {catalog.addons.map((item) => (
            <label className="checkrow" key={item.id}>
              <input
                type="checkbox"
                checked={form.addons.includes(item.id)}
                onChange={(e) => toggle("addons", item.id, e.target.checked)}
              />
              <span>{item.name}</span>
              <small>{item.type === "per_person" ? `${currency(item.price)}/person` : currency(item.price)}</small>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4>Rentals</h4>
        <div className="checklist">
          {catalog.rentals.map((item) => (
            <label className="checkrow" key={item.id}>
              <input
                type="checkbox"
                checked={form.rentals.includes(item.id)}
                onChange={(e) => toggle("rentals", item.id, e.target.checked)}
              />
              <span>{item.name}</span>
              <small>{currency(item.price)} each</small>
            </label>
          ))}
        </div>
      </div>

      {recommendations.length > 0 && (
        <div className="recommendation-panel">
          <h4>Recommended Upgrades</h4>
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
        </div>
      )}

      {menuSections.length > 0 && (
        <div className="menu-library">
          <h4>Customized Cuisine Menu</h4>
          <p className="source-note">Select menu items to include in this quote proposal.</p>
          <div className="menu-grid">
            {menuSections.map((section) => (
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
                    <label className="checkrow" key={item.id}>
                      <input
                        type="checkbox"
                        checked={form.menuItems.includes(item.id)}
                        onChange={(e) => toggle("menuItems", item.id, e.target.checked)}
                      />
                      <span>{item.name}</span>
                      <small>{item.type === "per_person" ? `${currency(item.price)}/person` : currency(item.price)}</small>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      )}
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
        </div>

        <section className="quote-sheet-menu">
          <h3>Menu</h3>
          <p>{menuNames.join(", ") || "-"}</p>
        </section>

        <section className="quote-sheet-charges">
          <div className="quote-charge"><span>Per Person: {currency(effectivePerPerson)} x ({totals.guests})</span><strong>{currency(totals.base)}</strong></div>
          <div className="quote-charge"><span>Tax: ({Math.round(totals.taxRateApplied * 1000) / 10}%)</span><strong>{currency(totals.tax)}</strong></div>
          <div className="quote-charge"><span>Staffing</span><strong>{currency(staffingOnly)}</strong></div>
          <div className="quote-charge"><span>Travel Fee</span><strong>{currency(totals.travel)}</strong></div>
          <div className="quote-charge"><span>Bartender</span><strong>{currency(totals.bartenderLabor)}</strong></div>
          <div className="quote-charge"><span>Gratuity</span><strong>{currency(totals.serviceFee)}</strong></div>
          {(totals.addons > 0 || totals.rentals > 0 || totals.menu > 0) && (
            <div className="quote-charge quote-charge-wide">
              <span>Add-ons/Rentals/Menu</span>
              <strong>{currency(totals.addons + totals.rentals + totals.menu)}</strong>
            </div>
          )}
        </section>

        <p className="quote-center-note"><strong>{settings.disposablesNote || "All disposables are included in this quote."}</strong></p>
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

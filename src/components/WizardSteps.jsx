import { currency } from "../lib/quoteCalculator";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function StepEvent({ form, setForm, styles }) {
  return (
    <div className="grid two-col">
      <Field label="Event date"><input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></Field>
      <Field label="Start time"><input type="time" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} /></Field>
      <Field label="Event hours"><input type="number" min="1" max="12" value={form.hours} onChange={(e) => setForm((f) => ({ ...f, hours: Number(e.target.value) }))} /></Field>
      <Field label="Guests (max 400)"><input type="number" min="1" max="400" value={form.guests} onChange={(e) => setForm((f) => ({ ...f, guests: Number(e.target.value) }))} /></Field>
      <Field label="Venue"><input type="text" value={form.venue} onChange={(e) => setForm((f) => ({ ...f, venue: e.target.value }))} /></Field>
      <Field label="Service style">
        <select value={form.style} onChange={(e) => setForm((f) => ({ ...f, style: e.target.value }))}>
          {styles.map((style) => <option key={style} value={style}>{style}</option>)}
        </select>
      </Field>
      <Field label="Your name"><input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></Field>
      <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></Field>
    </div>
  );
}

export function StepMenu({ form, setForm, catalog }) {
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
    </div>
  );
}

export function StepReview({ form, totals, settings }) {
  return (
    <div className="review">
      <table>
        <thead>
          <tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr>
        </thead>
        <tbody>
          <tr><td>{totals.selectedPkg?.name} package</td><td>{form.guests}</td><td>{currency(totals.selectedPkg?.ppp || 0)}</td><td>{currency(totals.base)}</td></tr>
          <tr><td>Travel</td><td>1</td><td>{currency(settings.perMileRate)} x {form.milesRT} mi</td><td>{currency(totals.travel)}</td></tr>
          <tr><td>Labor</td><td>1</td><td>S:{totals.servers} C:{totals.chefs}</td><td>{currency(totals.labor)}</td></tr>
          <tr><td>Service fee</td><td>1</td><td>{Math.round(settings.serviceFeePct * 100)}%</td><td>{currency(totals.serviceFee)}</td></tr>
          <tr><td>Tax</td><td>1</td><td>{Math.round(settings.taxRate * 100)}%</td><td>{currency(totals.tax)}</td></tr>
        </tbody>
      </table>

      <div className="summary-total">
        <p>Estimated Total: <strong>{currency(totals.total)}</strong></p>
        <p>Deposit ({Math.round(settings.depositPct * 100)}%): <strong>{currency(totals.deposit)}</strong></p>
        {totals.cardFee > 0 && <p>Card Fee (3% deposit): <strong>{currency(totals.cardFee)}</strong></p>}
      </div>
    </div>
  );
}

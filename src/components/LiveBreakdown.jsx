import { currency } from "../lib/quoteCalculator";

export default function LiveBreakdown({ form, totals, settings, catalog }) {
  const selectedAddonNames = catalog.addons.filter((a) => form.addons.includes(a.id)).map((a) => a.name);
  const selectedRentalNames = catalog.rentals.filter((r) => form.rentals.includes(r.id)).map((r) => r.name);

  return (
    <aside className="panel breakdown-panel">
      <h3>Live Breakdown</h3>
      <p className="muted">Auto-updates as options change.</p>

      <dl className="kv-list">
        <div><dt>Guests</dt><dd>{totals.guests}</dd></div>
        <div><dt>Package</dt><dd>{totals.selectedPkg?.name || "-"}</dd></div>
        <div><dt>Add-ons</dt><dd>{selectedAddonNames.join(", ") || "-"}</dd></div>
        <div><dt>Rentals</dt><dd>{selectedRentalNames.join(", ") || "-"}</dd></div>
        <div><dt>Travel</dt><dd>{form.milesRT} mi</dd></div>
      </dl>

      <hr />

      <dl className="kv-list totals">
        <div><dt>Subtotal</dt><dd>{currency(totals.base + totals.addons + totals.rentals + totals.labor + totals.travel)}</dd></div>
        <div><dt>Service</dt><dd>{currency(totals.serviceFee)}</dd></div>
        <div><dt>Tax</dt><dd>{currency(totals.tax)}</dd></div>
        <div><dt>Total</dt><dd>{currency(totals.total)}</dd></div>
        <div><dt>Deposit ({Math.round(settings.depositPct * 100)}%)</dt><dd>{currency(totals.deposit)}</dd></div>
        {totals.cardFee > 0 && <div><dt>Card Fee</dt><dd>{currency(totals.cardFee)}</dd></div>}
      </dl>
    </aside>
  );
}

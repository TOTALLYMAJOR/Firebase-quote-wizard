import { currency } from "../lib/quoteCalculator";

export default function LiveBreakdown({ form, totals, settings, catalog }) {
  const resolvePricingType = (item, fallback = "per_event") => {
    const raw = String(item?.pricingType || item?.type || "").trim().toLowerCase();
    if (raw === "per_person" || raw === "per_item" || raw === "per_event") return raw;
    return fallback;
  };

  const selectedAddons = catalog.addons
    .filter((item) => form.addons.includes(item.id))
    .map((item) => {
      const pricingType = resolvePricingType(item, "per_person");
      const quantity = pricingType === "per_item" ? Math.max(1, Number(form.addonQuantities?.[item.id] || 1)) : null;
      return {
        id: item.id,
        name: item.name,
        label: quantity ? `${item.name} x${quantity}` : item.name
      };
    });

  const selectedRentals = catalog.rentals
    .filter((item) => form.rentals.includes(item.id))
    .map((item) => {
      const pricingType = resolvePricingType(item, "per_item");
      const fallbackQty = typeof item.qtyRule === "function" ? item.qtyRule(Math.max(0, Number(form.guests || 0))) : 1;
      const quantity = pricingType === "per_item" ? Math.max(1, Number(form.rentalQuantities?.[item.id] || fallbackQty)) : null;
      return {
        id: item.id,
        name: item.name,
        label: quantity ? `${item.name} x${quantity}` : item.name
      };
    });

  const menuLookup = new Map(
    (settings.menuSections || []).flatMap((section) =>
      (section.items || []).map((item) => [item.id, item])
    )
  );
  const selectedMenuItems = (form.menuItems || []).map((id) => {
    const item = menuLookup.get(id);
    const pricingType = resolvePricingType(item, "per_event");
    const quantity = pricingType === "per_item" ? Math.max(1, Number(form.menuItemQuantities?.[id] || 1)) : null;
    const name = item?.name || id;
    return {
      id,
      name,
      label: quantity ? `${name} x${quantity}` : name
    };
  });

  const staffingLaborEnabled = totals.staffingLaborEnabled !== false;
  const subtotal = totals.base + totals.addons + totals.rentals + totals.menu + totals.labor + totals.travel;

  return (
    <aside className="panel breakdown-panel">
      <h3>Live Breakdown</h3>
      <p className="muted">Auto-updates as options change.</p>

      <dl className="kv-list">
        <div><dt>Guests</dt><dd>{totals.guests}</dd></div>
        <div><dt>Package</dt><dd>{totals.selectedPkg?.name || "-"}</dd></div>
        <div><dt>Add-ons</dt><dd>{selectedAddons.length}</dd></div>
        <div><dt>Rentals</dt><dd>{selectedRentals.length}</dd></div>
        <div><dt>Menu Picks</dt><dd>{selectedMenuItems.length}</dd></div>
        <div><dt>Bartenders</dt><dd>{totals.bartenders}</dd></div>
        <div><dt>Staffing Labor</dt><dd>{staffingLaborEnabled ? "Enabled" : "Disabled"}</dd></div>
        <div><dt>Bartender Rate</dt><dd>{currency(totals.bartenderRateApplied || 0)}</dd></div>
        <div><dt>Server Rate</dt><dd>{currency(totals.serverRateApplied || 0)}</dd></div>
        <div><dt>Chef Rate</dt><dd>{currency(totals.chefRateApplied || 0)}</dd></div>
        <div><dt>Travel</dt><dd>{form.milesRT} mi</dd></div>
        <div><dt>Tax Region</dt><dd>{totals.taxRegionName || "-"}</dd></div>
        <div><dt>Season</dt><dd>{totals.seasonProfileName || "Standard"}</dd></div>
      </dl>

      <hr />

      <div className="breakdown-selection-groups">
        <div>
          <strong>Selected Add-ons</strong>
          <p>{selectedAddons.map((item) => item.label).join(", ") || "-"}</p>
        </div>
        <div>
          <strong>Selected Rentals</strong>
          <p>{selectedRentals.map((item) => item.label).join(", ") || "-"}</p>
        </div>
        <div>
          <strong>Selected Menu Items</strong>
          <p>{selectedMenuItems.map((item) => item.label).join(", ") || "-"}</p>
        </div>
      </div>

      <hr />

      <dl className="kv-list totals">
        <div><dt>Subtotal</dt><dd>{currency(subtotal)}</dd></div>
        <div><dt>Service Fee</dt><dd>{currency(totals.serviceFee)}</dd></div>
        <div><dt>Tax</dt><dd>{currency(totals.tax)}</dd></div>
        <div><dt>Menu Items</dt><dd>{currency(totals.menu)}</dd></div>
        <div><dt>Service ({Math.round(totals.serviceFeePctApplied * 1000) / 10}%)</dt><dd>{currency(totals.serviceFee)}</dd></div>
        <div><dt>Tax ({Math.round(totals.taxRateApplied * 1000) / 10}%)</dt><dd>{currency(totals.tax)}</dd></div>
        <div><dt>Total</dt><dd>{currency(totals.total)}</dd></div>
        <div><dt>Deposit ({Math.round(settings.depositPct * 100)}%)</dt><dd>{currency(totals.deposit)}</dd></div>
      </dl>
    </aside>
  );
}

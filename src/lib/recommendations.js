import { currency } from "./quoteCalculator";

function amountLabel(value) {
  return value > 0 ? `~${currency(value)} impact` : "No pricing impact";
}

function hasSelection(form, key, id) {
  return Array.isArray(form?.[key]) && form[key].includes(id);
}

export function buildUpsellRecommendations({ form, catalog, totals }) {
  const guests = Number(form?.guests || 0);
  const hours = Number(form?.hours || 0);
  const suggestions = [];
  const addonMultiplier = Number(totals?.addonMultiplier || 1);
  const rentalMultiplier = Number(totals?.rentalMultiplier || 1);
  const packageMultiplier = Number(totals?.packageMultiplier || 1);

  const dessert = catalog.addons.find((item) => item.id === "dessert");
  if (dessert && guests >= 40 && !hasSelection(form, "addons", dessert.id)) {
    const estimate = (dessert.type === "per_person" ? dessert.price * guests : dessert.price) * addonMultiplier;
    suggestions.push({
      key: `addon-${dessert.id}`,
      kind: "addon",
      id: dessert.id,
      label: `Add ${dessert.name}`,
      reason: "Large guest counts convert better with dessert included.",
      impact: amountLabel(estimate)
    });
  }

  const beverage = catalog.addons.find((item) => item.id === "coffee") || catalog.addons.find((item) => item.type === "per_event");
  if (beverage && hours >= 4 && !hasSelection(form, "addons", beverage.id)) {
    const estimate = (beverage.type === "per_person" ? beverage.price * guests : beverage.price) * addonMultiplier;
    suggestions.push({
      key: `addon-${beverage.id}`,
      kind: "addon",
      id: beverage.id,
      label: `Add ${beverage.name}`,
      reason: "Longer events usually need a beverage station or coffee closeout.",
      impact: amountLabel(estimate)
    });
  }

  const linens = catalog.rentals.find((item) => item.id === "linens");
  if (linens && guests >= 80 && !hasSelection(form, "rentals", linens.id)) {
    const qty = typeof linens.qtyRule === "function" ? linens.qtyRule(guests) : 1;
    const estimate = linens.price * qty * rentalMultiplier;
    suggestions.push({
      key: `rental-${linens.id}`,
      kind: "rental",
      id: linens.id,
      label: `Add ${linens.name}`,
      reason: "Linen coverage improves setup polish for larger guest counts.",
      impact: amountLabel(estimate)
    });
  }

  const sortedPackages = [...catalog.packages].sort((a, b) => a.ppp - b.ppp);
  const currentIndex = sortedPackages.findIndex((item) => item.id === form.pkg);
  if (guests >= 130 && currentIndex >= 0 && currentIndex < sortedPackages.length - 1) {
    const current = sortedPackages[currentIndex];
    const next = sortedPackages[currentIndex + 1];
    const estimate = Math.max(0, (Number(next.ppp || 0) - Number(current.ppp || 0)) * guests * packageMultiplier);
    suggestions.push({
      key: `package-${next.id}`,
      kind: "package",
      id: next.id,
      label: `Upgrade to ${next.name}`,
      reason: "High-capacity events often benefit from premium menu throughput.",
      impact: amountLabel(estimate)
    });
  }

  return suggestions.slice(0, 4);
}

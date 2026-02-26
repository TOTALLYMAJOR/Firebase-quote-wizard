import { STAFF_RULES } from "../data/mockCatalog";

export function currency(n) {
  return `$${(Math.round(Number(n || 0) * 100) / 100).toFixed(2)}`;
}

export function calculateQuote(form, catalog, settings) {
  const guests = Math.min(400, Number(form.guests || 0));
  const hours = Number(form.hours || 0);
  const selectedPkg = catalog.packages.find((p) => p.id === form.pkg) || catalog.packages[0];

  if (guests <= 0) {
    return {
      selectedPkg,
      guests: 0,
      base: 0,
      addons: 0,
      rentals: 0,
      servers: 0,
      chefs: 0,
      labor: 0,
      travel: 0,
      serviceFee: 0,
      tax: 0,
      total: 0,
      deposit: 0,
      cardFee: 0
    };
  }

  const base = (selectedPkg?.ppp || 0) * guests;

  const addons = catalog.addons
    .filter((a) => form.addons.includes(a.id))
    .reduce((sum, a) => sum + (a.type === "per_person" ? a.price * guests : a.price), 0);

  const rentals = catalog.rentals
    .filter((r) => form.rentals.includes(r.id))
    .reduce((sum, r) => sum + r.price * (typeof r.qtyRule === "function" ? r.qtyRule(guests) : 1), 0);

  const styleRules = STAFF_RULES[form.style] || STAFF_RULES.Buffet;
  const servers =
    styleRules.serverRatio === Number.POSITIVE_INFINITY
      ? 0
      : Math.max(styleRules.minServers, Math.ceil(guests / styleRules.serverRatio));
  const chefs =
    styleRules.chefRatio === Number.POSITIVE_INFINITY ? 0 : Math.ceil(guests / styleRules.chefRatio);

  const labor = settings.serverRate * servers * hours + settings.chefRate * chefs * hours;
  const travel = settings.perMileRate * Number(form.milesRT || 0);
  const preFee = base + addons + rentals + labor + travel;
  const serviceFee = preFee * settings.serviceFeePct;
  const tax = (base + addons + rentals + serviceFee) * settings.taxRate;

  const total = preFee + serviceFee + tax;
  const deposit = total * settings.depositPct;
  const cardFee = form.payMethod === "card" ? deposit * 0.03 : 0;

  return {
    selectedPkg,
    guests,
    base,
    addons,
    rentals,
    servers,
    chefs,
    labor,
    travel,
    serviceFee,
    tax,
    total,
    deposit,
    cardFee
  };
}

export const DEFAULT_PACKAGES = [
  { id: "classic", name: "Classic", ppp: 18 },
  { id: "premium", name: "Premium", ppp: 24 },
  { id: "deluxe", name: "Deluxe", ppp: 32 }
];

export const DEFAULT_ADDONS = [
  { id: "dessert", name: "Dessert", type: "per_person", price: 3 },
  { id: "tea", name: "Sweet Tea", type: "per_person", price: 1.5 },
  { id: "coffee", name: "Coffee Station", type: "per_event", price: 95 }
];

export const DEFAULT_RENTALS = [
  { id: "linens", name: "Linens", price: 8, qtyPerGuests: 8 },
  { id: "chafers", name: "Chafers", price: 12, qtyPerGuests: 40 }
];

export const DEFAULT_SETTINGS = {
  perMileRate: 0.7,
  serviceFeePct: 0.2,
  taxRate: 0.1,
  depositPct: 0.5,
  quoteValidityDays: 30,
  serverRate: 22,
  chefRate: 28
};

export const STAFF_RULES = {
  Buffet: { serverRatio: 25, minServers: 2, chefRatio: Number.POSITIVE_INFINITY },
  Plated: { serverRatio: 12, minServers: 3, chefRatio: 50 },
  Stations: { serverRatio: 20, minServers: 2, chefRatio: 75 },
  "Drop-off": { serverRatio: Number.POSITIVE_INFINITY, minServers: 0, chefRatio: Number.POSITIVE_INFINITY }
};

export function normalizeRental(item) {
  const qtyPerGuests = Number(item.qtyPerGuests || 1);
  return {
    ...item,
    qtyPerGuests,
    qtyRule: (guests) => Math.max(1, Math.ceil(guests / qtyPerGuests))
  };
}

export function normalizeCatalog(raw) {
  return {
    packages: (raw.packages || DEFAULT_PACKAGES).map((p) => ({
      id: p.id,
      name: p.name,
      ppp: Number(p.ppp || 0)
    })),
    addons: (raw.addons || DEFAULT_ADDONS).map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type === "per_event" ? "per_event" : "per_person",
      price: Number(a.price || 0)
    })),
    rentals: (raw.rentals || DEFAULT_RENTALS).map((r) =>
      normalizeRental({
        id: r.id,
        name: r.name,
        price: Number(r.price || 0),
        qtyPerGuests: Number(r.qtyPerGuests || 1)
      })
    ),
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings || {})
    }
  };
}

export function toStorageCatalog(catalog) {
  return {
    packages: catalog.packages.map(({ id, name, ppp }) => ({ id, name, ppp })),
    addons: catalog.addons.map(({ id, name, type, price }) => ({ id, name, type, price })),
    rentals: catalog.rentals.map(({ id, name, price, qtyPerGuests }) => ({
      id,
      name,
      price,
      qtyPerGuests
    })),
    settings: catalog.settings
  };
}

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

export const DEFAULT_SERVICE_FEE_TIERS = [
  { id: "tier-small", minGuests: 0, maxGuests: 99, pct: 0.2 },
  { id: "tier-mid", minGuests: 100, maxGuests: 249, pct: 0.18 },
  { id: "tier-large", minGuests: 250, maxGuests: 9999, pct: 0.16 }
];

export const DEFAULT_TAX_REGIONS = [
  { id: "local", name: "Local", rate: 0.1 },
  { id: "reduced", name: "Reduced District", rate: 0.085 },
  { id: "out_of_state", name: "Out of State", rate: 0 }
];

export const DEFAULT_EVENT_TEMPLATES = [
  {
    id: "wedding",
    name: "Wedding",
    style: "Plated",
    hours: 6,
    pkg: "deluxe",
    addons: ["dessert", "coffee"],
    rentals: ["linens", "chafers"],
    milesRT: 28,
    payMethod: "card",
    taxRegion: "local",
    seasonProfileId: "auto"
  },
  {
    id: "corporate",
    name: "Corporate",
    style: "Buffet",
    hours: 4,
    pkg: "premium",
    addons: ["tea", "coffee"],
    rentals: ["linens"],
    milesRT: 18,
    payMethod: "ach",
    taxRegion: "reduced",
    seasonProfileId: "standard"
  },
  {
    id: "birthday",
    name: "Birthday",
    style: "Stations",
    hours: 4,
    pkg: "classic",
    addons: ["dessert"],
    rentals: ["linens"],
    milesRT: 16,
    payMethod: "card",
    taxRegion: "local",
    seasonProfileId: "standard"
  },
  {
    id: "church",
    name: "Church",
    style: "Drop-off",
    hours: 2,
    pkg: "classic",
    addons: ["tea"],
    rentals: [],
    milesRT: 14,
    payMethod: "ach",
    taxRegion: "out_of_state",
    seasonProfileId: "standard"
  }
];

export const DEFAULT_SEASONAL_PROFILES = [
  {
    id: "standard",
    name: "Standard",
    startMonth: 1,
    startDay: 1,
    endMonth: 12,
    endDay: 31,
    packageMultiplier: 1,
    addonMultiplier: 1,
    rentalMultiplier: 1
  },
  {
    id: "summer_peak",
    name: "Summer Peak",
    startMonth: 5,
    startDay: 20,
    endMonth: 9,
    endDay: 5,
    packageMultiplier: 1.04,
    addonMultiplier: 1.03,
    rentalMultiplier: 1.02
  },
  {
    id: "holiday_peak",
    name: "Holiday Peak",
    startMonth: 11,
    startDay: 15,
    endMonth: 1,
    endDay: 7,
    packageMultiplier: 1.08,
    addonMultiplier: 1.05,
    rentalMultiplier: 1.04
  }
];

export const DEFAULT_SETTINGS = {
  perMileRate: 0.7,
  longDistancePerMileRate: 1.1,
  deliveryThresholdMiles: 30,
  serviceFeePct: 0.2,
  serviceFeeTiers: DEFAULT_SERVICE_FEE_TIERS,
  taxRate: 0.1,
  taxRegions: DEFAULT_TAX_REGIONS,
  defaultTaxRegion: "local",
  depositPct: 0.5,
  quoteValidityDays: 30,
  serverRate: 22,
  chefRate: 28,
  eventTemplates: DEFAULT_EVENT_TEMPLATES,
  seasonalProfiles: DEFAULT_SEASONAL_PROFILES,
  defaultSeasonProfile: "auto"
};

export const STAFF_RULES = {
  Buffet: { serverRatio: 25, minServers: 2, chefRatio: Number.POSITIVE_INFINITY },
  Plated: { serverRatio: 12, minServers: 3, chefRatio: 50 },
  Stations: { serverRatio: 20, minServers: 2, chefRatio: 75 },
  "Drop-off": { serverRatio: Number.POSITIVE_INFINITY, minServers: 0, chefRatio: Number.POSITIVE_INFINITY }
};

function toNumber(value, fallback = 0, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const n = Number(value);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeId(value, fallback) {
  const raw = String(value || fallback || "").trim().toLowerCase();
  const sanitized = raw.replace(/[^\w-]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
  return sanitized || fallback;
}

function normalizeServiceFeeTiers(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_SERVICE_FEE_TIERS;
  return source
    .map((item, idx) => {
      const minGuests = toNumber(item.minGuests, 0, 0);
      const maxGuests = toNumber(item.maxGuests, 9999, minGuests);
      return {
        id: normalizeId(item.id, `tier-${idx + 1}`),
        minGuests,
        maxGuests,
        pct: toNumber(item.pct, 0.2, 0, 1)
      };
    })
    .sort((a, b) => a.minGuests - b.minGuests);
}

function normalizeTaxRegions(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_TAX_REGIONS;
  return source.map((item, idx) => ({
    id: normalizeId(item.id, `region-${idx + 1}`),
    name: String(item.name || `Region ${idx + 1}`),
    rate: toNumber(item.rate, 0.1, 0, 1)
  }));
}

function normalizeTemplate(item, idx) {
  return {
    id: normalizeId(item.id, `template-${idx + 1}`),
    name: String(item.name || `Template ${idx + 1}`),
    style: String(item.style || "Buffet"),
    hours: toNumber(item.hours, 4, 1, 12),
    pkg: String(item.pkg || "classic"),
    addons: Array.isArray(item.addons) ? item.addons.map((id) => String(id)) : [],
    rentals: Array.isArray(item.rentals) ? item.rentals.map((id) => String(id)) : [],
    milesRT: toNumber(item.milesRT, 0, 0),
    payMethod: item.payMethod === "ach" ? "ach" : "card",
    taxRegion: String(item.taxRegion || ""),
    seasonProfileId: String(item.seasonProfileId || "auto")
  };
}

function normalizeEventTemplates(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_EVENT_TEMPLATES;
  return source.map((item, idx) => normalizeTemplate(item, idx));
}

function normalizeSeasonalProfiles(input) {
  const source = Array.isArray(input) && input.length ? input : DEFAULT_SEASONAL_PROFILES;
  return source.map((item, idx) => ({
    id: normalizeId(item.id, `season-${idx + 1}`),
    name: String(item.name || `Season ${idx + 1}`),
    startMonth: toNumber(item.startMonth, 1, 1, 12),
    startDay: toNumber(item.startDay, 1, 1, 31),
    endMonth: toNumber(item.endMonth, 12, 1, 12),
    endDay: toNumber(item.endDay, 31, 1, 31),
    packageMultiplier: toNumber(item.packageMultiplier, 1, 0.5, 2),
    addonMultiplier: toNumber(item.addonMultiplier, 1, 0.5, 2),
    rentalMultiplier: toNumber(item.rentalMultiplier, 1, 0.5, 2)
  }));
}

export function normalizeRental(item) {
  const qtyPerGuests = Number(item.qtyPerGuests || 1);
  return {
    ...item,
    qtyPerGuests,
    qtyRule: (guests) => Math.max(1, Math.ceil(guests / qtyPerGuests))
  };
}

export function normalizeCatalog(raw) {
  const rawSettings = {
    ...DEFAULT_SETTINGS,
    ...(raw.settings || {})
  };
  const serviceFeeTiers = normalizeServiceFeeTiers(rawSettings.serviceFeeTiers);
  const taxRegions = normalizeTaxRegions(rawSettings.taxRegions);
  const eventTemplates = normalizeEventTemplates(rawSettings.eventTemplates);
  const seasonalProfiles = normalizeSeasonalProfiles(rawSettings.seasonalProfiles);
  const defaultTaxRegion = taxRegions.some((region) => region.id === rawSettings.defaultTaxRegion)
    ? rawSettings.defaultTaxRegion
    : taxRegions[0]?.id || DEFAULT_SETTINGS.defaultTaxRegion;
  const defaultSeasonProfile =
    rawSettings.defaultSeasonProfile === "auto" ||
    seasonalProfiles.some((profile) => profile.id === rawSettings.defaultSeasonProfile)
      ? rawSettings.defaultSeasonProfile
      : "auto";
  const fallbackTaxRate = taxRegions.find((region) => region.id === defaultTaxRegion)?.rate;

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
      ...rawSettings,
      perMileRate: toNumber(rawSettings.perMileRate, DEFAULT_SETTINGS.perMileRate, 0),
      longDistancePerMileRate: toNumber(
        rawSettings.longDistancePerMileRate,
        DEFAULT_SETTINGS.longDistancePerMileRate,
        0
      ),
      deliveryThresholdMiles: toNumber(
        rawSettings.deliveryThresholdMiles,
        DEFAULT_SETTINGS.deliveryThresholdMiles,
        0
      ),
      serviceFeePct: toNumber(rawSettings.serviceFeePct, DEFAULT_SETTINGS.serviceFeePct, 0, 1),
      serviceFeeTiers,
      taxRate: toNumber(rawSettings.taxRate, fallbackTaxRate ?? DEFAULT_SETTINGS.taxRate, 0, 1),
      taxRegions,
      defaultTaxRegion,
      depositPct: toNumber(rawSettings.depositPct, DEFAULT_SETTINGS.depositPct, 0, 1),
      quoteValidityDays: toNumber(rawSettings.quoteValidityDays, DEFAULT_SETTINGS.quoteValidityDays, 1),
      serverRate: toNumber(rawSettings.serverRate, DEFAULT_SETTINGS.serverRate, 0),
      chefRate: toNumber(rawSettings.chefRate, DEFAULT_SETTINGS.chefRate, 0),
      eventTemplates,
      seasonalProfiles,
      defaultSeasonProfile
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

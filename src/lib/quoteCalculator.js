import { STAFF_RULES } from "../data/mockCatalog";

export function currency(n) {
  return `$${(Math.round(Number(n || 0) * 100) / 100).toFixed(2)}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isNaN(n) ? fallback : n;
}

function toOptionalRate(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (text === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function toTypeId(value) {
  return String(value || "").trim();
}

function dateParts(isoDate) {
  const raw = isoDate ? new Date(isoDate) : new Date();
  if (Number.isNaN(raw.getTime())) {
    const now = new Date();
    return { month: now.getMonth() + 1, day: now.getDate() };
  }
  return { month: raw.getMonth() + 1, day: raw.getDate() };
}

function seasonRangeContains(profile, month, day) {
  const target = month * 100 + day;
  const start = toNumber(profile?.startMonth, 1) * 100 + toNumber(profile?.startDay, 1);
  const end = toNumber(profile?.endMonth, 12) * 100 + toNumber(profile?.endDay, 31);

  if (start <= end) {
    return target >= start && target <= end;
  }
  return target >= start || target <= end;
}

export function resolveServiceFeePct(guests, settings) {
  const tiers = Array.isArray(settings?.serviceFeeTiers) ? settings.serviceFeeTiers : [];
  const match = tiers.find((tier) => guests >= Number(tier.minGuests || 0) && guests <= Number(tier.maxGuests || 9999));
  if (match) return Number(match.pct || 0);
  return Number(settings?.serviceFeePct || 0);
}

export function resolveTaxRegion(form, settings) {
  const regions = Array.isArray(settings?.taxRegions) ? settings.taxRegions : [];
  const fallbackRate = Number(settings?.taxRate || 0);
  const defaultRegionId = form?.taxRegion || settings?.defaultTaxRegion;
  const selected = regions.find((region) => region.id === defaultRegionId) || regions[0];

  if (selected) {
    return {
      id: selected.id,
      name: selected.name,
      rate: Number(selected.rate || 0)
    };
  }

  return {
    id: "default",
    name: "Default",
    rate: fallbackRate
  };
}

export function resolveSeasonProfile(form, settings) {
  const profiles = Array.isArray(settings?.seasonalProfiles) ? settings.seasonalProfiles : [];
  const explicit = form?.seasonProfileId;
  const defaultProfileId = settings?.defaultSeasonProfile || "auto";

  if (!profiles.length) {
    return {
      id: "standard",
      name: "Standard",
      packageMultiplier: 1,
      addonMultiplier: 1,
      rentalMultiplier: 1
    };
  }

  if (explicit && explicit !== "auto") {
    const chosen = profiles.find((profile) => profile.id === explicit);
    if (chosen) return chosen;
  }

  if (defaultProfileId && defaultProfileId !== "auto") {
    const chosen = profiles.find((profile) => profile.id === defaultProfileId);
    if (chosen) return chosen;
  }

  const { month, day } = dateParts(form?.date);
  const autoMatch = profiles.find((profile) => seasonRangeContains(profile, month, day));
  return autoMatch || profiles[0];
}

export function resolveLaborRates(form, settings) {
  const bartenderRateTypes = Array.isArray(settings?.bartenderRateTypes) ? settings.bartenderRateTypes : [];
  const staffingRateTypes = Array.isArray(settings?.staffingRateTypes) ? settings.staffingRateTypes : [];

  const selectedBartenderRateTypeId = toTypeId(form?.bartenderRateTypeId) || toTypeId(settings?.defaultBartenderRateType);
  const selectedStaffingRateTypeId = toTypeId(form?.staffingRateTypeId) || toTypeId(settings?.defaultStaffingRateType);

  const bartenderRateType = bartenderRateTypes.find((item) => toTypeId(item?.id) === selectedBartenderRateTypeId) || null;
  const staffingRateType = staffingRateTypes.find((item) => toTypeId(item?.id) === selectedStaffingRateTypeId) || null;

  const baseBartenderRate = toNumber(settings?.bartenderRate, 0);
  const baseServerRate = toNumber(settings?.serverRate, 0);
  const baseChefRate = toNumber(settings?.chefRate, 0);

  const bartenderRateFromType = toNumber(bartenderRateType?.rate, baseBartenderRate);
  const serverRateFromType = toNumber(staffingRateType?.serverRate, baseServerRate);
  const chefRateFromType = toNumber(staffingRateType?.chefRate, baseChefRate);

  const bartenderRateOverride = toOptionalRate(form?.bartenderRateOverride);
  const serverRateOverride = toOptionalRate(form?.serverRateOverride);
  const chefRateOverride = toOptionalRate(form?.chefRateOverride);

  return {
    bartenderRateApplied: bartenderRateOverride ?? bartenderRateFromType,
    serverRateApplied: serverRateOverride ?? serverRateFromType,
    chefRateApplied: chefRateOverride ?? chefRateFromType,
    bartenderRateTypeId: bartenderRateType?.id || "",
    bartenderRateTypeName: String(bartenderRateType?.name || "").trim(),
    staffingRateTypeId: staffingRateType?.id || "",
    staffingRateTypeName: String(staffingRateType?.name || "").trim()
  };
}

export function calculateQuote(form, catalog, settings) {
  const guests = Math.min(400, Number(form.guests || 0));
  const hours = Number(form.hours || 0);
  const bartenders = Math.max(0, Number(form.bartenders || 0));
  const staffingLaborEnabled = settings?.staffingLaborEnabled !== false;
  const selectedPkg = catalog.packages.find((p) => p.id === form.pkg) || catalog.packages[0];
  const taxRegion = resolveTaxRegion(form, settings);
  const seasonProfile = resolveSeasonProfile(form, settings);
  const packageMultiplier = Number(seasonProfile?.packageMultiplier || 1);
  const addonMultiplier = Number(seasonProfile?.addonMultiplier || 1);
  const rentalMultiplier = Number(seasonProfile?.rentalMultiplier || 1);
  const serviceFeePctApplied = resolveServiceFeePct(guests, settings);
  const taxRateApplied = Number(taxRegion?.rate ?? settings?.taxRate ?? 0);
  const milesRT = Number(form.milesRT || 0);
  const thresholdMiles = Number(settings?.deliveryThresholdMiles || 0);
  const standardTravelRate = Number(settings?.perMileRate || 0);
  const longDistanceRate = Number(settings?.longDistancePerMileRate || standardTravelRate);
  const baseMiles = Math.min(milesRT, thresholdMiles);
  const longDistanceMiles = Math.max(0, milesRT - thresholdMiles);
  const laborRates = resolveLaborRates(form, settings);
  const selectedMenuIds = new Set(Array.isArray(form.menuItems) ? form.menuItems : []);
  const menuCatalog = Array.isArray(settings?.menuSections)
    ? settings.menuSections.flatMap((section) => section.items || [])
    : [];

  if (guests <= 0) {
    return {
      selectedPkg,
      guests: 0,
      base: 0,
      addons: 0,
      rentals: 0,
      menu: 0,
      servers: 0,
      chefs: 0,
      bartenders,
      bartenderLabor: 0,
      bartenderRateApplied: laborRates.bartenderRateApplied,
      serverRateApplied: laborRates.serverRateApplied,
      chefRateApplied: laborRates.chefRateApplied,
      bartenderRateTypeId: laborRates.bartenderRateTypeId,
      bartenderRateTypeName: laborRates.bartenderRateTypeName,
      staffingRateTypeId: laborRates.staffingRateTypeId,
      staffingRateTypeName: laborRates.staffingRateTypeName,
      labor: 0,
      travel: 0,
      serviceFee: 0,
      tax: 0,
      total: 0,
      deposit: 0,
      serviceFeePctApplied,
      taxRateApplied,
      taxRegionId: taxRegion.id,
      taxRegionName: taxRegion.name,
      seasonProfileId: seasonProfile.id,
      seasonProfileName: seasonProfile.name,
      staffingLaborEnabled,
      packageMultiplier,
      addonMultiplier,
      rentalMultiplier,
      travelBaseMiles: baseMiles,
      travelLongDistanceMiles: longDistanceMiles
    };
  }

  const base = (selectedPkg?.ppp || 0) * guests * packageMultiplier;

  const addons = catalog.addons
    .filter((a) => form.addons.includes(a.id))
    .reduce((sum, a) => sum + (a.type === "per_person" ? a.price * guests : a.price) * addonMultiplier, 0);

  const rentals = catalog.rentals
    .filter((r) => form.rentals.includes(r.id))
    .reduce(
      (sum, r) => sum + r.price * (typeof r.qtyRule === "function" ? r.qtyRule(guests) : 1) * rentalMultiplier,
      0
    );

  const menu = menuCatalog
    .filter((item) => selectedMenuIds.has(item.id))
    .reduce((sum, item) => {
      const price = Number(item.price || 0);
      if (item.type === "per_person") {
        return sum + price * guests * addonMultiplier;
      }
      return sum + price * addonMultiplier;
    }, 0);

  const styleRules = STAFF_RULES[form.style] || STAFF_RULES.Buffet;
  const computedServers =
    styleRules.serverRatio === Number.POSITIVE_INFINITY
      ? 0
      : Math.max(styleRules.minServers, Math.ceil(guests / styleRules.serverRatio));
  const computedChefs =
    styleRules.chefRatio === Number.POSITIVE_INFINITY ? 0 : Math.ceil(guests / styleRules.chefRatio);
  const servers = staffingLaborEnabled ? computedServers : 0;
  const chefs = staffingLaborEnabled ? computedChefs : 0;
  const bartenderLabor = staffingLaborEnabled ? laborRates.bartenderRateApplied * bartenders * hours : 0;
  const labor = staffingLaborEnabled
    ? laborRates.serverRateApplied * servers * hours + laborRates.chefRateApplied * chefs * hours + bartenderLabor
    : 0;
  const travel = baseMiles * standardTravelRate + longDistanceMiles * longDistanceRate;
  const preFee = base + addons + rentals + menu + labor + travel;
  const serviceFee = preFee * serviceFeePctApplied;
  const tax = (base + addons + rentals + menu + serviceFee) * taxRateApplied;

  const total = preFee + serviceFee + tax;
  const deposit = total * settings.depositPct;

  return {
    selectedPkg,
    guests,
    base,
    addons,
    rentals,
    menu,
    servers,
    chefs,
    bartenders,
    bartenderLabor,
    bartenderRateApplied: laborRates.bartenderRateApplied,
    serverRateApplied: laborRates.serverRateApplied,
    chefRateApplied: laborRates.chefRateApplied,
    bartenderRateTypeId: laborRates.bartenderRateTypeId,
    bartenderRateTypeName: laborRates.bartenderRateTypeName,
    staffingRateTypeId: laborRates.staffingRateTypeId,
    staffingRateTypeName: laborRates.staffingRateTypeName,
    labor,
    travel,
    serviceFee,
    tax,
    total,
    deposit,
    serviceFeePctApplied,
    taxRateApplied,
    taxRegionId: taxRegion.id,
    taxRegionName: taxRegion.name,
    seasonProfileId: seasonProfile.id,
    seasonProfileName: seasonProfile.name,
    staffingLaborEnabled,
    packageMultiplier,
    addonMultiplier,
    rentalMultiplier,
    travelBaseMiles: baseMiles,
    travelLongDistanceMiles: longDistanceMiles
  };
}

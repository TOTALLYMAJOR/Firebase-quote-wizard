import { normalizeCatalog } from "../../../data/mockCatalog";

const rawFixtureCatalog = {
  packages: [
    { id: "basic", name: "Basic", ppp: 10 },
    { id: "premium", name: "Premium", ppp: 20 }
  ],
  addons: [
    { id: "cookie", name: "Cookie Tray", type: "per_person", price: 2 },
    { id: "coffee", name: "Coffee Service", type: "per_event", price: 50 }
  ],
  rentals: [{ id: "chairs", name: "Banquet Chairs", price: 4, qtyPerGuests: 10 }],
  settings: {
    perMileRate: 1,
    longDistancePerMileRate: 2,
    deliveryThresholdMiles: 20,
    bartenderRate: 30,
    serverRate: 20,
    chefRate: 40,
    serviceFeePct: 0.1,
    serviceFeeTiers: [{ id: "flat", minGuests: 0, maxGuests: 9999, pct: 0.1 }],
    taxRate: 0.05,
    taxRegions: [
      { id: "local", name: "Local", rate: 0.1 },
      { id: "reduced", name: "Reduced", rate: 0.02 },
      { id: "exempt", name: "Tax Exempt", rate: 0 }
    ],
    defaultTaxRegion: "local",
    depositPct: 0.25,
    menuSections: [
      {
        id: "main",
        name: "Main",
        items: [
          { id: "salad", name: "Salad Bar", price: 3, type: "per_person" },
          { id: "setup", name: "Setup Fee", price: 40, type: "per_event" }
        ]
      }
    ],
    seasonalProfiles: [
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
        id: "rental_peak",
        name: "Rental Peak",
        startMonth: 1,
        startDay: 1,
        endMonth: 12,
        endDay: 31,
        packageMultiplier: 1,
        addonMultiplier: 1,
        rentalMultiplier: 1.5
      }
    ],
    defaultSeasonProfile: "standard"
  }
};

const fixtureCatalog = normalizeCatalog(rawFixtureCatalog);

export const quoteCalculationCatalog = fixtureCatalog;
export const quoteCalculationSettings = fixtureCatalog.settings;

export const baseFixtureForm = {
  date: "2026-03-10",
  guests: 0,
  hours: 0,
  style: "Buffet",
  bartenders: 0,
  pkg: "basic",
  addons: [],
  rentals: [],
  menuItems: [],
  milesRT: 0,
  payMethod: "card",
  taxRegion: "local",
  seasonProfileId: "standard"
};

export const quoteCalculationFixtures = [
  {
    id: "package-pricing",
    form: {
      ...baseFixtureForm,
      guests: 50,
      style: "Drop-off",
      pkg: "premium"
    },
    expected: {
      selectedPkgId: "premium",
      base: 1000
    }
  },
  {
    id: "addon-pricing",
    form: {
      ...baseFixtureForm,
      guests: 30,
      style: "Drop-off",
      addons: ["cookie", "coffee"]
    },
    expected: {
      addons: 110
    }
  },
  {
    id: "rental-pricing-with-quantity-and-multiplier",
    form: {
      ...baseFixtureForm,
      guests: 26,
      style: "Drop-off",
      rentals: ["chairs"],
      seasonProfileId: "rental_peak"
    },
    expected: {
      rentalMultiplier: 1.5,
      rentals: 18
    }
  },
  {
    id: "labor-pricing",
    form: {
      ...baseFixtureForm,
      guests: 120,
      hours: 5,
      style: "Plated",
      bartenders: 2
    },
    expected: {
      servers: 10,
      chefs: 3,
      bartenderLabor: 300,
      labor: 1900
    }
  },
  {
    id: "mileage-pricing",
    form: {
      ...baseFixtureForm,
      guests: 20,
      style: "Drop-off",
      milesRT: 35,
      taxRegion: "exempt"
    },
    expected: {
      travelBaseMiles: 20,
      travelLongDistanceMiles: 15,
      travel: 50
    }
  },
  {
    id: "tax-pricing",
    form: {
      ...baseFixtureForm,
      guests: 10,
      hours: 2,
      style: "Buffet",
      addons: ["cookie"],
      milesRT: 10,
      taxRegion: "reduced"
    },
    expected: {
      taxRateApplied: 0.02,
      tax: 2.82
    }
  },
  {
    id: "deposit-pricing",
    form: {
      ...baseFixtureForm,
      guests: 40,
      style: "Drop-off"
    },
    expected: {
      total: 484,
      deposit: 121
    }
  }
];

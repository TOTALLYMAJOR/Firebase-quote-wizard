import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("../firebase", () => ({
  db: null,
  firebaseReady: false
}));

import {
  deleteQuote,
  getQuoteHistory,
  reopenQuote,
  updateQuote,
  updateQuoteStatus
} from "../quoteStore";

const LOCAL_QUOTES_KEY = "quoteWizard.quotes";
const LOCAL_QUOTE_HISTORY_KEY = "quoteWizard.quoteHistory";

function createStorageMock() {
  const store = {};
  return {
    getItem(key) {
      return Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      Object.keys(store).forEach((key) => delete store[key]);
    }
  };
}

function makeQuote(overrides = {}) {
  const nowISO = "2026-03-10T12:00:00.000Z";
  const base = {
    id: "quote-1",
    quoteNumber: "Q-260310-1200-11111",
    status: "accepted",
    createdAtISO: nowISO,
    updatedAtISO: nowISO,
    expiresAtISO: "2026-04-09T12:00:00.000Z",
    deletedAtISO: "",
    eventTypeId: "wedding",
    customerNameKey: "client one",
    customer: {
      name: "Client One",
      email: "client-one@example.com",
      phone: "205-555-0101"
    },
    event: {
      name: "Spring Banquet",
      date: "2026-04-20",
      time: "18:00",
      venue: "Pine Hall",
      guests: 120,
      hours: 4
    },
    selection: {
      menuItems: [],
      menuItemNames: [],
      menuItemDetails: []
    },
    totals: {
      total: 8400,
      deposit: 2520
    },
    payment: {
      depositLink: "",
      depositStatus: "unpaid",
      depositConfirmedAtISO: ""
    },
    booking: {
      bookedAtISO: "",
      bookedByEmail: "",
      contractNumber: "",
      contractConvertedAtISO: "",
      contractConvertedByEmail: "",
      confirmationStatus: "pending",
      confirmationSentAtISO: "",
      confirmedAtISO: "",
      confirmationUpdatedByEmail: "",
      availabilityCheckedAtISO: "",
      availabilitySummary: {}
    },
    lifecycle: {
      acceptedAtISO: nowISO
    }
  };

  return {
    ...base,
    ...overrides,
    customer: {
      ...base.customer,
      ...(overrides.customer || {})
    },
    event: {
      ...base.event,
      ...(overrides.event || {})
    },
    selection: {
      ...base.selection,
      ...(overrides.selection || {})
    },
    totals: {
      ...base.totals,
      ...(overrides.totals || {})
    },
    payment: {
      ...base.payment,
      ...(overrides.payment || {})
    },
    booking: {
      ...base.booking,
      ...(overrides.booking || {})
    },
    lifecycle: {
      ...base.lifecycle,
      ...(overrides.lifecycle || {})
    }
  };
}

function seedQuotes(quotes) {
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(quotes));
}

describe("quoteStore versioning and soft delete", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("soft deletes and reopens a quote while recording versions", async () => {
    seedQuotes([makeQuote({ id: "q1" })]);

    await deleteQuote("q1");
    let history = JSON.parse(localStorage.getItem(LOCAL_QUOTE_HISTORY_KEY) || "[]");
    expect(history.length).toBe(1);
    expect(history[0].quoteId).toBe("q1");
    expect(history[0].snapshot.status).toBe("accepted");

    let quotes = await getQuoteHistory();
    let updated = quotes.quotes.find((quote) => quote.id === "q1");
    expect(updated.status).toBe("deleted");
    expect(updated.deletedAtISO).not.toBe("");

    await reopenQuote("q1");
    history = JSON.parse(localStorage.getItem(LOCAL_QUOTE_HISTORY_KEY) || "[]");
    expect(history.length).toBe(2);
    expect(history[0].snapshot.status).toBe("deleted");

    quotes = await getQuoteHistory();
    updated = quotes.quotes.find((quote) => quote.id === "q1");
    expect(updated.status).toBe("draft");
    expect(updated.deletedAtISO).toBe("");
  });

  test("captures a version before status updates", async () => {
    seedQuotes([makeQuote({ id: "q2", status: "draft", lifecycle: { draftAtISO: "2026-03-10T12:00:00.000Z" } })]);

    await updateQuoteStatus("q2", "sent");

    const history = JSON.parse(localStorage.getItem(LOCAL_QUOTE_HISTORY_KEY) || "[]");
    expect(history.length).toBe(1);
    expect(history[0].snapshot.status).toBe("draft");

    const quotes = await getQuoteHistory();
    const updated = quotes.quotes.find((quote) => quote.id === "q2");
    expect(updated.status).toBe("sent");
  });

  test("updates an existing quote with versioning and locked labor-rate snapshot", async () => {
    seedQuotes([
      makeQuote({
        id: "q3",
        status: "sent",
        selection: {
          menuItems: ["smoked-ribs"],
          menuItemNames: ["Smoked Ribs"],
          menuItemDetails: [{ id: "smoked-ribs", name: "Smoked Ribs", price: 12 }]
        }
      })
    ]);

    await updateQuote({
      quoteId: "q3",
      form: {
        name: "Client One",
        email: "client-one@example.com",
        phone: "205-555-0101",
        clientOrg: "Client Org",
        eventName: "Spring Banquet",
        date: "2026-04-20",
        time: "18:00",
        venue: "Pine Hall",
        venueAddress: "123 Pine Ave",
        guests: 120,
        hours: 4,
        bartenders: 2,
        style: "Plated",
        pkg: "classic",
        addons: [],
        rentals: [],
        menuItems: ["smoked-ribs"],
        milesRT: 16,
        payMethod: "card",
        eventTemplateId: "custom",
        eventTypeId: "wedding",
        taxRegion: "local",
        seasonProfileId: "standard",
        includeDisposables: true,
        depositLink: "",
        bartenderRateTypeId: "premium",
        staffingRateTypeId: "senior",
        bartenderRateOverride: 42,
        serverRateOverride: 31,
        chefRateOverride: 53
      },
      totals: {
        selectedPkg: { id: "classic", name: "Classic" },
        base: 2160,
        addons: 0,
        rentals: 0,
        menu: 240,
        labor: 1800,
        bartenderLabor: 336,
        bartenderRateApplied: 42,
        serverRateApplied: 31,
        chefRateApplied: 53,
        bartenderRateTypeId: "premium",
        bartenderRateTypeName: "Premium Bartender",
        staffingRateTypeId: "senior",
        staffingRateTypeName: "Senior Staffing",
        travel: 12,
        serviceFee: 631.2,
        tax: 303.12,
        total: 5146.32,
        deposit: 1543.896,
        serviceFeePctApplied: 0.15,
        taxRateApplied: 0.06,
        taxRegionId: "local",
        taxRegionName: "Local",
        seasonProfileId: "standard",
        seasonProfileName: "Standard",
        packageMultiplier: 1,
        addonMultiplier: 1,
        rentalMultiplier: 1
      },
      catalogSource: "local",
      settings: {
        quoteValidityDays: 30,
        defaultTaxRegion: "local",
        defaultSeasonProfile: "auto"
      }
    });

    const history = JSON.parse(localStorage.getItem(LOCAL_QUOTE_HISTORY_KEY) || "[]");
    expect(history.length).toBe(1);
    expect(history[0].quoteId).toBe("q3");
    expect(history[0].snapshot.status).toBe("sent");

    const quotes = await getQuoteHistory();
    const updated = quotes.quotes.find((quote) => quote.id === "q3");
    expect(updated.status).toBe("draft");
    expect(updated.selection.laborRateSnapshot.bartenderRateApplied).toBe(42);
    expect(updated.selection.laborRateSnapshot.serverRateApplied).toBe(31);
    expect(updated.selection.laborRateSnapshot.chefRateApplied).toBe(53);
    expect(updated.totals.bartenderRateApplied).toBe(42);
    expect(updated.totals.serverRateApplied).toBe(31);
    expect(updated.totals.chefRateApplied).toBe(53);
  });
});

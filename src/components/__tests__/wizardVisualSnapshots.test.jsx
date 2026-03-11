import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StepEvent, StepMenu, StepReview } from "../WizardSteps";
import { calculateQuote } from "../../lib/quoteCalculator";

const snapshotCatalog = {
  packages: [
    { id: "classic", name: "Classic", ppp: 18 },
    { id: "premium", name: "Premium", ppp: 24 }
  ],
  addons: [
    { id: "dessert", name: "Dessert", type: "per_person", price: 4 },
    { id: "coffee", name: "Coffee Station", type: "per_event", price: 95 }
  ],
  rentals: [
    { id: "linens", name: "Linens", price: 9, qtyPerGuests: 8 }
  ],
  settings: {
    quotePreparedBy: "Chef Toni North",
    quoteValidityDays: 30,
    acceptanceEmail: "events@tonycatering.com",
    disposablesNote: "All disposables are included in this quote.",
    depositNotice: "30% deposit is required to lock in your date.",
    businessPhone: "(205) 555-0135",
    businessEmail: "events@tonycatering.com",
    businessAddress: "6230 Eagle Ridge Cir, Pinson, AL 35126",
    perMileRate: 0.7,
    longDistancePerMileRate: 1.1,
    deliveryThresholdMiles: 30,
    serverRate: 22,
    chefRate: 28,
    bartenderRate: 30,
    serviceFeePct: 0.2,
    serviceFeeTiers: [
      { id: "small", minGuests: 0, maxGuests: 99, pct: 0.2 },
      { id: "large", minGuests: 100, maxGuests: 9999, pct: 0.18 }
    ],
    taxRate: 0.1,
    taxRegions: [{ id: "local", name: "Local", rate: 0.1 }],
    defaultTaxRegion: "local",
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
      }
    ],
    eventTemplates: [
      {
        id: "wedding",
        name: "Wedding",
        style: "Plated",
        hours: 5,
        pkg: "premium",
        addons: ["dessert"],
        rentals: ["linens"],
        milesRT: 20,
        payMethod: "card",
        taxRegion: "local",
        seasonProfileId: "standard"
      }
    ],
    menuSections: [
      {
        id: "mains",
        name: "Mains",
        items: [
          { id: "smoked-ribs", name: "Smoked Ribs", type: "per_person", price: 6 },
          { id: "herb-chicken", name: "Herb Chicken", type: "per_person", price: 5 }
        ]
      },
      {
        id: "sides",
        name: "Sides",
        items: [
          { id: "garlic-mashed", name: "Garlic Mashed Potatoes", type: "per_event", price: 110 }
        ]
      }
    ],
    depositPct: 0.3
  }
};

const snapshotForm = {
  date: "2026-06-14",
  time: "18:30",
  hours: 5,
  bartenders: 2,
  guests: 120,
  venue: "Birmingham Civic Hall",
  venueAddress: "123 Event Way, Birmingham, AL",
  eventName: "Summer Client Gala",
  clientOrg: "Civic Foundation",
  style: "Plated",
  name: "Jordan Lee",
  phone: "205-555-0162",
  email: "jordan@example.com",
  pkg: "premium",
  addons: ["dessert", "coffee"],
  rentals: ["linens"],
  menuItems: ["smoked-ribs", "garlic-mashed"],
  eventTemplateId: "wedding",
  taxRegion: "local",
  seasonProfileId: "standard",
  milesRT: 24,
  includeDisposables: true,
  depositLink: "",
  payMethod: "card"
};

function normalizeMarkup(markup) {
  return markup
    .replace(/\s+/g, " ")
    .replace(/> </g, "><")
    .replace(/Quote Date:<\/strong> [^<]+/g, "Quote Date:</strong> <QUOTE_DATE>")
    .replace(/Time of Event:<\/strong> [^<]+/g, "Time of Event:</strong> <EVENT_TIME>")
    .replace(/Date of Event:<\/strong> [^<]+/g, "Date of Event:</strong> <EVENT_DATE>")
    .trim();
}

describe("wizard visual snapshots", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-11T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("step event layout snapshot", () => {
    const markup = renderToStaticMarkup(
      <StepEvent
        form={snapshotForm}
        setForm={() => {}}
        styles={["Buffet", "Plated", "Stations"]}
        settings={snapshotCatalog.settings}
        onTemplateChange={() => {}}
      />
    );
    expect(normalizeMarkup(markup)).toMatchInlineSnapshot(`"<div class="grid two-col"><label class="field"><span>Event template</span><select><option value="custom">Custom</option><option value="wedding" selected="">Wedding</option></select></label><label class="field"><span>Event date</span><input type="date" value="2026-06-14"/></label><label class="field"><span>Start time</span><input type="time" value="18:30"/></label><label class="field"><span>Event hours</span><input type="number" min="1" max="12" value="5"/></label><label class="field"><span>Bartenders</span><input type="number" min="0" max="10" value="2"/></label><label class="field"><span>Guests (max 400)</span><input type="number" min="1" max="400" value="120"/></label><label class="field"><span>Event name</span><input type="text" value="Summer Client Gala"/></label><label class="field"><span>Venue</span><input type="text" value="Birmingham Civic Hall"/></label><label class="field"><span>Venue address</span><input type="text" value="123 Event Way, Birmingham, AL"/></label><label class="field"><span>Client / Organization</span><input type="text" value="Civic Foundation"/></label><label class="field"><span>Service style</span><select><option value="Buffet">Buffet</option><option value="Plated" selected="">Plated</option><option value="Stations">Stations</option></select></label><label class="field"><span>Tax region</span><select><option value="local" selected="">Local (10%)</option></select></label><label class="field"><span>Season profile</span><select><option value="auto">Auto detect</option><option value="standard" selected="">Standard</option></select></label><label class="field"><span>Show disposables on quote</span><select><option value="yes" selected="">Yes</option><option value="no">No</option></select></label><label class="field"><span>Your name</span><input type="text" value="Jordan Lee"/></label><label class="field"><span>Phone</span><input type="tel" value="205-555-0162"/></label><label class="field"><span>Email</span><input type="email" value="jordan@example.com"/></label></div>"`);
  });

  test("step menu layout snapshot", () => {
    const markup = renderToStaticMarkup(
      <StepMenu
        form={snapshotForm}
        setForm={() => {}}
        catalog={snapshotCatalog}
        recommendations={[
          {
            key: "upgrade-deluxe",
            kind: "package",
            id: "premium",
            label: "Upgrade to Premium",
            reason: "Best fit for plated service with 100+ guests.",
            impact: "+$6 per guest"
          }
        ]}
        onApplyRecommendation={() => {}}
      />
    );
    expect(normalizeMarkup(markup)).toMatchInlineSnapshot(`"<div class="grid two-col"><label class="field"><span>Package tier</span><select><option value="classic">Classic - $18.00/person</option><option value="premium" selected="">Premium - $24.00/person</option></select></label><label class="field"><span>Travel (round trip miles)</span><input type="number" min="0" value="24"/></label><div><h4>Add-ons</h4><div class="checklist"><label class="checkrow"><input type="checkbox" checked=""/><span>Dessert</span><small>$4.00/person</small></label><label class="checkrow"><input type="checkbox" checked=""/><span>Coffee Station</span><small>$95.00</small></label></div></div><div><h4>Rentals</h4><div class="checklist"><label class="checkrow"><input type="checkbox" checked=""/><span>Linens</span><small>$9.00 each</small></label></div></div><div class="recommendation-panel"><h4>Recommended Upgrades</h4><div class="recommendation-list"><article class="recommendation-card"><div><strong>Upgrade to Premium</strong><p>Best fit for plated service with 100+ guests.</p><small>+$6 per guest</small></div><button type="button" class="ghost compact">Apply</button></article></div></div><div class="menu-library"><h4>Customized Cuisine Menu</h4><p class="source-note">Select menu items to include in this quote proposal.</p><div class="menu-grid"><section class="menu-category"><div class="menu-category-head"><strong>Mains</strong><small>1/2</small></div><div class="checklist"><label class="checkrow"><input type="checkbox" checked=""/><span>Smoked Ribs</span><small>$6.00/person</small></label><label class="checkrow"><input type="checkbox"/><span>Herb Chicken</span><small>$5.00/person</small></label></div></section><section class="menu-category"><div class="menu-category-head"><strong>Sides</strong><small>1/1</small></div><div class="checklist"><label class="checkrow"><input type="checkbox" checked=""/><span>Garlic Mashed Potatoes</span><small>$110.00</small></label></div></section></div></div></div>"`);
  });

  test("step review proposal sheet snapshot", () => {
    const totals = calculateQuote(snapshotForm, snapshotCatalog, snapshotCatalog.settings);
    const markup = renderToStaticMarkup(
      <StepReview
        form={snapshotForm}
        totals={totals}
        settings={snapshotCatalog.settings}
      />
    );
    expect(normalizeMarkup(markup)).toMatchInlineSnapshot(`"<div class="review"><article class="quote-sheet"><h2>Catering Quote</h2><div class="quote-sheet-meta"><p><strong>Quote Date:</strong> <QUOTE_DATE></p><p class="quote-sheet-meta-wide"><strong>Responsible Party / Client:</strong> Jordan Lee / Civic Foundation</p><p><strong>Phone #:</strong> 205-555-0162</p><p><strong>Email Address:</strong> jordan@example.com</p><p><strong># of Guests:</strong> 120</p><p><strong>Time of Event:</strong> <EVENT_TIME></p><p><strong>Name of Event:</strong> Summer Client Gala</p><p><strong>Date of Event:</strong> <EVENT_DATE></p><p class="quote-sheet-meta-wide"><strong>Event Location:</strong> Birmingham Civic Hall</p><p class="quote-sheet-meta-wide"><strong>Venue Address:</strong> 123 Event Way, Birmingham, AL</p></div><section class="quote-sheet-menu"><h3>Menu</h3><p>Smoked Ribs, Garlic Mashed Potatoes</p></section><section class="quote-sheet-charges"><div class="quote-charge"><span>Per Person: $24.00 x (120)</span><strong>$2880.00</strong></div><div class="quote-charge"><span>Tax: (10%)</span><strong>$539.75</strong></div><div class="quote-charge"><span>Staffing</span><strong>$1520.00</strong></div><div class="quote-charge"><span>Travel Fee</span><strong>$16.80</strong></div><div class="quote-charge"><span>Bartender</span><strong>$300.00</strong></div><div class="quote-charge"><span>Gratuity</span><strong>$1103.54</strong></div><div class="quote-charge quote-charge-wide"><span>Add-ons/Rentals/Menu</span><strong>$1414.00</strong></div></section><p class="quote-center-note"><strong>All disposables are included in this quote.</strong></p><p class="quote-total-line">TOTAL: <strong>$7774.10</strong></p><div class="quote-sheet-bottom"><p><strong>Quote prepared by:</strong> Chef Toni North</p><p><strong>Quote is valid for 30 days.</strong></p></div><p class="quote-acceptance">To accept quote, please sign and return to events@tonycatering.com</p><p class="quote-deposit-tag"><strong>30% deposit is required to lock in your date.</strong></p><p class="quote-signoff">Gratuity is never expected but is always appreciated!</p><p class="quote-contact-strip">6230 Eagle Ridge Cir, Pinson, AL 35126 • (205) 555-0135 • events@tonycatering.com</p></article><div class="summary-total"><p>Deposit (30%): <strong>$2332.23</strong></p></div></div>"`);
  });
});

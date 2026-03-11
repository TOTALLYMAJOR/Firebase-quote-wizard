import { describe, expect, test } from "vitest";
import { calculateQuote } from "../quoteCalculator";
import {
  quoteCalculationCatalog,
  quoteCalculationFixtures,
  quoteCalculationSettings
} from "./fixtures/quoteCalculationFixtures";

describe("calculateQuote fixtures", () => {
  test.each(quoteCalculationFixtures)("covers $id", ({ form, expected }) => {
    const totals = calculateQuote(form, quoteCalculationCatalog, quoteCalculationSettings);

    for (const [key, value] of Object.entries(expected)) {
      if (key === "selectedPkgId") {
        expect(totals.selectedPkg?.id).toBe(value);
        continue;
      }

      if (typeof value === "number") {
        expect(totals[key]).toBeCloseTo(value, 6);
        continue;
      }

      expect(totals[key]).toEqual(value);
    }
  });

  test("keeps deposit in sync with configured depositPct", () => {
    const depositFixture = quoteCalculationFixtures.find((fixture) => fixture.id === "deposit-pricing");
    const totals = calculateQuote(depositFixture.form, quoteCalculationCatalog, quoteCalculationSettings);

    expect(totals.deposit).toBeCloseTo(totals.total * quoteCalculationSettings.depositPct, 6);
  });

  test("supports disabling staffing labor automation", () => {
    const laborFixture = quoteCalculationFixtures.find((fixture) => fixture.id === "labor-pricing");
    const enabledTotals = calculateQuote(laborFixture.form, quoteCalculationCatalog, quoteCalculationSettings);
    const disabledTotals = calculateQuote(laborFixture.form, quoteCalculationCatalog, {
      ...quoteCalculationSettings,
      staffingLaborEnabled: false
    });

    expect(enabledTotals.labor).toBeGreaterThan(0);
    expect(disabledTotals.staffingLaborEnabled).toBe(false);
    expect(disabledTotals.servers).toBe(0);
    expect(disabledTotals.chefs).toBe(0);
    expect(disabledTotals.bartenderLabor).toBe(0);
    expect(disabledTotals.labor).toBe(0);
    expect(disabledTotals.total).toBeLessThan(enabledTotals.total);
  });
});

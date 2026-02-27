import { useEffect, useMemo, useRef, useState } from "react";
import AdminCatalogModal from "./components/AdminCatalogModal";
import LiveBreakdown from "./components/LiveBreakdown";
import QuoteCompareModal from "./components/QuoteCompareModal";
import QuoteHistoryModal from "./components/QuoteHistoryModal";
import ReportingDashboardModal from "./components/ReportingDashboardModal";
import { StepEvent, StepMenu, StepReview } from "./components/WizardSteps";
import { STAFF_RULES } from "./data/mockCatalog";
import { useCatalogData } from "./hooks/useCatalogData";
import { calculateQuote, currency } from "./lib/quoteCalculator";
import { buildUpsellRecommendations } from "./lib/recommendations";
import { submitQuote } from "./lib/quoteStore";

const STEP_LABELS = ["Event", "Menu & Services", "Review"];

export default function App() {
  const catalog = useCatalogData();
  const wizardRef = useRef(null);
  const [step, setStep] = useState(1);
  const [adminOpen, setAdminOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [submitState, setSubmitState] = useState({ saving: false, message: "" });

  const [form, setForm] = useState({
    date: "",
    time: "",
    hours: 0,
    guests: 0,
    venue: "",
    style: "Buffet",
    name: "",
    email: "",
    pkg: "classic",
    addons: [],
    rentals: [],
    menuItems: [],
    eventTemplateId: "custom",
    taxRegion: "",
    seasonProfileId: "auto",
    milesRT: 0,
    depositLink: "",
    payMethod: "card"
  });

  const totals = useMemo(
    () => calculateQuote(form, catalog, catalog.settings),
    [form, catalog]
  );

  const recommendations = useMemo(
    () => buildUpsellRecommendations({ form, catalog, totals }),
    [form, catalog, totals]
  );

  useEffect(() => {
    if (catalog.loading) return;
    setForm((prev) => {
      let changed = false;
      const next = { ...prev };
      const defaultTaxRegion = catalog.settings?.defaultTaxRegion || catalog.settings?.taxRegions?.[0]?.id || "";
      const defaultSeasonProfile = catalog.settings?.defaultSeasonProfile || "auto";

      if (!next.taxRegion && defaultTaxRegion) {
        next.taxRegion = defaultTaxRegion;
        changed = true;
      }
      if (!next.seasonProfileId) {
        next.seasonProfileId = defaultSeasonProfile;
        changed = true;
      }
      if (!next.eventTemplateId) {
        next.eventTemplateId = "custom";
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [catalog.loading, catalog.settings]);

  const applyEventTemplate = (templateId) => {
    if (templateId === "custom") {
      setForm((prev) => ({ ...prev, eventTemplateId: "custom" }));
      return;
    }

    const templates = Array.isArray(catalog.settings?.eventTemplates) ? catalog.settings.eventTemplates : [];
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setForm((prev) => ({ ...prev, eventTemplateId: "custom" }));
      return;
    }

    const addonIds = new Set(catalog.addons.map((item) => item.id));
    const rentalIds = new Set(catalog.rentals.map((item) => item.id));
    const menuItemIds = new Set(
      (catalog.settings?.menuSections || []).flatMap((section) => (section.items || []).map((item) => item.id))
    );

    setForm((prev) => ({
      ...prev,
      eventTemplateId: template.id,
      style: template.style || prev.style,
      hours: Number(template.hours || prev.hours || 0),
      pkg: template.pkg || prev.pkg,
      addons: (template.addons || []).filter((id) => addonIds.has(id)),
      rentals: (template.rentals || []).filter((id) => rentalIds.has(id)),
      menuItems: (template.menuItems || []).filter((id) => menuItemIds.has(id)),
      milesRT: Number(template.milesRT || prev.milesRT || 0),
      payMethod: template.payMethod || prev.payMethod,
      taxRegion: template.taxRegion || prev.taxRegion || catalog.settings.defaultTaxRegion || "",
      seasonProfileId: template.seasonProfileId || prev.seasonProfileId || "auto"
    }));
  };

  const applyRecommendation = (item) => {
    if (!item) return;

    setForm((prev) => {
      if (item.kind === "package") {
        return { ...prev, eventTemplateId: "custom", pkg: item.id };
      }
      if (item.kind === "addon") {
        const next = new Set(prev.addons || []);
        next.add(item.id);
        return { ...prev, eventTemplateId: "custom", addons: [...next] };
      }
      if (item.kind === "rental") {
        const next = new Set(prev.rentals || []);
        next.add(item.id);
        return { ...prev, eventTemplateId: "custom", rentals: [...next] };
      }
      return prev;
    });
  };

  const handleSubmitQuote = async () => {
    if (totals.guests <= 0) {
      setSubmitState({ saving: false, message: "Add guest count before saving a quote." });
      return;
    }

    setSubmitState({ saving: true, message: "" });
    try {
      const result = await submitQuote({
        form,
        totals,
        catalogSource: catalog.source,
        settings: catalog.settings
      });
      setSubmitState({
        saving: false,
        message: `Quote ${result.quoteNumber} saved to ${result.storage}.`
      });
      setHistoryOpen(true);
    } catch (err) {
      setSubmitState({ saving: false, message: err?.message || "Failed to save quote." });
    }
  };

  const handleGetInstantQuote = () => {
    setStep(1);
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container nav">
          <div className="brand-lockup">
            <img className="brand-logo" src="/brand/logo.png" alt="Tasteful Touch logo" />
            <div className="brand-copy">
              <div className="brand">Tasteful Touch Catering</div>
              <p>Chef Toni and Grill Master Irvin</p>
            </div>
          </div>
          <div className="brand-crew">
            <figure className="crew-chip">
              <img src="/brand/chef-toni.png" alt="Chef Toni" />
              <figcaption>Chef Toni</figcaption>
            </figure>
            <figure className="crew-chip">
              <img src="/brand/grillmaster-irvin.png" alt="Grill Master Irvin" />
              <figcaption>Grill Master Irvin</figcaption>
            </figure>
          </div>
          <div className="right-actions header-actions">
            <button className="ghost" onClick={() => setDashboardOpen(true)}>Dashboard</button>
            <button className="ghost" onClick={() => setHistoryOpen(true)}>Quote History</button>
            <button className="ghost" onClick={() => setAdminOpen(true)}>Admin Catalog</button>
            <button className="cta" onClick={handleGetInstantQuote}>Get Instant Quote</button>
          </div>
        </div>
      </header>

      <section className="hero container">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">Premium Event Catering Workbench</p>
            <h1>Signature flavor. Configurable quotes.</h1>
            <p>
              A polished sales cockpit for weddings, corporate events, and celebrations up to 400 guests.
              Build scenarios, apply smart upsells, and send better proposals faster.
            </p>
            <div className="hero-pills">
              <span>Config-driven pricing</span>
              <span>Scenario compare</span>
              <span>Proposal exports</span>
            </div>
          </div>
          <aside className="hero-card">
            <h3>Live Quote Snapshot</h3>
            <dl>
              <div><dt>Current Total</dt><dd>{currency(totals.total)}</dd></div>
              <div><dt>Deposit</dt><dd>{currency(totals.deposit)}</dd></div>
              <div><dt>Tax Region</dt><dd>{totals.taxRegionName}</dd></div>
              <div><dt>Season</dt><dd>{totals.seasonProfileName}</dd></div>
            </dl>
          </aside>
        </div>
      </section>

      <main className="container wizard-grid" ref={wizardRef}>
        <section className="panel wizard-panel">
          <ol className="stepper">
            {STEP_LABELS.map((label, idx) => {
              const num = idx + 1;
              return (
                <li key={label} className={step >= num ? "active" : ""}>
                  <span>{num}</span>
                  <em>{label}</em>
                </li>
              );
            })}
          </ol>

          <div className="step-stage" key={step}>
            {catalog.loading && <p className="source-note">Loading catalog...</p>}
            {!catalog.loading && step === 1 && (
              <StepEvent
                form={form}
                setForm={setForm}
                styles={Object.keys(STAFF_RULES)}
                settings={catalog.settings}
                onTemplateChange={applyEventTemplate}
              />
            )}
            {!catalog.loading && step === 2 && (
              <StepMenu
                form={form}
                setForm={setForm}
                catalog={catalog}
                recommendations={recommendations}
                onApplyRecommendation={applyRecommendation}
              />
            )}
            {!catalog.loading && step === 3 && <StepReview form={form} totals={totals} settings={catalog.settings} />}
            {!catalog.loading && step === 3 && (
              <label className="field deposit-link-field">
                <span>Deposit payment link (optional)</span>
                <input
                  type="url"
                  placeholder="https://payment-link.example.com"
                  value={form.depositLink}
                  onChange={(e) => setForm((f) => ({ ...f, depositLink: e.target.value }))}
                />
              </label>
            )}
          </div>

          <div className="wizard-actions">
            <div className="right-actions">
              <button className="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || catalog.loading}>Back</button>
              <button className="ghost" onClick={() => setCompareOpen(true)} disabled={catalog.loading || step < 2}>Compare Scenario</button>
            </div>
            <div className="right-actions">
              {step < 3 ? (
                <button className="cta" onClick={() => setStep((s) => Math.min(3, s + 1))} disabled={catalog.loading}>Next</button>
              ) : (
                <>
                  <select value={form.payMethod} onChange={(e) => setForm((f) => ({ ...f, payMethod: e.target.value }))}>
                    <option value="card">Pay by Card (+3%)</option>
                    <option value="ach">Pay by ACH/Check</option>
                  </select>
                  <button
                    className="cta"
                    onClick={handleSubmitQuote}
                    disabled={submitState.saving || catalog.loading || totals.guests <= 0}
                  >
                    {submitState.saving ? "Saving..." : "Accept & Continue"}
                  </button>
                </>
              )}
            </div>
          </div>
          <p className="source-note">Catalog source: {catalog.source}</p>
          <p className="source-note">Quote validity: {Math.max(1, Number(catalog.settings?.quoteValidityDays || 30))} days</p>
          {catalog.error && <p className="error-note">{catalog.error}</p>}
          {submitState.message && <p className="source-note">{submitState.message}</p>}
        </section>

        <LiveBreakdown form={form} totals={totals} settings={catalog.settings} catalog={catalog} />
      </main>

      <AdminCatalogModal
        open={adminOpen}
        catalog={catalog}
        onClose={() => setAdminOpen(false)}
        onSave={catalog.saveCatalog}
        saving={catalog.saving}
      />

      <QuoteHistoryModal
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
      />

      <QuoteCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        form={form}
        setForm={setForm}
        catalog={catalog}
        settings={catalog.settings}
        styles={Object.keys(STAFF_RULES)}
        primaryTotals={totals}
      />

      <ReportingDashboardModal
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />
    </div>
  );
}

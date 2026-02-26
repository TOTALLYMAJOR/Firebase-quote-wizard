import { useMemo, useRef, useState } from "react";
import AdminCatalogModal from "./components/AdminCatalogModal";
import LiveBreakdown from "./components/LiveBreakdown";
import QuoteHistoryModal from "./components/QuoteHistoryModal";
import ReportingDashboardModal from "./components/ReportingDashboardModal";
import { StepEvent, StepMenu, StepReview } from "./components/WizardSteps";
import { STAFF_RULES } from "./data/mockCatalog";
import { useCatalogData } from "./hooks/useCatalogData";
import { calculateQuote } from "./lib/quoteCalculator";
import { submitQuote } from "./lib/quoteStore";

const BRAND = "#b67a3d";
const STEP_LABELS = ["Event", "Menu & Services", "Review"];

export default function App() {
  const catalog = useCatalogData();
  const wizardRef = useRef(null);
  const [step, setStep] = useState(1);
  const [adminOpen, setAdminOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
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
    milesRT: 0,
    depositLink: "",
    payMethod: "card"
  });

  const totals = useMemo(
    () => calculateQuote(form, catalog, catalog.settings),
    [form, catalog]
  );

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
    <div className="app-shell" style={{ "--brand": BRAND }}>
      <header>
        <div className="container nav">
          <div className="brand">Tony Catering Quote Wizard</div>
          <div className="right-actions">
            <button className="ghost" onClick={() => setDashboardOpen(true)}>Dashboard</button>
            <button className="ghost" onClick={() => setHistoryOpen(true)}>Quote History</button>
            <button className="ghost" onClick={() => setAdminOpen(true)}>Admin Catalog</button>
            <button className="cta" onClick={handleGetInstantQuote}>Get Instant Quote</button>
          </div>
        </div>
      </header>

      <section className="hero container">
        <h1>Elevated cuisine. Effortless planning.</h1>
        <p>Transparent catering pricing for events up to 400 guests.</p>
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

          {catalog.loading && <p className="source-note">Loading catalog...</p>}
          {!catalog.loading && step === 1 && <StepEvent form={form} setForm={setForm} styles={Object.keys(STAFF_RULES)} />}
          {!catalog.loading && step === 2 && <StepMenu form={form} setForm={setForm} catalog={catalog} />}
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

          <div className="wizard-actions">
            <button className="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1 || catalog.loading}>Back</button>
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

      <ReportingDashboardModal
        open={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />
    </div>
  );
}

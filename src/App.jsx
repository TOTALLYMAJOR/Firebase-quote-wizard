import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import AuthGate from "./components/AuthGate";
import CustomerPortalView from "./components/CustomerPortalView";
import LiveBreakdown from "./components/LiveBreakdown";
import { StepEvent, StepMenu, StepReview } from "./components/WizardSteps";
import { STAFF_RULES } from "./data/mockCatalog";
import { useAuthSession } from "./hooks/useAuthSession";
import { useCatalogData } from "./hooks/useCatalogData";
import { notifyOwnerNewQuote } from "./lib/commerceOps";
import { calculateQuote, currency } from "./lib/quoteCalculator";
import { buildUpsellRecommendations } from "./lib/recommendations";
import { checkEventAvailability, submitQuote } from "./lib/quoteStore";
import { recordDiagnosticError, setDiagnosticsUserContext } from "./lib/sessionDiagnostics";

const AdminCatalogModal = lazy(() => import("./components/AdminCatalogModal"));
const EventScheduleModal = lazy(() => import("./components/EventScheduleModal"));
const IntegrationOpsModal = lazy(() => import("./components/IntegrationOpsModal"));
const DiagnosticsModal = lazy(() => import("./components/DiagnosticsModal"));
const QuoteCompareModal = lazy(() => import("./components/QuoteCompareModal"));
const QuoteHistoryModal = lazy(() => import("./components/QuoteHistoryModal"));
const ReportingDashboardModal = lazy(() => import("./components/ReportingDashboardModal"));

const STEP_LABELS = ["Event", "Menu & Services", "Review"];

function readPortalKeyFromUrl() {
  if (typeof window === "undefined") return "";
  const params = new URLSearchParams(window.location.search);
  return String(params.get("portal") || "").trim();
}

function copyText(text) {
  if (!navigator?.clipboard) {
    throw new Error("Clipboard is unavailable in this browser.");
  }
  return navigator.clipboard.writeText(text);
}

export default function App() {
  const wizardRef = useRef(null);
  const authSession = useAuthSession();
  const [portalKey, setPortalKey] = useState(() => readPortalKeyFromUrl());
  const [portalMode, setPortalMode] = useState(Boolean(portalKey));
  const catalog = useCatalogData({ enabled: authSession.isStaff });
  const [step, setStep] = useState(1);
  const [adminOpen, setAdminOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [submitState, setSubmitState] = useState({ saving: false, message: "", portalLink: "" });
  const [availabilityNotice, setAvailabilityNotice] = useState("");

  const [form, setForm] = useState({
    date: "",
    time: "",
    hours: 0,
    bartenders: 0,
    guests: 0,
    venue: "",
    venueAddress: "",
    eventName: "",
    clientOrg: "",
    style: "Buffet",
    name: "",
    phone: "",
    email: "",
    pkg: "classic",
    addons: [],
    rentals: [],
    menuItems: [],
    eventTemplateId: "custom",
    taxRegion: "",
    seasonProfileId: "auto",
    milesRT: 0,
    includeDisposables: true,
    depositLink: "",
    payMethod: "card"
  });

  const totals = useMemo(
    () => calculateQuote(form, catalog, catalog.settings),
    [form, catalog]
  );

  const recommendations = useMemo(
    () => buildUpsellRecommendations({ form, catalog, totals, settings: catalog.settings }),
    [form, catalog, totals]
  );
  const brandName = catalog.settings?.brandName || "Tasteful Touch Catering";
  const brandTagline = catalog.settings?.brandTagline || "Chef Toni and Grill Master Ervin";
  const brandLogoUrl = catalog.settings?.brandLogoUrl || "/brand/logo.png";
  const brandPrimaryColor = catalog.settings?.brandPrimaryColor || "#c99334";
  const brandAccentColor = catalog.settings?.brandAccentColor || "#f0d29a";
  const brandDarkAccentColor = catalog.settings?.brandDarkAccentColor || "#8d611a";
  const brandBackgroundStart = catalog.settings?.brandBackgroundStart || "#100d09";
  const brandBackgroundMid = catalog.settings?.brandBackgroundMid || "#221a12";
  const brandBackgroundEnd = catalog.settings?.brandBackgroundEnd || "#ae7d2b";
  const brandCrew = Array.isArray(catalog.settings?.brandCrew) ? catalog.settings.brandCrew : [];
  const scheduleStaffLeads = brandCrew
    .map((member) => String(member?.label || "").trim())
    .filter(Boolean);
  const scheduleCapacityLimit = Math.max(1, Number(catalog.settings?.capacityLimit || 400));
  const heroEyebrow = catalog.settings?.heroEyebrow || "Premium Event Catering Workbench";
  const heroHeadline = catalog.settings?.heroHeadline || "Signature flavor. Configurable quotes.";
  const heroDescription =
    catalog.settings?.heroDescription ||
    "A polished sales cockpit for weddings, corporate events, and celebrations up to 400 guests. Build scenarios, apply smart upsells, and send better proposals faster.";
  const appThemeVars = {
    "--tone-gold-1": brandAccentColor,
    "--tone-gold-2": brandPrimaryColor,
    "--tone-gold-3": brandDarkAccentColor,
    "--app-bg-start": brandBackgroundStart,
    "--app-bg-mid": brandBackgroundMid,
    "--app-bg-end": brandBackgroundEnd
  };

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

  useEffect(() => {
    setAvailabilityNotice("");
  }, [form.date, form.venue]);

  useEffect(() => {
    setDiagnosticsUserContext({
      uid: authSession.user?.uid || "",
      email: authSession.user?.email || "",
      role: authSession.role || "customer",
      authenticated: Boolean(authSession.user)
    });
  }, [authSession.user?.uid, authSession.user?.email, authSession.role]);

  useEffect(() => {
    if (!authSession.error) return;
    recordDiagnosticError(new Error(authSession.error), {
      surface: "auth-session",
      action: "load-user-role"
    });
  }, [authSession.error]);

  useEffect(() => {
    if (!catalog.error) return;
    recordDiagnosticError(new Error(catalog.error), {
      surface: "catalog",
      action: "load-catalog"
    });
  }, [catalog.error]);

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
      bartenders: Number(template.bartenders ?? prev.bartenders ?? 0),
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
    const requiredError =
      totals.guests <= 0
        ? "Add guest count before saving a quote."
        : !form.name.trim()
          ? "Client name is required."
          : !form.email.trim()
            ? "Client email is required."
            : !/^\S+@\S+\.\S+$/.test(form.email.trim())
              ? "Client email format is invalid."
              : !form.date
                ? "Event date is required."
                : !form.eventName.trim()
                  ? "Event name is required."
                  : !form.venue.trim()
                    ? "Venue is required."
                    : "";

    if (requiredError) {
      setSubmitState({ saving: false, message: requiredError, portalLink: "" });
      return;
    }

    setSubmitState({ saving: true, message: "", portalLink: "" });
    try {
      const availability = await checkEventAvailability({
        eventDate: form.date,
        venue: form.venue,
        eventTime: form.time,
        eventHours: form.hours,
        eventGuests: form.guests,
        capacityLimit: scheduleCapacityLimit
      });
      if (availability.hasBlockingConflict) {
        const conflictRefs = availability.conflicts
          .filter((item) => item.status === "booked")
          .slice(0, 3)
          .map((item) => item.quoteNumber || item.id)
          .join(", ");
        const capacityNote = availability.capacityExceeded
          ? ` Capacity alert: projected load (${availability.sameVenueLoad}) exceeds configured threshold (${availability.capacityLimit}).`
          : "";
        setSubmitState({
          saving: false,
          message:
            `Availability conflict: this date/venue is already booked.` +
            `${conflictRefs ? ` Existing booking(s): ${conflictRefs}.` : ""}` +
            capacityNote,
          portalLink: ""
        });
        return;
      }
      const softConflicts = availability.conflicts.filter((item) => item.status === "accepted");
      const notes = [];
      if (softConflicts.length) {
        const refs = softConflicts
          .slice(0, 3)
          .map((item) => item.quoteNumber || item.id)
          .join(", ");
        notes.push(
          `Availability note: ${softConflicts.length} accepted quote(s) already exist for this date/venue${refs ? ` (${refs})` : ""}.`
        );
      }
      if (availability.capacityExceeded) {
        notes.push(
          `Capacity note: projected same-venue load is ${availability.sameVenueLoad} guests (limit ${availability.capacityLimit}).`
        );
      }
      if (notes.length) {
        setAvailabilityNotice(notes.join(" "));
      } else {
        setAvailabilityNotice("");
      }

      const result = await submitQuote({
        form,
        totals,
        catalogSource: catalog.source,
        settings: catalog.settings,
        ownerUid: authSession.user?.uid || "",
        ownerEmail: authSession.user?.email || ""
      });
      const basePath = `${window.location.origin}${window.location.pathname}`;
      const portalLink = result.portalKey ? `${basePath}?portal=${result.portalKey}` : "";
      let smsSuffix = "";
      if (result.storage === "firebase") {
        try {
          const smsResult = await notifyOwnerNewQuote({
            quoteId: result.id,
            portalLink
          });
          if (smsResult?.sms?.sent) {
            smsSuffix = " Owner SMS sent.";
          } else if (smsResult?.sms?.reason === "sms_not_configured") {
            smsSuffix = " Owner SMS not configured yet.";
          } else if (smsResult?.sms?.reason === "sms_disabled") {
            smsSuffix = " Owner SMS disabled by configuration.";
          } else if (smsResult?.sms?.reason === "sms_send_failed") {
            smsSuffix = " Owner SMS failed to send.";
          }
        } catch (smsErr) {
          smsSuffix = " Owner SMS failed to send.";
        }
      }
      setSubmitState({
        saving: false,
        message: `Quote ${result.quoteNumber} saved to ${result.storage}.${smsSuffix}`,
        portalLink
      });
      setHistoryOpen(true);
    } catch (err) {
      recordDiagnosticError(err, {
        surface: "app",
        action: "submit-quote",
        eventDate: form.date,
        venue: form.venue,
        guests: totals.guests
      });
      setSubmitState({ saving: false, message: err?.message || "Failed to save quote.", portalLink: "" });
    }
  };

  const handleCopyPortalLink = async () => {
    try {
      if (!submitState.portalLink) return;
      await copyText(submitState.portalLink);
      setSubmitState((prev) => ({ ...prev, message: "Customer portal link copied." }));
    } catch (err) {
      recordDiagnosticError(err, {
        surface: "app",
        action: "copy-portal-link"
      });
      setSubmitState((prev) => ({
        ...prev,
        message: err?.message || "Failed to copy customer portal link."
      }));
    }
  };

  const handleGetInstantQuote = () => {
    setStep(1);
    wizardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSignOut = async () => {
    try {
      await authSession.signOut();
    } catch (err) {
      recordDiagnosticError(err, {
        surface: "app",
        action: "sign-out"
      });
      setSubmitState((prev) => ({ ...prev, message: err?.message || "Failed to sign out." }));
    }
  };

  const openPortalMode = () => {
    setPortalKey("");
    setPortalMode(true);
  };

  const closePortalMode = () => {
    setPortalMode(false);
    setPortalKey("");
    const nextUrl = `${window.location.pathname}${window.location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  };

  if (portalMode) {
    return (
      <div className="app-shell" style={appThemeVars}>
        <CustomerPortalView initialPortalKey={portalKey} onBackToStaff={closePortalMode} />
      </div>
    );
  }

  if (authSession.loading) {
    return (
      <main className="auth-shell container">
        <section className="panel auth-card">
          <h1>Loading</h1>
          <p className="muted">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (!authSession.user) {
    return <AuthGate sessionError={authSession.error} />;
  }

  if (!authSession.isStaff) {
    return (
      <main className="auth-shell container">
        <section className="panel auth-card">
          <h1>Access Restricted</h1>
          <p className="muted">
            Signed in as {authSession.user.email}. Your account role is <strong>{authSession.role}</strong>.
          </p>
          <p className="source-note">Ask an admin to set your role to `sales` or `admin` in `userRoles/{authSession.user.uid}`.</p>
          <div className="auth-actions">
            <button type="button" className="ghost" onClick={openPortalMode}>Open Customer Portal</button>
            <button type="button" className="cta" onClick={handleSignOut}>Sign Out</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="app-shell" style={appThemeVars}>
      <header className="site-header">
        <div className="container nav">
          <div className="brand-lockup">
            <img
              className="brand-logo"
              src={brandLogoUrl}
              alt={`${brandName} logo`}
              loading="eager"
              decoding="async"
            />
            <div className="brand-copy">
              <div className="brand">{brandName}</div>
              <p>{brandTagline}</p>
            </div>
          </div>
          {brandCrew.length > 0 && (
            <div className="brand-crew">
              {brandCrew.map((member, idx) => (
                <figure className="crew-chip" key={`${member.label || "member"}-${idx}`}>
                  {member.imageUrl ? (
                    <img src={member.imageUrl} alt={member.label || `Team member ${idx + 1}`} loading="lazy" decoding="async" />
                  ) : (
                    <img src={brandLogoUrl} alt={member.label || `Team member ${idx + 1}`} loading="lazy" decoding="async" />
                  )}
                  <figcaption>{member.label || `Team member ${idx + 1}`}</figcaption>
                </figure>
              ))}
            </div>
          )}
          <div className="right-actions header-actions">
            <button className="ghost" onClick={() => setScheduleOpen(true)}>Schedule</button>
            <button className="ghost" onClick={() => setIntegrationsOpen(true)}>Integrations</button>
            <button className="ghost" onClick={() => setDiagnosticsOpen(true)}>Diagnostics</button>
            <button className="ghost" onClick={() => setDashboardOpen(true)}>Dashboard</button>
            <button className="ghost" onClick={() => setHistoryOpen(true)}>Quote History</button>
            {authSession.isAdmin && <button className="ghost" onClick={() => setAdminOpen(true)}>Admin Catalog</button>}
            <button className="ghost" onClick={openPortalMode}>Customer Portal</button>
            <button className="cta" onClick={handleGetInstantQuote}>Get Instant Quote</button>
            <button className="ghost" onClick={handleSignOut}>Sign Out</button>
          </div>
        </div>
      </header>

      <section className="hero container">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">{heroEyebrow}</p>
            <h1>{heroHeadline}</h1>
            <p>{heroDescription}</p>
            <div className="hero-pills">
              <span>Signed in: {authSession.user.email}</span>
              <span>Role: {authSession.role}</span>
              <span>Source: {catalog.source}</span>
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
                    <option value="card">Pay by Card</option>
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

          {submitState.portalLink && (
            <div className="portal-link-row">
              <input type="text" readOnly value={submitState.portalLink} />
              <button type="button" className="ghost" onClick={handleCopyPortalLink}>Copy Portal Link</button>
            </div>
          )}

          <p className="source-note">Quote validity: {Math.max(1, Number(catalog.settings?.quoteValidityDays || 30))} days</p>
          {catalog.error && <p className="error-note">{catalog.error}</p>}
          {availabilityNotice && <p className="warning-note">{availabilityNotice}</p>}
          {submitState.message && <p className="source-note">{submitState.message}</p>}
        </section>

        <LiveBreakdown form={form} totals={totals} settings={catalog.settings} catalog={catalog} />
      </main>

      <Suspense fallback={null}>
        {authSession.isAdmin && (
          <AdminCatalogModal
            open={adminOpen}
            catalog={catalog}
            onClose={() => setAdminOpen(false)}
            onSave={catalog.saveCatalog}
            saving={catalog.saving}
          />
        )}

        <QuoteHistoryModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          basePortalUrl={`${window.location.origin}${window.location.pathname}`}
          currentUserEmail={authSession.user?.email || ""}
        />

        <EventScheduleModal
          open={scheduleOpen}
          onClose={() => setScheduleOpen(false)}
          staffLeads={scheduleStaffLeads}
          capacityLimit={scheduleCapacityLimit}
        />

        <IntegrationOpsModal
          open={integrationsOpen}
          onClose={() => setIntegrationsOpen(false)}
          settings={catalog.settings}
          currentUserEmail={authSession.user?.email || ""}
        />

        <DiagnosticsModal
          open={diagnosticsOpen}
          onClose={() => setDiagnosticsOpen(false)}
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
      </Suspense>
    </div>
  );
}

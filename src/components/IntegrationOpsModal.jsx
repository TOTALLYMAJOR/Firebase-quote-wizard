import { useEffect, useMemo, useState } from "react";
import { getIntegrationSetupStatus, sendIntegrationTestSms } from "../lib/commerceOps";
import { currency } from "../lib/quoteCalculator";
import { getQuoteHistory, recordQuoteIntegrationSync, syncQuoteToCrm } from "../lib/quoteStore";

const PROVIDERS = ["crm", "webhook", "webhook_bridge", "hubspot", "salesforce"];
const STATES = ["queued", "success", "error", "retrying", "skipped"];
const DIRECTIONS = ["push", "pull"];

function toIso(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function formatDateTime(value) {
  const date = new Date(value || "");
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toProvider(value) {
  const provider = String(value || "").trim().toLowerCase().replace("-", "_");
  if (provider === "webhookbridge") return "webhook_bridge";
  return PROVIDERS.includes(provider) ? provider : "crm";
}

function toState(value) {
  const state = String(value || "").trim().toLowerCase();
  return STATES.includes(state) ? state : "queued";
}

function toDirection(value) {
  return String(value || "").trim().toLowerCase() === "pull" ? "pull" : "push";
}

function getWindowBaseUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

function formatMissingFields(fields) {
  if (!Array.isArray(fields) || fields.length === 0) return "none";
  return fields.join(", ");
}

function describeSmsOutcome(sms) {
  if (sms?.sent) return "Test SMS sent successfully.";
  const reason = String(sms?.reason || "").trim();
  if (reason === "sms_not_configured") return "SMS not configured yet. Add Twilio values and redeploy functions.";
  if (reason === "sms_disabled") return "SMS is intentionally disabled (`notifications.sms_provider=\"none\"`).";
  if (reason === "sms_provider_unsupported") return "Configured SMS provider is unsupported in this build.";
  if (reason === "sms_send_failed") return `SMS send failed${sms?.message ? `: ${sms.message}` : "."}`;
  return "SMS test did not send.";
}

async function copyText(text) {
  if (!navigator?.clipboard) {
    throw new Error("Clipboard unavailable in this browser.");
  }
  await navigator.clipboard.writeText(text);
}

function flattenLogs(quotes) {
  const rows = [];
  quotes.forEach((quote) => {
    const logs = Array.isArray(quote.integrations?.logs) ? quote.integrations.logs : [];
    logs.forEach((entry, idx) => {
      rows.push({
        id: `${quote.id}-${entry.id || idx}`,
        quoteId: quote.id,
        quoteNumber: quote.quoteNumber || "-",
        customer: quote.customer?.name || quote.customer?.email || "-",
        eventDate: quote.event?.date || "-",
        total: Number(quote.totals?.total || 0),
        provider: toProvider(entry.provider),
        state: toState(entry.state),
        direction: toDirection(entry.direction),
        message: String(entry.message || "").trim(),
        attempt: Math.max(1, Number(entry.attempt || 1)),
        payloadRef: String(entry.payloadRef || "").trim(),
        actorEmail: String(entry.actorEmail || "").trim(),
        occurredAtISO: toIso(entry.occurredAtISO) || toIso(entry.occurredAt)
      });
    });
  });

  return rows.sort((a, b) => b.occurredAtISO.localeCompare(a.occurredAtISO));
}

export default function IntegrationOpsModal({
  open,
  onClose,
  organizationId = "",
  settings = {},
  currentUserEmail = ""
}) {
  const defaultProvider = toProvider(settings.crmProvider || "crm");
  const [state, setState] = useState({
    loading: false,
    error: "",
    source: "",
    quotes: []
  });
  const [feedback, setFeedback] = useState("");
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("all");
  const [syncStateFilter, setSyncStateFilter] = useState("all");
  const [saving, setSaving] = useState(false);
  const [runningSync, setRunningSync] = useState(false);
  const [setupState, setSetupState] = useState({
    loading: false,
    testing: false,
    error: "",
    resultMessage: "",
    status: null,
    testMessage: ""
  });
  const [setupForm, setSetupForm] = useState({
    appBaseUrl: getWindowBaseUrl(),
    twilioFromNumber: "",
    ownerPhone: ""
  });
  const [form, setForm] = useState({
    quoteId: "",
    provider: defaultProvider,
    state: "queued",
    direction: "push",
    attempt: 1,
    message: "",
    payloadRef: ""
  });

  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const result = await getQuoteHistory({ organizationId });
      setState({
        loading: false,
        error: "",
        source: result.source,
        quotes: result.quotes
      });
      setForm((prev) => ({
        ...prev,
        quoteId: prev.quoteId || result.quotes[0]?.id || ""
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to load integration data."
      }));
    }
  };

  const refreshSetupStatus = async () => {
    setSetupState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const result = await getIntegrationSetupStatus();
      const status = result?.status || null;
      setSetupState((prev) => ({
        ...prev,
        loading: false,
        error: "",
        status
      }));
    } catch (err) {
      setSetupState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to load integration setup status."
      }));
    }
  };

  const handleCopyValue = async (value, label) => {
    try {
      await copyText(value);
      setFeedback(`${label} copied.`);
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || `Failed to copy ${label.toLowerCase()}.` }));
    }
  };

  const handleSendTestSms = async () => {
    setSetupState((prev) => ({
      ...prev,
      testing: true,
      error: "",
      resultMessage: ""
    }));
    try {
      const result = await sendIntegrationTestSms({
        message: setupState.testMessage
      });
      const sms = result?.sms || {};
      setSetupState((prev) => ({
        ...prev,
        testing: false,
        status: result?.status || prev.status,
        resultMessage: describeSmsOutcome(sms)
      }));
    } catch (err) {
      setSetupState((prev) => ({
        ...prev,
        testing: false,
        error: err?.message || "Failed to send integration SMS test."
      }));
    }
  };

  useEffect(() => {
    if (!open) return;
    setFeedback("");
    setForm((prev) => ({ ...prev, provider: toProvider(settings.crmProvider || prev.provider || "crm") }));
    load();
    refreshSetupStatus();
    setSetupForm((prev) => ({
      ...prev,
      appBaseUrl: prev.appBaseUrl || getWindowBaseUrl()
    }));
  }, [open, organizationId, settings.crmProvider]);

  const activityRows = useMemo(() => flattenLogs(state.quotes), [state.quotes]);

  const filteredRows = useMemo(() => {
    return activityRows.filter((row) => {
      if (providerFilter !== "all" && row.provider !== providerFilter) return false;
      if (syncStateFilter !== "all" && row.state !== syncStateFilter) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      const haystack = [
        row.quoteNumber,
        row.customer,
        row.eventDate,
        row.provider,
        row.state,
        row.message,
        row.actorEmail,
        row.payloadRef
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [activityRows, providerFilter, syncStateFilter, search]);

  const selectedQuote = useMemo(
    () => state.quotes.find((quote) => quote.id === form.quoteId) || null,
    [state.quotes, form.quoteId]
  );

  const providerEndpoints = useMemo(() => ([
    { id: "webhook", label: "Webhook URL", value: String(settings.crmWebhookUrl || "").trim() },
    { id: "webhook_bridge", label: "Webhook bridge URL", value: String(settings.crmWebhookBridgeUrl || "").trim() },
    { id: "hubspot", label: "HubSpot bridge URL", value: String(settings.crmHubspotBridgeUrl || "").trim() },
    { id: "salesforce", label: "Salesforce bridge URL", value: String(settings.crmSalesforceBridgeUrl || "").trim() }
  ]), [settings.crmWebhookUrl, settings.crmWebhookBridgeUrl, settings.crmHubspotBridgeUrl, settings.crmSalesforceBridgeUrl]);

  const integrationStatus = setupState.status || {};
  const twilioStatus = integrationStatus.twilio || {};
  const stripeStatus = integrationStatus.stripe || {};
  const twilioMissingFields = Array.isArray(twilioStatus.missingFields) ? twilioStatus.missingFields : [];
  const stripeMissingFields = Array.isArray(stripeStatus.missingFields) ? stripeStatus.missingFields : [];

  const setupCommand = useMemo(() => {
    const appBaseUrl = setupForm.appBaseUrl.trim() || "https://your-live-domain.example";
    const twilioFromNumber = setupForm.twilioFromNumber.trim() || "<your_twilio_from_number>";
    const ownerPhone = setupForm.ownerPhone.trim() || "<your_owner_phone>";

    return [
      "npx firebase-tools functions:config:set \\",
      "  notifications.sms_provider=\"twilio\" \\",
      "  stripe.secret_key=\"<your_stripe_secret>\" \\",
      "  stripe.webhook_secret=\"<your_stripe_webhook_secret>\" \\",
      "  twilio.account_sid=\"<your_twilio_account_sid>\" \\",
      "  twilio.auth_token=\"<your_twilio_auth_token>\" \\",
      `  twilio.from_number=\"${twilioFromNumber}\" \\`,
      `  notifications.owner_phone=\"${ownerPhone}\" \\`,
      `  app.base_url=\"${appBaseUrl}\"`
    ].join("\n");
  }, [setupForm.appBaseUrl, setupForm.ownerPhone, setupForm.twilioFromNumber]);

  const disableSmsCommand = "npx firebase-tools functions:config:set notifications.sms_provider=\"none\"";
  const deployFunctionsCommand = "npm run deploy:firebase:functions";

  const handleRecord = async () => {
    if (!form.quoteId) {
      setState((prev) => ({ ...prev, error: "Choose a quote before recording a sync event." }));
      return;
    }

    setSaving(true);
    setFeedback("");
    setState((prev) => ({ ...prev, error: "" }));
    try {
      const result = await recordQuoteIntegrationSync({
        quoteId: form.quoteId,
        provider: form.provider,
        direction: form.direction,
        state: form.state,
        message: form.message,
        actorEmail: currentUserEmail,
        attempt: form.attempt,
        payloadRef: form.payloadRef
      });
      setFeedback(`Recorded ${result.entry.provider} ${result.entry.state} event.`);
      setForm((prev) => ({ ...prev, message: "", payloadRef: "" }));
      await load();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to record integration event."
      }));
    } finally {
      setSaving(false);
    }
  };

  const handleRunSync = async () => {
    if (!form.quoteId) {
      setState((prev) => ({ ...prev, error: "Choose a quote before running CRM sync." }));
      return;
    }

    setRunningSync(true);
    setFeedback("");
    setState((prev) => ({ ...prev, error: "" }));
    try {
      const result = await syncQuoteToCrm({
        quoteId: form.quoteId,
        provider: form.provider,
        actorEmail: currentUserEmail,
        trigger: "manual"
      });
      if (result?.skipped) {
        setFeedback(result.reason || "CRM sync skipped.");
      } else {
        const providerLabel = result?.provider || form.provider;
        setFeedback(`CRM sync completed via ${providerLabel}.`);
      }
      await load();
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "CRM sync failed."
      }));
    } finally {
      setRunningSync(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card integration-card">
        <div className="modal-head">
          <h2>Integrations Ops</h2>
          <div className="right-actions">
            <button type="button" className="ghost" onClick={load} disabled={state.loading}>
              {state.loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="ghost" onClick={refreshSetupStatus} disabled={setupState.loading}>
              {setupState.loading ? "Checking Setup..." : "Check Setup"}
            </button>
            <button type="button" className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <p className="source-note">Source: {state.source || "-"}</p>
        {state.error && <p className="error-note">{state.error}</p>}
        {feedback && <p className="source-note">{feedback}</p>}

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Provider Config</h3>
          </div>
          <div className="status-strip">
            <span>
              CRM: <strong>{settings.crmEnabled ? "enabled" : "disabled"}</strong>
            </span>
            <span>Provider: <strong>{settings.crmProvider || "webhook"}</strong></span>
            <span>CRM module: <strong>{settings.featureFlags?.crmSync === false ? "disabled" : "enabled"}</strong></span>
            <span>Retry limit: <strong>{Math.max(1, Number(settings.integrationRetryLimit || 3))}</strong></span>
            <span>Audit retention: <strong>{Math.max(10, Number(settings.integrationAuditRetention || 50))}</strong></span>
          </div>
          <div className="admin-grid-settings integration-form-grid">
            {providerEndpoints.map((endpoint) => (
              <label key={endpoint.id}>
                {endpoint.label}
                <input type="text" readOnly value={endpoint.value || "Not configured"} />
              </label>
            ))}
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Buyer Setup Assistant (Optional Twilio)</h3>
          </div>
          <p className="source-note">
            Core quote + portal workflows continue without Twilio. Buyers can enable SMS later by supplying their own
            provider credentials.
          </p>
          {setupState.error && <p className="error-note">{setupState.error}</p>}
          {setupState.resultMessage && <p className="source-note">{setupState.resultMessage}</p>}
          <div className="status-strip">
            <span>SMS provider: <strong>{integrationStatus.smsProvider || "unknown"}</strong></span>
            <span>Twilio: <strong>{twilioStatus.configured ? "configured" : "not configured"}</strong></span>
            <span>SMS send ready: <strong>{twilioStatus.canSend ? "yes" : "no"}</strong></span>
            <span>Stripe: <strong>{stripeStatus.configured ? "configured" : "not configured"}</strong></span>
            <span>App base URL: <strong>{integrationStatus.appBaseUrlConfigured ? "configured" : "not configured"}</strong></span>
          </div>
          {twilioMissingFields.length > 0 && (
            <p className="warning-note">Twilio missing fields: {formatMissingFields(twilioMissingFields)}</p>
          )}
          {stripeMissingFields.length > 0 && (
            <p className="warning-note">Stripe missing fields: {formatMissingFields(stripeMissingFields)}</p>
          )}
          <div className="admin-grid-settings integration-form-grid">
            <label>
              App base URL
              <input
                type="url"
                placeholder="https://your-live-domain.example"
                value={setupForm.appBaseUrl}
                onChange={(event) => setSetupForm((prev) => ({ ...prev, appBaseUrl: event.target.value }))}
              />
            </label>
            <label>
              Twilio from number
              <input
                type="text"
                placeholder="+15551234567"
                value={setupForm.twilioFromNumber}
                onChange={(event) => setSetupForm((prev) => ({ ...prev, twilioFromNumber: event.target.value }))}
              />
            </label>
            <label>
              Owner SMS number
              <input
                type="text"
                placeholder="+15557654321"
                value={setupForm.ownerPhone}
                onChange={(event) => setSetupForm((prev) => ({ ...prev, ownerPhone: event.target.value }))}
              />
            </label>
            <label className="integration-message-field">
              Test SMS message (optional)
              <input
                type="text"
                placeholder="Connectivity test for buyer setup"
                value={setupState.testMessage}
                onChange={(event) => setSetupState((prev) => ({ ...prev, testMessage: event.target.value }))}
              />
            </label>
          </div>
          <p className="source-note">Run in buyer environment, then redeploy functions.</p>
          <pre className="integration-command-block"><code>{setupCommand}</code></pre>
          <div className="right-actions">
            <button type="button" className="ghost" onClick={() => handleCopyValue(setupCommand, "Setup command")}>
              Copy Setup Command
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => handleCopyValue(disableSmsCommand, "SMS disable command")}
            >
              Copy SMS Off Command
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => handleCopyValue(deployFunctionsCommand, "Deploy command")}
            >
              Copy Deploy Command
            </button>
            <button
              type="button"
              className="cta"
              onClick={handleSendTestSms}
              disabled={setupState.testing || !twilioStatus.canSend}
            >
              {setupState.testing ? "Sending Test..." : "Send Test SMS"}
            </button>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Run CRM Sync / Record Event</h3>
          </div>
          <div className="admin-grid-settings integration-form-grid">
            <label>
              Quote
              <select
                value={form.quoteId}
                onChange={(event) => setForm((prev) => ({ ...prev, quoteId: event.target.value }))}
              >
                <option value="">Select quote</option>
                {state.quotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quoteNumber || quote.id} • {quote.customer?.name || quote.customer?.email || "-"} • {quote.event?.date || "-"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Provider
              <select
                value={form.provider}
                onChange={(event) => setForm((prev) => ({ ...prev, provider: event.target.value }))}
              >
                {PROVIDERS.map((provider) => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>
            </label>
            <label>
              State
              <select
                value={form.state}
                onChange={(event) => setForm((prev) => ({ ...prev, state: event.target.value }))}
              >
                {STATES.map((syncState) => (
                  <option key={syncState} value={syncState}>{syncState}</option>
                ))}
              </select>
            </label>
            <label>
              Direction
              <select
                value={form.direction}
                onChange={(event) => setForm((prev) => ({ ...prev, direction: event.target.value }))}
              >
                {DIRECTIONS.map((direction) => (
                  <option key={direction} value={direction}>{direction}</option>
                ))}
              </select>
            </label>
            <label>
              Attempt
              <input
                type="number"
                min="1"
                max={Math.max(1, Number(settings.integrationRetryLimit || 3))}
                value={form.attempt}
                onChange={(event) => setForm((prev) => ({ ...prev, attempt: Math.max(1, Number(event.target.value || 1)) }))}
              />
            </label>
            <label>
              Payload reference
              <input
                type="text"
                placeholder="invoice-1234 / webhook-id"
                value={form.payloadRef}
                onChange={(event) => setForm((prev) => ({ ...prev, payloadRef: event.target.value }))}
              />
            </label>
            <label className="integration-message-field">
              Message
              <input
                type="text"
                placeholder="Sync queued, API timeout, or success notes"
                value={form.message}
                onChange={(event) => setForm((prev) => ({ ...prev, message: event.target.value }))}
              />
            </label>
          </div>
          {selectedQuote && (
            <p className="source-note">
              Selected quote: {selectedQuote.quoteNumber || selectedQuote.id} • {selectedQuote.customer?.name || selectedQuote.customer?.email || "-"}
            </p>
          )}
          <div className="right-actions">
            <button
              type="button"
              className="cta"
              onClick={handleRunSync}
              disabled={runningSync || state.loading}
            >
              {runningSync ? "Syncing..." : "Run CRM Sync"}
            </button>
            <button type="button" className="cta" onClick={handleRecord} disabled={saving || state.loading}>
              {saving ? "Recording..." : "Record Event"}
            </button>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Integration Activity</h3>
          </div>
          <div className="integration-filters">
            <input
              type="text"
              placeholder="Search quote, customer, message"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
              <option value="all">All providers</option>
              {PROVIDERS.map((provider) => (
                <option key={provider} value={provider}>{provider}</option>
              ))}
            </select>
            <select value={syncStateFilter} onChange={(event) => setSyncStateFilter(event.target.value)}>
              <option value="all">All states</option>
              {STATES.map((syncState) => (
                <option key={syncState} value={syncState}>{syncState}</option>
              ))}
            </select>
          </div>
          <div className="history-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Provider</th>
                  <th>State</th>
                  <th>Quote</th>
                  <th>Event</th>
                  <th>Total</th>
                  <th>Message</th>
                  <th>Attempt</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {!state.loading && filteredRows.length === 0 && (
                  <tr>
                    <td colSpan="9">No integration events found.</td>
                  </tr>
                )}
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDateTime(row.occurredAtISO)}</td>
                    <td>{row.provider}</td>
                    <td>{row.state}</td>
                    <td>{row.quoteNumber}</td>
                    <td>{row.customer} • {row.eventDate}</td>
                    <td>{currency(row.total)}</td>
                    <td>{row.message || row.payloadRef || "-"}</td>
                    <td>{row.attempt}</td>
                    <td>{row.actorEmail || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { currency } from "../lib/quoteCalculator";
import { getQuoteHistory, recordQuoteIntegrationSync } from "../lib/quoteStore";

const PROVIDERS = ["quickbooks", "crm"];
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
  const provider = String(value || "").trim().toLowerCase();
  return PROVIDERS.includes(provider) ? provider : "quickbooks";
}

function toState(value) {
  const state = String(value || "").trim().toLowerCase();
  return STATES.includes(state) ? state : "queued";
}

function toDirection(value) {
  return String(value || "").trim().toLowerCase() === "pull" ? "pull" : "push";
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
  settings = {},
  currentUserEmail = ""
}) {
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
  const [form, setForm] = useState({
    quoteId: "",
    provider: "quickbooks",
    state: "queued",
    direction: "push",
    attempt: 1,
    message: "",
    payloadRef: ""
  });

  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: "" }));
    try {
      const result = await getQuoteHistory();
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

  useEffect(() => {
    if (!open) return;
    setFeedback("");
    load();
  }, [open]);

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
              QuickBooks: <strong>{settings.quickbooksEnabled ? "enabled" : "disabled"}</strong>
            </span>
            <span>Realm: <strong>{settings.quickbooksRealmId || "-"}</strong></span>
            <span>
              CRM: <strong>{settings.crmEnabled ? "enabled" : "disabled"}</strong>
            </span>
            <span>Provider: <strong>{settings.crmProvider || "webhook"}</strong></span>
            <span>Retry limit: <strong>{Math.max(1, Number(settings.integrationRetryLimit || 3))}</strong></span>
            <span>Audit retention: <strong>{Math.max(10, Number(settings.integrationAuditRetention || 50))}</strong></span>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-head">
            <h3>Record Sync Event</h3>
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
          <div className="right-actions">
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

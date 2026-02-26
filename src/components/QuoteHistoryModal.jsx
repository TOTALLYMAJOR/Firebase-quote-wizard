import { useEffect, useState } from "react";
import { currency } from "../lib/quoteCalculator";
import {
  buildQuoteEmailTemplate,
  getAllowedStatusTransitions,
  getQuoteHistory,
  updateQuoteStatus
} from "../lib/quoteStore";
import { exportQuoteProposal } from "../lib/proposalExport";

function fmtDate(iso) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

export default function QuoteHistoryModal({ open, onClose }) {
  const [state, setState] = useState({
    loading: false,
    source: "",
    error: "",
    feedback: "",
    quotes: []
  });
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState("");

  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: "", feedback: "" }));
    try {
      const result = await getQuoteHistory();
      setState({
        loading: false,
        error: "",
        feedback: "",
        source: result.source,
        quotes: result.quotes
      });
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to load quote history.",
        feedback: ""
      }));
    }
  };

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  if (!open) return null;

  const filteredQuotes = state.quotes.filter((quote) => {
    const statusMatch = statusFilter === "all" || (quote.status || "draft") === statusFilter;
    if (!statusMatch) return false;

    const q = query.trim().toLowerCase();
    if (!q) return true;

    const haystack = [
      quote.quoteNumber,
      quote.customer?.name,
      quote.customer?.email,
      quote.event?.date,
      quote.event?.venue
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });

  const applyStatusLocally = (quoteId, nextStatus) => {
    setState((prev) => ({
      ...prev,
      quotes: prev.quotes.map((quote) =>
        quote.id === quoteId ? { ...quote, status: nextStatus } : quote
      )
    }));
  };

  const handleStatusUpdate = async (quoteId, nextStatus, silent = false) => {
    setUpdatingId(quoteId);
    try {
      await updateQuoteStatus(quoteId, nextStatus);
      applyStatusLocally(quoteId, nextStatus);
      if (!silent) {
        setState((prev) => ({ ...prev, feedback: `Status updated to ${nextStatus}.` }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to update quote status."
      }));
    } finally {
      setUpdatingId("");
    }
  };

  const handleCopyEmail = async (quote) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable in this browser.");
      }
      const template = buildQuoteEmailTemplate(quote);
      const mailText = `Subject: ${template.subject}\n\n${template.body}`;
      await navigator.clipboard.writeText(mailText);
      setState((prev) => ({ ...prev, feedback: `Email template copied for ${quote.quoteNumber}.` }));

      if (quote.status === "draft") {
        await handleStatusUpdate(quote.id, "sent", true);
        setState((prev) => ({ ...prev, feedback: `Email copied and ${quote.quoteNumber} marked sent.` }));
      }
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || "Failed to copy email template." }));
    }
  };

  const handleExportPdf = (quote) => {
    try {
      exportQuoteProposal(quote);
      setState((prev) => ({ ...prev, feedback: `Opened print view for ${quote.quoteNumber}.` }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || "Failed to export proposal PDF." }));
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card history-card">
        <div className="modal-head">
          <h2>Quote History</h2>
          <div className="right-actions">
            <button type="button" className="ghost" onClick={load} disabled={state.loading}>
              {state.loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <p className="source-note">Source: {state.source || "-"}</p>
        {state.error && <p className="error-note">{state.error}</p>}
        {state.feedback && <p className="source-note">{state.feedback}</p>}
        <div className="history-controls">
          <input
            type="text"
            placeholder="Search quote #, customer, date, venue"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Quote #</th>
                <th>Customer</th>
                <th>Event Date</th>
                <th>Guests</th>
                <th>Total</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!state.loading && filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan="9">No quotes saved yet.</td>
                </tr>
              )}
              {filteredQuotes.map((quote) => (
                <tr key={quote.id}>
                  <td>{quote.quoteNumber || "-"}</td>
                  <td>{quote.customer?.name || quote.customer?.email || "-"}</td>
                  <td>{quote.event?.date || "-"}</td>
                  <td>{quote.event?.guests ?? "-"}</td>
                  <td>{currency(quote.totals?.total || 0)}</td>
                  <td>
                    <select
                      value={quote.status || "draft"}
                      onChange={(e) => handleStatusUpdate(quote.id, e.target.value)}
                      disabled={updatingId === quote.id}
                    >
                      {getAllowedStatusTransitions(quote.status).map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>{fmtDate(quote.expiresAtISO)}</td>
                  <td>{fmtDate(quote.createdAtISO)}</td>
                  <td>
                    <div className="row-actions">
                      <button type="button" className="ghost compact" onClick={() => handleExportPdf(quote)}>PDF</button>
                      <button type="button" className="ghost compact" onClick={() => handleCopyEmail(quote)}>Copy Email</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

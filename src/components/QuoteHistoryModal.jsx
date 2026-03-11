import { useEffect, useState } from "react";
import { createDepositCheckout } from "../lib/commerceOps";
import { currency } from "../lib/quoteCalculator";
import {
  BOOKING_CONFIRMATION_STATUSES,
  buildQuoteEmailTemplate,
  convertQuoteToContract,
  getAllowedStatusTransitions,
  getQuoteHistory,
  PAYMENT_STATUSES,
  updateQuoteBookingConfirmation,
  updateQuotePaymentStatus,
  updateQuoteStatus
} from "../lib/quoteStore";

function fmtDate(iso) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function canConvertToContract(quote) {
  const status = String(quote?.status || "");
  const hasContract = Boolean(String(quote?.booking?.contractNumber || "").trim());
  return status === "accepted" || (status === "booked" && !hasContract);
}

export default function QuoteHistoryModal({
  open,
  onClose,
  basePortalUrl = "",
  currentUserEmail = ""
}) {
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
  const [updatingPaymentId, setUpdatingPaymentId] = useState("");
  const [convertingId, setConvertingId] = useState("");
  const [updatingConfirmationId, setUpdatingConfirmationId] = useState("");
  const [creatingCheckoutId, setCreatingCheckoutId] = useState("");

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
      quote.customer?.phone,
      quote.customer?.email,
      quote.event?.name,
      quote.event?.date,
      quote.event?.venue,
      quote.payment?.depositStatus,
      quote.booking?.contractNumber,
      quote.booking?.confirmationStatus
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });

  const applyQuoteLocally = (quoteId, updater) => {
    setState((prev) => ({
      ...prev,
      quotes: prev.quotes.map((quote) => (quote.id === quoteId ? updater(quote) : quote))
    }));
  };

  const applyStatusLocally = (quoteId, nextStatus) => {
    applyQuoteLocally(quoteId, (quote) => ({ ...quote, status: nextStatus }));
  };

  const applyPaymentLocally = (quoteId, nextPaymentStatus) => {
    applyQuoteLocally(quoteId, (quote) => ({
      ...quote,
      payment: {
        ...(quote.payment || {}),
        depositStatus: nextPaymentStatus,
        depositConfirmedAtISO:
          nextPaymentStatus === "paid" ? new Date().toISOString() : quote.payment?.depositConfirmedAtISO || ""
      }
    }));
  };

  const applyPaymentLinkLocally = (quoteId, paymentLink) => {
    applyQuoteLocally(quoteId, (quote) => ({
      ...quote,
      payment: {
        ...(quote.payment || {}),
        depositLink: paymentLink,
        depositStatus: "sent",
        depositConfirmedAtISO: quote.payment?.depositConfirmedAtISO || ""
      }
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

  const handlePaymentUpdate = async (quoteId, nextPaymentStatus) => {
    setUpdatingPaymentId(quoteId);
    try {
      await updateQuotePaymentStatus(quoteId, nextPaymentStatus);
      applyPaymentLocally(quoteId, nextPaymentStatus);
      setState((prev) => ({ ...prev, feedback: `Payment marked ${nextPaymentStatus}.` }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to update payment status."
      }));
    } finally {
      setUpdatingPaymentId("");
    }
  };

  const handleConvertToContract = async (quote) => {
    setConvertingId(quote.id);
    setState((prev) => ({ ...prev, error: "", feedback: "" }));
    try {
      const result = await convertQuoteToContract({
        quoteId: quote.id,
        actorEmail: currentUserEmail
      });
      applyQuoteLocally(quote.id, (existing) => ({
        ...existing,
        status: result.status,
        booking: result.booking,
        lifecycle: result.lifecycle
      }));
      const acceptedConflicts = result.availability.conflicts.filter((item) => item.status === "accepted").length;
      const capacityNote = result.availability.capacityExceeded
        ? ` Capacity note: projected load ${result.availability.sameVenueLoad}/${result.availability.capacityLimit}.`
        : "";
      const acceptedNote = acceptedConflicts
        ? ` Soft conflict note: ${acceptedConflicts} accepted quote(s) share this venue/date.`
        : "";
      setState((prev) => ({
        ...prev,
        feedback: `Converted ${quote.quoteNumber} to contract ${result.contractNumber}.${acceptedNote}${capacityNote}`
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to convert quote to contract."
      }));
    } finally {
      setConvertingId("");
    }
  };

  const handleConfirmationUpdate = async (quoteId, nextConfirmationStatus) => {
    setUpdatingConfirmationId(quoteId);
    setState((prev) => ({ ...prev, error: "" }));
    try {
      const result = await updateQuoteBookingConfirmation({
        quoteId,
        confirmationStatus: nextConfirmationStatus,
        actorEmail: currentUserEmail
      });
      applyQuoteLocally(quoteId, (quote) => ({
        ...quote,
        booking: result.booking
      }));
      setState((prev) => ({
        ...prev,
        feedback: `Confirmation marked ${nextConfirmationStatus}.`
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        error: err?.message || "Failed to update booking confirmation."
      }));
    } finally {
      setUpdatingConfirmationId("");
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

  const handleExportPdf = async (quote) => {
    try {
      const { exportQuoteProposal } = await import("../lib/proposalExport");
      await exportQuoteProposal(quote);
      setState((prev) => ({ ...prev, feedback: `Downloaded PDF for ${quote.quoteNumber}.` }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || "Failed to export proposal PDF." }));
    }
  };

  const handleCopyPaymentLink = async (quote) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable in this browser.");
      }
      const paymentLink = quote.payment?.depositLink;
      if (!paymentLink) {
        throw new Error("No deposit link saved for this quote.");
      }
      await navigator.clipboard.writeText(paymentLink);
      setState((prev) => ({ ...prev, feedback: `Deposit link copied for ${quote.quoteNumber}.` }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || "Failed to copy payment link." }));
    }
  };

  const handleCopyPortalLink = async (quote) => {
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard unavailable in this browser.");
      }
      if (!quote.portalKey) {
        throw new Error("No customer portal key for this quote.");
      }
      const base = basePortalUrl || `${window.location.origin}${window.location.pathname}`;
      const portalLink = `${base}?portal=${quote.portalKey}`;
      await navigator.clipboard.writeText(portalLink);
      setState((prev) => ({ ...prev, feedback: `Portal link copied for ${quote.quoteNumber}.` }));
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || "Failed to copy portal link." }));
    }
  };

  const handleCreateCheckout = async (quote) => {
    setCreatingCheckoutId(quote.id);
    setState((prev) => ({ ...prev, error: "", feedback: "" }));
    try {
      if (state.source !== "firebase") {
        throw new Error("Stripe checkout requires Firebase-backed quote storage.");
      }

      const base = basePortalUrl || `${window.location.origin}${window.location.pathname}`;
      const successUrl = quote.portalKey
        ? `${base}?portal=${encodeURIComponent(quote.portalKey)}&payment=success`
        : `${base}?payment=success`;
      const cancelUrl = quote.portalKey
        ? `${base}?portal=${encodeURIComponent(quote.portalKey)}&payment=cancelled`
        : `${base}?payment=cancelled`;

      const result = await createDepositCheckout({
        quoteId: quote.id,
        successUrl,
        cancelUrl
      });
      const paymentLink = String(result?.url || "").trim();
      if (!paymentLink) {
        throw new Error("Checkout URL was not returned.");
      }

      applyPaymentLinkLocally(quote.id, paymentLink);
      setState((prev) => ({ ...prev, feedback: `Stripe checkout created for ${quote.quoteNumber}.` }));
      window.open(paymentLink, "_blank", "noopener,noreferrer");
    } catch (err) {
      setState((prev) => ({ ...prev, error: err?.message || "Failed to create Stripe checkout." }));
    } finally {
      setCreatingCheckoutId("");
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
            <option value="booked">Booked</option>
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
                <th>Deposit</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Contract</th>
                <th>Confirm</th>
                <th>Expires</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!state.loading && filteredQuotes.length === 0 && (
                <tr>
                  <td colSpan="13">No quotes saved yet.</td>
                </tr>
              )}
              {filteredQuotes.map((quote) => {
                const statusTransitions = getAllowedStatusTransitions(quote.status).filter((status) => status !== "booked");
                const statusOptions = statusTransitions.length
                  ? statusTransitions
                  : [String(quote.status || "draft")];
                const booking = quote.booking || {};
                const contractNumber = booking.contractNumber || "";
                const confirmationStatus = booking.confirmationStatus || "pending";
                const canConvert = canConvertToContract(quote);
                const canTrackConfirmation = quote.status === "booked" && Boolean(contractNumber);
                return (
                  <tr key={quote.id}>
                    <td>{quote.quoteNumber || "-"}</td>
                    <td>{quote.customer?.name || quote.customer?.email || "-"}</td>
                    <td>{quote.event?.date || "-"}</td>
                    <td>{quote.event?.guests ?? "-"}</td>
                    <td>{currency(quote.totals?.total || 0)}</td>
                    <td>{currency(quote.totals?.deposit || 0)}</td>
                    <td>
                      <select
                        value={quote.status || "draft"}
                        onChange={(e) => handleStatusUpdate(quote.id, e.target.value)}
                        disabled={updatingId === quote.id || statusTransitions.length === 0}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={quote.payment?.depositStatus || "unpaid"}
                        onChange={(e) => handlePaymentUpdate(quote.id, e.target.value)}
                        disabled={updatingPaymentId === quote.id}
                      >
                        {PAYMENT_STATUSES.map((paymentStatus) => (
                          <option key={paymentStatus} value={paymentStatus}>{paymentStatus}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className="history-meta-stack">
                        <strong>{contractNumber || "-"}</strong>
                        <small>{fmtDate(booking.contractConvertedAtISO)}</small>
                      </div>
                    </td>
                    <td>
                      {canTrackConfirmation ? (
                        <div className="history-meta-stack">
                          <select
                            value={confirmationStatus}
                            onChange={(e) => handleConfirmationUpdate(quote.id, e.target.value)}
                            disabled={updatingConfirmationId === quote.id}
                          >
                            {BOOKING_CONFIRMATION_STATUSES.map((bookingStatus) => (
                              <option key={bookingStatus} value={bookingStatus}>{bookingStatus}</option>
                            ))}
                          </select>
                          <small>{fmtDate(booking.confirmedAtISO || booking.confirmationSentAtISO)}</small>
                        </div>
                      ) : (
                        <span className="muted">-</span>
                      )}
                    </td>
                    <td>{fmtDate(quote.expiresAtISO)}</td>
                    <td>{fmtDate(quote.createdAtISO)}</td>
                    <td>
                      <div className="row-actions">
                        {canConvert && (
                          <button
                            type="button"
                            className="cta compact"
                            onClick={() => handleConvertToContract(quote)}
                            disabled={convertingId === quote.id}
                          >
                            {convertingId === quote.id ? "Converting..." : "Convert"}
                          </button>
                        )}
                        {canTrackConfirmation && confirmationStatus !== "confirmed" && (
                          <button
                            type="button"
                            className="ghost compact"
                            onClick={() => handleConfirmationUpdate(quote.id, "confirmed")}
                            disabled={updatingConfirmationId === quote.id}
                          >
                            Confirm
                          </button>
                        )}
                        <button type="button" className="ghost compact" onClick={() => handleExportPdf(quote)}>PDF</button>
                        <button type="button" className="ghost compact" onClick={() => handleCopyEmail(quote)}>Copy Email</button>
                        <button type="button" className="ghost compact" onClick={() => handleCopyPortalLink(quote)}>Copy Portal</button>
                        <button type="button" className="ghost compact" onClick={() => handleCopyPaymentLink(quote)}>Copy Pay Link</button>
                        <button
                          type="button"
                          className="cta compact"
                          onClick={() => handleCreateCheckout(quote)}
                          disabled={creatingCheckoutId === quote.id}
                        >
                          {creatingCheckoutId === quote.id ? "Creating..." : "Create Stripe Link"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

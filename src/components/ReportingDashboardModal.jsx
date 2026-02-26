import { useEffect, useMemo, useState } from "react";
import { currency } from "../lib/quoteCalculator";
import { getQuoteHistory } from "../lib/quoteStore";

function monthKeyFromISO(iso) {
  const dt = new Date(iso || "");
  if (Number.isNaN(dt.getTime())) return "";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  const [year, month] = String(monthKey).split("-");
  const dt = new Date(Number(year), Number(month) - 1, 1);
  return dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function recentMonthKeys(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function ReportingDashboardModal({ open, onClose }) {
  const [state, setState] = useState({ loading: false, error: "", source: "", quotes: [] });

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
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err?.message || "Failed to load dashboard data."
      }));
    }
  };

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open]);

  const metrics = useMemo(() => {
    const totals = {
      quotes: state.quotes.length,
      draft: 0,
      sent: 0,
      viewed: 0,
      accepted: 0,
      declined: 0,
      expired: 0,
      quotedValue: 0,
      pipelineValue: 0,
      acceptedValue: 0
    };

    state.quotes.forEach((quote) => {
      const status = quote.status || "draft";
      const value = Number(quote.totals?.total || 0);
      totals.quotedValue += value;
      if (Object.prototype.hasOwnProperty.call(totals, status)) {
        totals[status] += 1;
      }
      if (["draft", "sent", "viewed"].includes(status)) {
        totals.pipelineValue += value;
      }
      if (status === "accepted") {
        totals.acceptedValue += value;
      }
    });

    const decisionPool = totals.accepted + totals.declined + totals.expired;
    const closeRate = decisionPool > 0 ? (totals.accepted / decisionPool) * 100 : 0;
    const conversionRate = totals.quotes > 0 ? (totals.accepted / totals.quotes) * 100 : 0;

    const monthKeys = recentMonthKeys(6);
    const months = monthKeys.map((monthKey) => ({
      monthKey,
      label: monthLabel(monthKey),
      quotes: 0,
      sent: 0,
      accepted: 0,
      acceptedValue: 0
    }));

    state.quotes.forEach((quote) => {
      const key = monthKeyFromISO(quote.createdAtISO);
      const row = months.find((item) => item.monthKey === key);
      if (!row) return;
      row.quotes += 1;
      if (["sent", "viewed", "accepted"].includes(quote.status)) {
        row.sent += 1;
      }
      if (quote.status === "accepted") {
        row.accepted += 1;
        row.acceptedValue += Number(quote.totals?.total || 0);
      }
    });

    return {
      ...totals,
      closeRate,
      conversionRate,
      months
    };
  }, [state.quotes]);

  if (!open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card dashboard-card">
        <div className="modal-head">
          <h2>Reporting Dashboard</h2>
          <div className="right-actions">
            <button type="button" className="ghost" onClick={load} disabled={state.loading}>
              {state.loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" className="ghost" onClick={onClose}>Close</button>
          </div>
        </div>

        <p className="source-note">Source: {state.source || "-"}</p>
        {state.error && <p className="error-note">{state.error}</p>}

        <div className="dashboard-grid">
          <div className="metric-card"><span>Total Quotes</span><strong>{metrics.quotes}</strong></div>
          <div className="metric-card"><span>Total Quoted</span><strong>{currency(metrics.quotedValue)}</strong></div>
          <div className="metric-card"><span>Pipeline Value</span><strong>{currency(metrics.pipelineValue)}</strong></div>
          <div className="metric-card"><span>Accepted Revenue</span><strong>{currency(metrics.acceptedValue)}</strong></div>
          <div className="metric-card"><span>Close Rate</span><strong>{metrics.closeRate.toFixed(1)}%</strong></div>
          <div className="metric-card"><span>Conversion Rate</span><strong>{metrics.conversionRate.toFixed(1)}%</strong></div>
        </div>

        <div className="status-strip">
          <span>Draft: {metrics.draft}</span>
          <span>Sent: {metrics.sent}</span>
          <span>Viewed: {metrics.viewed}</span>
          <span>Accepted: {metrics.accepted}</span>
          <span>Declined: {metrics.declined}</span>
          <span>Expired: {metrics.expired}</span>
        </div>

        <div className="history-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Quotes</th>
                <th>Sent/Viewed/Accepted</th>
                <th>Accepted</th>
                <th>Accepted Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.months.map((row) => (
                <tr key={row.monthKey}>
                  <td>{row.label}</td>
                  <td>{row.quotes}</td>
                  <td>{row.sent}</td>
                  <td>{row.accepted}</td>
                  <td>{currency(row.acceptedValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { currency } from "./quoteCalculator";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDate(iso) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString();
}

export function exportQuoteProposal(quote) {
  if (typeof window === "undefined") return;

  const popup = window.open("", "_blank", "noopener,noreferrer,width=980,height=860");
  if (!popup) {
    throw new Error("Popup blocked. Allow popups to export proposal PDFs.");
  }

  const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(quote.quoteNumber || "Quote Proposal")}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #1f2937; }
      h1,h2,h3 { margin: 0; }
      .top { display: flex; justify-content: space-between; gap: 1rem; }
      .muted { color: #6b7280; font-size: 0.9rem; }
      .card { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px; margin-top: 14px; }
      .grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; }
      .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
      .row:last-child { border-bottom: 0; }
      .totals .row strong { font-size: 1.05rem; }
      .footer { margin-top: 24px; font-size: 0.9rem; color: #374151; }
      @media print { body { margin: 16px; } }
    </style>
  </head>
  <body>
    <div class="top">
      <div>
        <h1>Tony Catering Proposal</h1>
        <p class="muted">Quote #${escapeHtml(quote.quoteNumber || "-")}</p>
      </div>
      <div style="text-align:right">
        <p class="muted">Created: ${escapeHtml(fmtDate(quote.createdAtISO))}</p>
        <p class="muted">Valid Through: ${escapeHtml(fmtDate(quote.expiresAtISO))}</p>
      </div>
    </div>

    <div class="card grid">
      <div><strong>Customer</strong><div>${escapeHtml(quote.customer?.name || "-")}</div></div>
      <div><strong>Email</strong><div>${escapeHtml(quote.customer?.email || "-")}</div></div>
      <div><strong>Event Date</strong><div>${escapeHtml(quote.event?.date || "-")}</div></div>
      <div><strong>Venue</strong><div>${escapeHtml(quote.event?.venue || "-")}</div></div>
      <div><strong>Guests</strong><div>${escapeHtml(quote.event?.guests || 0)}</div></div>
      <div><strong>Service Style</strong><div>${escapeHtml(quote.event?.style || "-")}</div></div>
    </div>

    <div class="card">
      <h3>Selections</h3>
      <div class="row"><span>Package</span><span>${escapeHtml(quote.selection?.packageName || quote.selection?.packageId || "-")}</span></div>
      <div class="row"><span>Add-ons</span><span>${escapeHtml((quote.selection?.addons || []).join(", ") || "-")}</span></div>
      <div class="row"><span>Rentals</span><span>${escapeHtml((quote.selection?.rentals || []).join(", ") || "-")}</span></div>
      <div class="row"><span>Payment Method</span><span>${escapeHtml(quote.selection?.payMethod || "-")}</span></div>
      <div class="row"><span>Deposit Link</span><span>${escapeHtml(quote.payment?.depositLink || "-")}</span></div>
    </div>

    <div class="card totals">
      <h3>Pricing</h3>
      <div class="row"><span>Base</span><span>${escapeHtml(currency(quote.totals?.base || 0))}</span></div>
      <div class="row"><span>Add-ons</span><span>${escapeHtml(currency(quote.totals?.addons || 0))}</span></div>
      <div class="row"><span>Rentals</span><span>${escapeHtml(currency(quote.totals?.rentals || 0))}</span></div>
      <div class="row"><span>Labor</span><span>${escapeHtml(currency(quote.totals?.labor || 0))}</span></div>
      <div class="row"><span>Travel</span><span>${escapeHtml(currency(quote.totals?.travel || 0))}</span></div>
      <div class="row"><span>Service Fee</span><span>${escapeHtml(currency(quote.totals?.serviceFee || 0))}</span></div>
      <div class="row"><span>Tax</span><span>${escapeHtml(currency(quote.totals?.tax || 0))}</span></div>
      <div class="row"><strong>Total</strong><strong>${escapeHtml(currency(quote.totals?.total || 0))}</strong></div>
      <div class="row"><span>Deposit</span><span>${escapeHtml(currency(quote.totals?.deposit || 0))}</span></div>
    </div>

    <p class="footer">
      Proposal generated from Tony Catering Quote Wizard.
      Use browser Save as PDF in the print dialog.
    </p>
  </body>
</html>
`;

  popup.document.open();
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  setTimeout(() => {
    popup.print();
  }, 250);
}

import { jsPDF } from "jspdf";
import { currency } from "./quoteCalculator";

function fmtDate(iso) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString();
}

function text(v) {
  return String(v ?? "-");
}

export function exportQuoteProposal(quote) {
  if (!quote) {
    throw new Error("Missing quote data for PDF export.");
  }

  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 44;
  const right = pageWidth - 44;
  const maxWidth = right - left;
  const lineGap = 17;
  const palette = {
    ink: [31, 24, 15],
    gold: [198, 145, 57],
    goldSoft: [242, 224, 184],
    text: [56, 44, 30],
    muted: [103, 87, 62],
    cream: [251, 246, 234],
    line: [214, 184, 130]
  };
  let y = 116;

  const ensureSpace = (needed = 24) => {
    if (y + needed <= pageHeight - 48) return;
    doc.addPage();
    y = 64;
  };

  const section = (label) => {
    ensureSpace(40);
    doc.setFillColor(...palette.goldSoft);
    doc.roundedRect(left, y - 14, maxWidth, 20, 6, 6, "F");
    doc.setTextColor(...palette.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(label.toUpperCase(), left + 10, y);
    y += 20;
  };

  const row = (label, value) => {
    const safeValue = text(value);
    const wrapped = doc.splitTextToSize(safeValue, maxWidth - 188);
    ensureSpace(lineGap * Math.max(1, wrapped.length) + 4);
    doc.setTextColor(...palette.muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`${label}:`, left + 2, y);
    doc.setTextColor(...palette.text);
    doc.setFont("helvetica", "normal");
    doc.text(wrapped, left + 128, y);
    y += lineGap * Math.max(1, wrapped.length);
  };

  doc.setFillColor(...palette.ink);
  doc.rect(0, 0, pageWidth, 98, "F");
  doc.setFillColor(...palette.gold);
  doc.rect(0, 88, pageWidth, 10, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text("Tony Catering Proposal", left, 46);
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Quote #${text(quote.quoteNumber)}`, left, 64);
  doc.text(`Created: ${fmtDate(quote.createdAtISO)}`, right, 46, { align: "right" });
  doc.text(`Valid Through: ${fmtDate(quote.expiresAtISO)}`, right, 64, { align: "right" });

  doc.setFillColor(...palette.cream);
  doc.roundedRect(left, y - 14, maxWidth, 38, 10, 10, "F");
  doc.setDrawColor(...palette.line);
  doc.roundedRect(left, y - 14, maxWidth, 38, 10, 10);
  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Status: ${text(quote.status || "draft")}`, left + 12, y + 4);
  doc.text(`Deposit Status: ${text(quote.payment?.depositStatus || "unpaid")}`, left + 160, y + 4);
  doc.text(`Template: ${text(quote.selection?.eventTemplateId || "custom")}`, left + 350, y + 4);
  y += 56;

  section("Client and Event");
  row("Customer", quote.customer?.name);
  row("Email", quote.customer?.email);
  row("Event Date", quote.event?.date);
  row("Start Time", quote.event?.time);
  row("Venue", quote.event?.venue);
  row("Guests", quote.event?.guests);
  row("Service Style", quote.event?.style);

  section("Selections");
  row("Package", quote.selection?.packageName || quote.selection?.packageId);
  row("Menu Selections", (quote.selection?.menuItemNames || quote.selection?.menuItems || []).join(", ") || "-");
  row("Add-ons", (quote.selection?.addons || []).join(", ") || "-");
  row("Rentals", (quote.selection?.rentals || []).join(", ") || "-");
  row("Travel (miles RT)", quote.selection?.milesRT);
  row("Tax Region", quote.totals?.taxRegionName || quote.selection?.taxRegion);
  row("Season Profile", quote.totals?.seasonProfileName || quote.selection?.seasonProfileId);
  row("Payment Method", quote.selection?.payMethod);
  row("Deposit Link", quote.payment?.depositLink || "-");

  section("Pricing");
  row("Base", currency(quote.totals?.base || 0));
  row("Add-ons", currency(quote.totals?.addons || 0));
  row("Rentals", currency(quote.totals?.rentals || 0));
  row("Menu Selections", currency(quote.totals?.menu || 0));
  row("Labor", currency(quote.totals?.labor || 0));
  row("Travel", currency(quote.totals?.travel || 0));
  row(
    `Service Fee (${Math.round(Number(quote.totals?.serviceFeePctApplied || 0) * 1000) / 10}%)`,
    currency(quote.totals?.serviceFee || 0)
  );
  row(
    `Tax (${Math.round(Number(quote.totals?.taxRateApplied || 0) * 1000) / 10}%)`,
    currency(quote.totals?.tax || 0)
  );

  ensureSpace(56);
  doc.setFillColor(...palette.goldSoft);
  doc.roundedRect(left, y - 2, maxWidth, 52, 10, 10, "F");
  doc.setDrawColor(...palette.line);
  doc.roundedRect(left, y - 2, maxWidth, 52, 10, 10);
  y += 16;
  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Estimated Total: ${currency(quote.totals?.total || 0)}`, left + 12, y);
  y += 18;
  doc.text(`Deposit Due: ${currency(quote.totals?.deposit || 0)}`, left + 12, y);

  y += 26;
  ensureSpace(20);
  doc.setTextColor(...palette.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Generated by Tony Catering Quote Wizard. Pricing subject to final menu and logistics confirmation.", left, y);

  const filename = `${text(quote.quoteNumber || "quote")}-proposal.pdf`.replace(/[^\w.-]/g, "_");
  doc.save(filename);
}

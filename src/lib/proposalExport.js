import { jsPDF } from "jspdf";
import { currency } from "./quoteCalculator";

const BRANDING = {
  title: "Tasteful Touch Catering Proposal",
  crew: "Chef Toni and Grill Master Ervin",
  logoPath: "/brand/logo.png",
  crewMembers: [
    { label: "Chef Toni", imagePath: "/brand/chef-toni.png" },
    { label: "Grill Master Ervin", imagePath: "/brand/grillmaster-irvin.png" }
  ]
};
let brandAssetsCache = null;

function fmtDate(iso) {
  if (!iso) return "-";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleDateString();
}

function text(v) {
  return String(v ?? "-");
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read image blob."));
    reader.readAsDataURL(blob);
  });
}

function resolveImageFormat(mimeType = "") {
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "JPEG";
  if (mimeType === "image/webp") return "WEBP";
  return "PNG";
}

async function loadBrandImage(path) {
  try {
    const response = await fetch(path);
    if (!response.ok) return null;
    const blob = await response.blob();
    return {
      format: resolveImageFormat(blob.type),
      dataUrl: await blobToDataUrl(blob)
    };
  } catch {
    return null;
  }
}

async function loadBrandAssets() {
  if (brandAssetsCache) {
    return brandAssetsCache;
  }
  const [logo, ...crewImages] = await Promise.all([
    loadBrandImage(BRANDING.logoPath),
    ...BRANDING.crewMembers.map((member) => loadBrandImage(member.imagePath))
  ]);
  brandAssetsCache = {
    logo,
    crewMembers: BRANDING.crewMembers.map((member, index) => ({
      ...member,
      image: crewImages[index] || null
    }))
  };
  return brandAssetsCache;
}

export async function exportQuoteProposal(quote) {
  if (!quote) {
    throw new Error("Missing quote data for PDF export.");
  }

  const brandAssets = await loadBrandAssets();
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
  const meta = quote.quoteMeta || {};
  const perPersonRate = Number(quote.event?.guests || 0) > 0 ? Number(quote.totals?.base || 0) / Number(quote.event?.guests) : 0;
  const headerHeight = 124;
  let y = headerHeight + 18;

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
  doc.rect(0, 0, pageWidth, headerHeight, "F");
  doc.setFillColor(...palette.gold);
  doc.rect(0, headerHeight - 10, pageWidth, 10, "F");

  if (brandAssets.logo) {
    doc.addImage(brandAssets.logo.dataUrl, brandAssets.logo.format, left, 18, 52, 52);
  }

  const crewChipSize = 42;
  const crewGap = 14;
  const crewBlockWidth =
    (brandAssets.crewMembers.length * crewChipSize) + ((brandAssets.crewMembers.length - 1) * crewGap);
  const crewStartX = right - crewBlockWidth;
  const crewTopY = 18;
  brandAssets.crewMembers.forEach((member, index) => {
    const chipX = crewStartX + (index * (crewChipSize + crewGap));
    doc.setFillColor(...palette.cream);
    doc.roundedRect(chipX - 2, crewTopY - 2, crewChipSize + 4, crewChipSize + 4, 8, 8, "F");
    if (member.image) {
      doc.addImage(member.image.dataUrl, member.image.format, chipX, crewTopY, crewChipSize, crewChipSize);
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(member.label, chipX + (crewChipSize / 2), crewTopY + crewChipSize + 13, { align: "center" });
  });

  const titleX = brandAssets.logo ? left + 64 : left;
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(BRANDING.title, titleX, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(BRANDING.crew, titleX, 58);
  doc.text(`Quote #${text(quote.quoteNumber)}`, titleX, 74);
  doc.text(`Created: ${fmtDate(quote.createdAtISO)}`, right, 94, { align: "right" });
  doc.text(`Valid Through: ${fmtDate(quote.expiresAtISO)}`, right, 110, { align: "right" });

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
  row("Responsible Party / Client", quote.customer?.name);
  row("Organization", quote.customer?.organization || "-");
  row("Phone", quote.customer?.phone || "-");
  row("Email", quote.customer?.email);
  row("Event Name", quote.event?.name || "-");
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
  row("Per Person", `${currency(perPersonRate)} x ${quote.event?.guests || 0} = ${currency(quote.totals?.base || 0)}`);
  row("Base", currency(quote.totals?.base || 0));
  row("Add-ons", currency(quote.totals?.addons || 0));
  row("Rentals", currency(quote.totals?.rentals || 0));
  row("Menu Selections", currency(quote.totals?.menu || 0));
  row("Staffing", currency((quote.totals?.labor || 0) - (quote.totals?.bartenderLabor || 0)));
  row("Bartender", currency(quote.totals?.bartenderLabor || 0));
  row("Travel", currency(quote.totals?.travel || 0));
  row(
    `Gratuity / Service Fee (${Math.round(Number(quote.totals?.serviceFeePctApplied || 0) * 1000) / 10}%)`,
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

  y += 20;
  ensureSpace(84);
  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(meta.disposablesNote || "All disposables are included in this quote.", left, y);
  y += 14;
  doc.text(`Quote prepared by: ${text(meta.quotePreparedBy || "-")}`, left, y);
  doc.text(`Quote is valid for ${Number(meta.quoteValidityDays || 30)} days.`, right, y, { align: "right" });
  y += 14;
  doc.text(`To accept quote, please sign and return to ${text(meta.acceptanceEmail || meta.businessEmail || "-")}`, left, y);
  y += 14;
  if (meta.depositNotice) {
    doc.setFillColor(255, 232, 77);
    doc.roundedRect(left, y - 10, maxWidth, 16, 3, 3, "F");
    doc.setTextColor(37, 25, 0);
    doc.text(meta.depositNotice, left + 4, y);
    y += 18;
  }

  y += 8;
  ensureSpace(20);
  doc.setTextColor(...palette.muted);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `${text(meta.businessAddress || "")} ${meta.businessPhone ? `  |  ${meta.businessPhone}` : ""} ${meta.businessEmail ? `  |  ${meta.businessEmail}` : ""}`.trim(),
    left,
    y
  );

  const filename = `${text(quote.quoteNumber || "quote")}-proposal.pdf`.replace(/[^\w.-]/g, "_");
  doc.save(filename);
}

import { jsPDF } from "jspdf";
import { currency } from "./quoteCalculator";
import { buildProposalPayload } from "./proposalPayload";

const BRAND_ASSET_CACHE = new Map();

function text(v) {
  return String(v ?? "-");
}

function hexToRgb(value, fallback) {
  const raw = String(value || "").trim();
  const full = /^#[\da-fA-F]{6}$/.test(raw)
    ? raw
    : /^#[\da-fA-F]{3}$/.test(raw)
      ? `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`
      : "";
  if (!full) return fallback;
  const n = Number.parseInt(full.slice(1), 16);
  if (Number.isNaN(n)) return fallback;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function resolvePalette(meta) {
  return {
    ink: [31, 24, 15],
    gold: hexToRgb(meta?.brandPrimaryColor, [198, 145, 57]),
    goldSoft: hexToRgb(meta?.brandAccentColor, [242, 224, 184]),
    text: [56, 44, 30],
    muted: [103, 87, 62],
    cream: [251, 246, 234],
    line: hexToRgb(meta?.brandDarkAccentColor, [214, 184, 130])
  };
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
  if (!path) return null;
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

async function loadBrandAssets(branding) {
  const cacheKey = JSON.stringify([
    branding.logoPath,
    ...branding.crewMembers.map((member) => member.imagePath)
  ]);
  if (BRAND_ASSET_CACHE.has(cacheKey)) {
    return BRAND_ASSET_CACHE.get(cacheKey);
  }
  const [logo, ...crewImages] = await Promise.all([
    loadBrandImage(branding.logoPath),
    ...branding.crewMembers.map((member) => loadBrandImage(member.imagePath))
  ]);
  const assets = {
    logo,
    crewMembers: branding.crewMembers.map((member, index) => ({
      ...member,
      image: crewImages[index] || null
    }))
  };
  BRAND_ASSET_CACHE.set(cacheKey, assets);
  return assets;
}

export async function exportQuoteProposal(quote) {
  if (!quote) {
    throw new Error("Missing quote data for PDF export.");
  }

  const proposal = buildProposalPayload(quote);
  const { branding, meta } = proposal;
  const brandAssets = await loadBrandAssets(branding);
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const left = 44;
  const right = pageWidth - 44;
  const maxWidth = right - left;
  const lineGap = 17;
  const palette = resolvePalette(meta);
  const showDisposablesNote = meta.includeDisposables !== false;
  const perPersonRate = proposal.event.guests > 0 ? proposal.totals.base / proposal.event.guests : 0;
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
  const crewCount = brandAssets.crewMembers.length;
  const crewBlockWidth =
    crewCount > 0 ? (crewCount * crewChipSize) + ((crewCount - 1) * crewGap) : 0;
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
  doc.text(branding.title, titleX, 42);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(branding.brandTagline, titleX, 58);
  doc.text(`Quote #${text(proposal.quoteNumber)}`, titleX, 74);
  doc.text(`Created: ${proposal.createdOn}`, right, 94, { align: "right" });
  doc.text(`Valid Through: ${proposal.expiresOn}`, right, 110, { align: "right" });

  doc.setFillColor(...palette.cream);
  doc.roundedRect(left, y - 14, maxWidth, 38, 10, 10, "F");
  doc.setDrawColor(...palette.line);
  doc.roundedRect(left, y - 14, maxWidth, 38, 10, 10);
  doc.setTextColor(...palette.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Status: ${text(proposal.status || "draft")}`, left + 12, y + 4);
  doc.text(`Deposit Status: ${text(proposal.payment.depositStatus || "unpaid")}`, left + 160, y + 4);
  doc.text(`Template: ${text(proposal.selection.eventTemplateId || "custom")}`, left + 350, y + 4);
  y += 56;

  section("Client and Event");
  row("Responsible Party / Client", proposal.customer.name);
  row("Organization", proposal.customer.organization || "-");
  row("Phone", proposal.customer.phone || "-");
  row("Email", proposal.customer.email);
  row("Event Name", proposal.event.name || "-");
  row("Event Date", proposal.event.date);
  row("Start Time", proposal.event.time);
  row("Venue", proposal.event.venue);
  row("Venue Address", proposal.event.venueAddress || "-");
  row("Guests", proposal.event.guests);
  row("Service Style", proposal.event.style);

  section("Selections");
  row("Package", proposal.selection.packageName || proposal.selection.packageId);
  row(
    "Menu Selections",
    (proposal.selection.menuItemNames.length ? proposal.selection.menuItemNames : proposal.selection.menuItems).join(", ") || "-"
  );
  row("Add-ons", proposal.selection.addons.join(", ") || "-");
  row("Rentals", proposal.selection.rentals.join(", ") || "-");
  row("Travel (miles RT)", proposal.selection.milesRT);
  row("Tax Region", proposal.totals.taxRegionName || proposal.selection.taxRegion);
  row("Season Profile", proposal.totals.seasonProfileName || proposal.selection.seasonProfileId);
  row("Payment Method", proposal.selection.payMethod);
  row("Deposit Link", proposal.payment.depositLink || "-");

  section("Pricing");
  row("Per Person", `${currency(perPersonRate)} x ${proposal.event.guests || 0} = ${currency(proposal.totals.base || 0)}`);
  row("Base", currency(proposal.totals.base || 0));
  row("Add-ons", currency(proposal.totals.addons || 0));
  row("Rentals", currency(proposal.totals.rentals || 0));
  row("Menu Selections", currency(proposal.totals.menu || 0));
  row("Staffing", currency((proposal.totals.labor || 0) - (proposal.totals.bartenderLabor || 0)));
  row("Bartender", currency(proposal.totals.bartenderLabor || 0));
  row("Travel", currency(proposal.totals.travel || 0));
  row(
    `Gratuity / Service Fee (${Math.round(Number(proposal.totals.serviceFeePctApplied || 0) * 1000) / 10}%)`,
    currency(proposal.totals.serviceFee || 0)
  );
  row(
    `Tax (${Math.round(Number(proposal.totals.taxRateApplied || 0) * 1000) / 10}%)`,
    currency(proposal.totals.tax || 0)
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
  doc.text(`Estimated Total: ${currency(proposal.totals.total || 0)}`, left + 12, y);
  y += 18;
  doc.text(`Deposit Due: ${currency(proposal.totals.deposit || 0)}`, left + 12, y);

  y += 20;
  ensureSpace(84);
  if (showDisposablesNote) {
    doc.setTextColor(...palette.text);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(meta.disposablesNote || "All disposables are included in this quote.", left, y);
    y += 14;
  }
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

  const filename = `${text(proposal.quoteNumber || "quote")}-proposal.pdf`.replace(/[^\w.-]/g, "_");
  doc.save(filename);
}

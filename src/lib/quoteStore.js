import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { db, firebaseReady } from "./firebase";

const LOCAL_QUOTES_KEY = "quoteWizard.quotes";
const DEFAULT_VALIDITY_DAYS = 30;
const EXPIRABLE_STATUSES = new Set(["draft", "sent", "viewed"]);
const PAYMENT_STATUSES = ["unpaid", "sent", "paid", "refunded"];
const STATUS_LIFECYCLE_FIELD = {
  draft: "draftAtISO",
  sent: "sentAtISO",
  viewed: "viewedAtISO",
  accepted: "acceptedAtISO",
  declined: "declinedAtISO",
  expired: "expiredAtISO"
};
const STATUS_FLOW = {
  draft: ["draft", "sent", "declined", "expired"],
  sent: ["sent", "viewed", "accepted", "declined", "expired"],
  viewed: ["viewed", "accepted", "declined", "expired"],
  accepted: ["accepted"],
  declined: ["declined"],
  expired: ["expired", "draft", "sent"]
};

export const QUOTE_STATUSES = Object.keys(STATUS_FLOW);
export { PAYMENT_STATUSES };

function toCurrency(value) {
  return `$${(Math.round(Number(value || 0) * 100) / 100).toFixed(2)}`;
}

function isoNow() {
  return new Date().toISOString();
}

function addDaysISO(baseISO, days) {
  const base = parseSafe(baseISO, isoNow());
  base.setDate(base.getDate() + Math.max(1, Number(days || DEFAULT_VALIDITY_DAYS)));
  return base.toISOString();
}

function parseSafe(input, fallback) {
  const dt = new Date(input);
  return Number.isNaN(dt.getTime()) ? new Date(fallback) : dt;
}

function buildQuoteNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `Q-${yy}${mm}${dd}-${suffix}`;
}

function sortQuotesDesc(items) {
  return [...items].sort((a, b) => {
    const aTs = new Date(a.createdAtISO || a.createdAt || 0).getTime();
    const bTs = new Date(b.createdAtISO || b.createdAt || 0).getTime();
    return bTs - aTs;
  });
}

function normalizeStatus(status) {
  return QUOTE_STATUSES.includes(status) ? status : "draft";
}

function normalizePaymentStatus(status) {
  return PAYMENT_STATUSES.includes(status) ? status : "unpaid";
}

function hydratePayment(payment) {
  const payload = payment || {};
  const depositLink = (payload.depositLink || "").trim();
  const defaultStatus = depositLink ? "sent" : "unpaid";
  return {
    ...payload,
    depositLink,
    depositStatus: normalizePaymentStatus(payload.depositStatus || defaultStatus),
    depositConfirmedAtISO: payload.depositConfirmedAtISO || ""
  };
}

function hydrateQuote(item, nowISO = isoNow()) {
  const createdAtISO = item.createdAtISO || nowISO;
  const expiresAtISO = item.expiresAtISO || addDaysISO(createdAtISO, DEFAULT_VALIDITY_DAYS);
  const status = normalizeStatus(item.status);
  return {
    ...item,
    status,
    createdAtISO,
    expiresAtISO,
    payment: hydratePayment(item.payment),
    lifecycle: {
      ...(item.lifecycle || {})
    }
  };
}

function applyExpiry(quote, nowISO = isoNow()) {
  if (!EXPIRABLE_STATUSES.has(quote.status)) return quote;
  const expiresAt = parseSafe(quote.expiresAtISO, nowISO);
  const now = parseSafe(nowISO, nowISO);
  if (expiresAt.getTime() >= now.getTime()) return quote;
  return {
    ...quote,
    status: "expired",
    lifecycle: {
      ...(quote.lifecycle || {}),
      expiredAtISO: quote.lifecycle?.expiredAtISO || nowISO
    }
  };
}

function lifecyclePatch(status, nowISO) {
  const key = STATUS_LIFECYCLE_FIELD[status];
  if (!key) return {};
  return {
    [`lifecycle.${key}`]: nowISO
  };
}

function resolveMenuItemDetails(menuItemIds, settings) {
  const selected = new Set(Array.isArray(menuItemIds) ? menuItemIds : []);
  if (!selected.size) return [];

  const sections = Array.isArray(settings?.menuSections) ? settings.menuSections : [];
  const details = [];
  sections.forEach((section) => {
    (section.items || []).forEach((item) => {
      if (selected.has(item.id)) {
        details.push({
          id: item.id,
          name: item.name,
          type: item.type || "per_event",
          price: Number(item.price || 0)
        });
      }
    });
  });
  return details;
}

export function getAllowedStatusTransitions(status) {
  const normalized = normalizeStatus(status);
  return STATUS_FLOW[normalized] || STATUS_FLOW.draft;
}

export async function submitQuote({ form, totals, catalogSource, settings }) {
  const nowISO = isoNow();
  const quoteNumber = buildQuoteNumber();
  const validityDays = Math.max(1, Number(settings?.quoteValidityDays || DEFAULT_VALIDITY_DAYS));
  const expiresAtISO = addDaysISO(nowISO, validityDays);
  const menuItems = Array.isArray(form.menuItems) ? form.menuItems : [];
  const menuItemDetails = resolveMenuItemDetails(menuItems, settings);
  const menuItemNames = menuItemDetails.map((item) => item.name);
  const payload = {
    quoteNumber,
    customer: {
      name: form.name || "",
      email: form.email || "",
      phone: form.phone || "",
      organization: form.clientOrg || ""
    },
    event: {
      name: form.eventName || "",
      date: form.date || "",
      time: form.time || "",
      venue: form.venue || "",
      guests: Number(form.guests || 0),
      hours: Number(form.hours || 0),
      bartenders: Number(form.bartenders || 0),
      style: form.style || ""
    },
    selection: {
      packageId: form.pkg,
      packageName: totals.selectedPkg?.name || "",
      addons: form.addons,
      rentals: form.rentals,
      menuItems,
      menuItemNames,
      menuItemDetails,
      milesRT: Number(form.milesRT || 0),
      payMethod: form.payMethod,
      eventTemplateId: form.eventTemplateId || "custom",
      taxRegion: form.taxRegion || settings?.defaultTaxRegion || "",
      seasonProfileId: form.seasonProfileId || settings?.defaultSeasonProfile || "auto"
    },
    payment: {
      depositLink: (form.depositLink || "").trim(),
      depositStatus: form.depositLink ? "sent" : "unpaid",
      depositConfirmedAtISO: ""
    },
    totals: {
      base: totals.base,
      addons: totals.addons,
      rentals: totals.rentals,
      menu: totals.menu,
      labor: totals.labor,
      bartenderLabor: totals.bartenderLabor,
      travel: totals.travel,
      serviceFee: totals.serviceFee,
      tax: totals.tax,
      total: totals.total,
      deposit: totals.deposit,
      serviceFeePctApplied: totals.serviceFeePctApplied,
      taxRateApplied: totals.taxRateApplied,
      taxRegionId: totals.taxRegionId,
      taxRegionName: totals.taxRegionName,
      seasonProfileId: totals.seasonProfileId,
      seasonProfileName: totals.seasonProfileName,
      packageMultiplier: totals.packageMultiplier,
      addonMultiplier: totals.addonMultiplier,
      rentalMultiplier: totals.rentalMultiplier
    },
    quoteMeta: {
      quotePreparedBy: settings?.quotePreparedBy || "",
      businessPhone: settings?.businessPhone || "",
      businessEmail: settings?.businessEmail || "",
      businessAddress: settings?.businessAddress || "",
      acceptanceEmail: settings?.acceptanceEmail || "",
      disposablesNote: settings?.disposablesNote || "",
      depositNotice: settings?.depositNotice || "",
      quoteValidityDays: Number(settings?.quoteValidityDays || DEFAULT_VALIDITY_DAYS)
    },
    status: "draft",
    source: catalogSource,
    createdAtISO: nowISO,
    expiresAtISO,
    lifecycle: {
      draftAtISO: nowISO
    }
  };

  if (firebaseReady) {
    const ref = await addDoc(collection(db, "quotes"), {
      ...payload,
      createdAt: serverTimestamp()
    });
    return { id: ref.id, quoteNumber, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  existing.unshift({ id: crypto.randomUUID(), ...payload });
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(existing));
  return { id: existing[0].id, quoteNumber, storage: "local" };
}

export async function getQuoteHistory() {
  const nowISO = isoNow();
  if (firebaseReady) {
    const snap = await getDocs(query(collection(db, "quotes"), orderBy("createdAt", "desc")));
    const quotes = snap.docs.map((docSnap) => {
      const data = docSnap.data();
      const createdAtISO = data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAtISO;
      return hydrateQuote(
        {
          id: docSnap.id,
          ...data,
          createdAtISO: createdAtISO || nowISO
        },
        nowISO
      );
    });

    const nextQuotes = quotes.map((quote) => applyExpiry(quote, nowISO));
    const autoExpired = nextQuotes.filter(
      (quote, idx) => quote.status === "expired" && quotes[idx].status !== "expired"
    );

    if (autoExpired.length) {
      await Promise.all(
        autoExpired.map((quote) =>
          updateDoc(doc(db, "quotes", quote.id), {
            status: "expired",
            updatedAtISO: nowISO,
            "lifecycle.expiredAtISO": quote.lifecycle?.expiredAtISO || nowISO
          })
        )
      );
    }

    return {
      source: "firebase",
      quotes: nextQuotes
    };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const hydrated = sortQuotesDesc(existing).map((quote) => hydrateQuote(quote, nowISO));
  const nextQuotes = hydrated.map((quote) => applyExpiry(quote, nowISO));

  const changed = nextQuotes.some((quote, idx) => quote.status !== hydrated[idx].status);
  if (changed) {
    localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(nextQuotes));
  }

  return {
    source: "local",
    quotes: nextQuotes
  };
}

export async function updateQuoteStatus(quoteId, status) {
  if (!quoteId) {
    throw new Error("Quote id is required.");
  }

  const nowISO = isoNow();
  const nextStatus = normalizeStatus(status);

  if (firebaseReady) {
    await updateDoc(doc(db, "quotes", quoteId), {
      status: nextStatus,
      updatedAtISO: nowISO,
      ...lifecyclePatch(nextStatus, nowISO)
    });
    return { ok: true, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const next = existing.map((quote) => {
    if (quote.id !== quoteId) return quote;
    return {
      ...quote,
      status: nextStatus,
      updatedAtISO: nowISO,
      lifecycle: {
        ...(quote.lifecycle || {}),
        [STATUS_LIFECYCLE_FIELD[nextStatus]]: nowISO
      }
    };
  });
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return { ok: true, storage: "local" };
}

export async function updateQuotePaymentStatus(quoteId, paymentStatus) {
  if (!quoteId) {
    throw new Error("Quote id is required.");
  }

  const nowISO = isoNow();
  const nextPaymentStatus = normalizePaymentStatus(paymentStatus);
  const paymentPatch = {
    "payment.depositStatus": nextPaymentStatus,
    updatedAtISO: nowISO
  };

  if (nextPaymentStatus === "paid") {
    paymentPatch["payment.depositConfirmedAtISO"] = nowISO;
  }
  if (nextPaymentStatus === "unpaid" || nextPaymentStatus === "sent") {
    paymentPatch["payment.depositConfirmedAtISO"] = "";
  }

  if (firebaseReady) {
    await updateDoc(doc(db, "quotes", quoteId), paymentPatch);
    return { ok: true, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const next = existing.map((quote) => {
    if (quote.id !== quoteId) return quote;
    const payment = hydratePayment(quote.payment);
    return {
      ...quote,
      updatedAtISO: nowISO,
      payment: {
        ...payment,
        depositStatus: nextPaymentStatus,
        depositConfirmedAtISO:
          nextPaymentStatus === "paid"
            ? nowISO
            : nextPaymentStatus === "unpaid" || nextPaymentStatus === "sent"
              ? ""
              : payment.depositConfirmedAtISO || ""
      }
    };
  });

  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return { ok: true, storage: "local" };
}

export function buildQuoteEmailTemplate(quote) {
  const customerName = quote.customer?.name || "there";
  const eventDate = quote.event?.date || "your event date";
  const eventName = quote.event?.name || "your event";
  const venue = quote.event?.venue || "your venue";
  const quoteNumber = quote.quoteNumber || "your quote";
  const total = toCurrency(quote.totals?.total || 0);
  const deposit = toCurrency(quote.totals?.deposit || 0);
  const paymentLink = quote.payment?.depositLink || "";
  const expiresOn = quote.expiresAtISO ? new Date(quote.expiresAtISO).toLocaleDateString() : "";
  const paymentStatus = quote.payment?.depositStatus || "unpaid";

  const subject = `Catering Quote ${quoteNumber} - ${eventDate}`;
  const bodyLines = [
    `Hi ${customerName},`,
    "",
    `Thank you for considering us for ${eventName} on ${eventDate} at ${venue}.`,
    `Your quote (${quoteNumber}) total is ${total}.`,
    `To reserve your date, the deposit due is ${deposit}.`,
    paymentLink ? `Deposit payment link: ${paymentLink}` : "Reply to this email if you need a payment link.",
    `Deposit status: ${paymentStatus}.`,
    expiresOn ? `This quote is valid through ${expiresOn}.` : "",
    "",
    "Please reply with any questions or requested adjustments.",
    "",
    "Tony Catering"
  ].filter(Boolean);

  return {
    subject,
    body: bodyLines.join("\n")
  };
}

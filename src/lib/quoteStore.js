import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db, firebaseReady } from "./firebase";
import { buildQuoteEmailPayload } from "./proposalPayload";

const LOCAL_QUOTES_KEY = "quoteWizard.quotes";
const PORTAL_COLLECTION = "customerPortalQuotes";
const DEFAULT_VALIDITY_DAYS = 30;
const EXPIRABLE_STATUSES = new Set(["draft", "sent", "viewed"]);
const AVAILABILITY_CONFLICT_STATUSES = new Set(["accepted", "booked"]);
const PAYMENT_STATUSES = ["unpaid", "sent", "paid", "refunded"];
const BOOKING_CONFIRMATION_STATUSES = ["pending", "sent", "confirmed", "cancelled"];
const INTEGRATION_PROVIDER_SET = new Set(["crm"]);
const INTEGRATION_STATE_SET = new Set(["queued", "success", "error", "retrying", "skipped"]);
const STATUS_LIFECYCLE_FIELD = {
  draft: "draftAtISO",
  sent: "sentAtISO",
  viewed: "viewedAtISO",
  accepted: "acceptedAtISO",
  booked: "bookedAtISO",
  declined: "declinedAtISO",
  expired: "expiredAtISO"
};
const STATUS_FLOW = {
  draft: ["draft", "sent", "declined", "expired"],
  sent: ["sent", "viewed", "accepted", "declined", "expired"],
  viewed: ["viewed", "accepted", "declined", "expired"],
  accepted: ["accepted", "booked", "declined"],
  booked: ["booked"],
  declined: ["declined"],
  expired: ["expired", "draft", "sent"]
};

export const QUOTE_STATUSES = Object.keys(STATUS_FLOW);
export { PAYMENT_STATUSES, BOOKING_CONFIRMATION_STATUSES };

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

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeVenueKey(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function parseTimeToMinutes(value) {
  const text = String(value || "").trim();
  if (!/^\d{1,2}:\d{2}$/.test(text)) return null;
  const [hRaw, mRaw] = text.split(":");
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return (h * 60) + m;
}

function toTimeWindow(time, hours) {
  const start = parseTimeToMinutes(time);
  const durationMin = Math.round(toNumber(hours, 0) * 60);
  if (start === null || durationMin <= 0) return null;
  return {
    start,
    end: start + durationMin
  };
}

function windowsOverlap(a, b) {
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

function normalizeIntegrationProvider(value) {
  const provider = String(value || "").trim().toLowerCase();
  return INTEGRATION_PROVIDER_SET.has(provider) ? provider : "crm";
}

function normalizeIntegrationState(value) {
  const state = String(value || "").trim().toLowerCase();
  return INTEGRATION_STATE_SET.has(state) ? state : "queued";
}

function buildIntegrationLogEntry({
  provider = "crm",
  direction = "push",
  state = "queued",
  message = "",
  actorEmail = "",
  attempt = 1,
  payloadRef = ""
} = {}) {
  const nowISO = isoNow();
  return {
    id: buildPortalKey(),
    provider: normalizeIntegrationProvider(provider),
    direction: direction === "pull" ? "pull" : "push",
    state: normalizeIntegrationState(state),
    message: String(message || "").trim(),
    actorEmail: normalizeEmail(actorEmail),
    attempt: Math.max(1, Math.round(toNumber(attempt, 1))),
    payloadRef: String(payloadRef || "").trim(),
    occurredAtISO: nowISO
  };
}

function buildPortalKey() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
}

function timestampToISO(value, fallback = isoNow()) {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  if (typeof value?.toDate === "function") {
    return value.toDate().toISOString();
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString();
}

function lifecycleObject(status, nowISO, previous = {}) {
  const key = STATUS_LIFECYCLE_FIELD[status];
  if (!key) return { ...(previous || {}) };
  return {
    ...(previous || {}),
    [key]: nowISO
  };
}

function buildPortalSnapshot(quoteId, quote) {
  const createdAtISO = timestampToISO(quote.createdAtISO || quote.createdAt, isoNow());
  return {
    quoteId,
    portalKey: quote.portalKey || "",
    quoteNumber: quote.quoteNumber || "",
    customerName: quote.customer?.name || "",
    customerEmail: quote.customer?.email || "",
    eventName: quote.event?.name || "",
    eventDate: quote.event?.date || "",
    venue: quote.event?.venue || "",
    total: Number(quote.totals?.total || 0),
    deposit: Number(quote.totals?.deposit || 0),
    status: normalizeStatus(quote.status),
    expiresAtISO: quote.expiresAtISO || addDaysISO(createdAtISO, DEFAULT_VALIDITY_DAYS),
    payment: hydratePayment(quote.payment),
    booking: hydrateBooking(quote.booking),
    lifecycle: {
      ...(quote.lifecycle || {})
    },
    createdAtISO,
    updatedAtISO: quote.updatedAtISO || createdAtISO
  };
}

async function syncPortalSnapshotFromQuoteDoc(quoteId) {
  if (!firebaseReady || !db || !quoteId) return;
  const quoteSnap = await getDoc(doc(db, "quotes", quoteId));
  if (!quoteSnap.exists()) return;
  const data = quoteSnap.data();
  const portalKey = data.portalKey;
  if (!portalKey) return;
  await setDoc(
    doc(db, PORTAL_COLLECTION, portalKey),
    buildPortalSnapshot(quoteId, {
      ...data,
      createdAtISO: timestampToISO(data.createdAtISO || data.createdAt)
    }),
    { merge: true }
  );
}

function buildQuoteNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const suffix = Math.floor(10000 + Math.random() * 90000);
  return `Q-${yy}${mm}${dd}-${hh}${min}-${suffix}`;
}

function buildContractNumber() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const serial = String(Math.floor(Math.random() * 100000)).padStart(5, "0");
  return `C-${yy}${mm}${dd}-${serial}`;
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

function normalizeBookingConfirmationStatus(status) {
  return BOOKING_CONFIRMATION_STATUSES.includes(status) ? status : "pending";
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

function hydrateBooking(booking) {
  const payload = booking || {};
  const sentAtISO = payload.confirmationSentAtISO || "";
  const confirmedAtISO = payload.confirmedAtISO || "";
  const inferredStatus = confirmedAtISO ? "confirmed" : sentAtISO ? "sent" : "pending";
  const confirmationStatus = normalizeBookingConfirmationStatus(payload.confirmationStatus || inferredStatus);
  return {
    ...payload,
    bookedAtISO: payload.bookedAtISO || "",
    bookedByEmail: normalizeEmail(payload.bookedByEmail),
    staffLead: String(payload.staffLead || "").trim(),
    staffAssignedAtISO: payload.staffAssignedAtISO || "",
    contractNumber: String(payload.contractNumber || "").trim(),
    contractConvertedAtISO: payload.contractConvertedAtISO || "",
    contractConvertedByEmail: normalizeEmail(payload.contractConvertedByEmail),
    confirmationStatus,
    confirmationSentAtISO: sentAtISO,
    confirmedAtISO,
    confirmationUpdatedByEmail: normalizeEmail(payload.confirmationUpdatedByEmail),
    availabilityCheckedAtISO: payload.availabilityCheckedAtISO || "",
    availabilitySummary:
      payload.availabilitySummary && typeof payload.availabilitySummary === "object"
        ? { ...payload.availabilitySummary }
        : {}
  };
}

function hydrateQuote(item, nowISO = isoNow()) {
  const createdAtISO = item.createdAtISO || nowISO;
  const expiresAtISO = item.expiresAtISO || addDaysISO(createdAtISO, DEFAULT_VALIDITY_DAYS);
  const status = normalizeStatus(item.status);
  const integrationPayload = item.integrations || {};
  const integrationLogs = Array.isArray(integrationPayload.logs) ? integrationPayload.logs : [];
  return {
    ...item,
    status,
    createdAtISO,
    expiresAtISO,
    payment: hydratePayment(item.payment),
    booking: hydrateBooking(item.booking),
    integrations: {
      ...integrationPayload,
      logs: integrationLogs
    },
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

export async function checkEventAvailability({
  eventDate = "",
  venue = "",
  eventTime = "",
  eventHours = 0,
  eventGuests = 0,
  capacityLimit = 400,
  excludeQuoteId = ""
} = {}) {
  const date = String(eventDate || "").trim();
  if (!date) {
    return { conflicts: [], hasBlockingConflict: false };
  }

  const venueKey = normalizeVenueKey(venue);
  const inputWindow = toTimeWindow(eventTime, eventHours);
  const guestCount = Math.max(0, toNumber(eventGuests, 0));
  const maxCapacity = Math.max(1, toNumber(capacityLimit, 400));
  const { quotes } = await getQuoteHistory();
  const candidateConflicts = quotes
    .filter((quote) => quote.id !== excludeQuoteId)
    .filter((quote) => AVAILABILITY_CONFLICT_STATUSES.has(normalizeStatus(quote.status)))
    .filter((quote) => String(quote.event?.date || "").trim() === date)
    .filter((quote) => {
      if (!venueKey) return true;
      return normalizeVenueKey(quote.event?.venue) === venueKey;
    })
    .map((quote) => {
      const status = normalizeStatus(quote.status);
      const otherWindow = toTimeWindow(quote.event?.time, quote.event?.hours);
      let reason = "same_day_venue";
      if (inputWindow && otherWindow) {
        reason = windowsOverlap(inputWindow, otherWindow) ? "time_overlap" : "time_clear";
      } else if (inputWindow || otherWindow) {
        reason = "time_unknown";
      }
      return {
        id: quote.id,
        quoteNumber: quote.quoteNumber || "",
        status,
        eventName: quote.event?.name || "",
        eventDate: quote.event?.date || "",
        eventTime: quote.event?.time || "",
        eventHours: toNumber(quote.event?.hours, 0),
        venue: quote.event?.venue || "",
        customerName: quote.customer?.name || "",
        guests: Math.max(0, toNumber(quote.event?.guests, 0)),
        reason
      };
    })
    .filter((item) => item.reason !== "time_clear");

  const sameVenueLoad = venueKey
    ? candidateConflicts.reduce((sum, item) => sum + item.guests, 0) + guestCount
    : 0;
  const capacityExceeded = Boolean(venueKey) && sameVenueLoad > maxCapacity;

  const conflicts = candidateConflicts.map((item) => ({
    ...item,
    capacityExceeded
  }));

  return {
    conflicts,
    hasBlockingConflict: conflicts.some((item) => item.status === "booked"),
    capacityExceeded,
    capacityLimit: maxCapacity,
    sameVenueLoad
  };
}

function buildAvailabilitySummary(availability) {
  const conflicts = Array.isArray(availability?.conflicts) ? availability.conflicts : [];
  const acceptedConflicts = conflicts.filter((item) => item.status === "accepted").length;
  const bookedConflicts = conflicts.filter((item) => item.status === "booked").length;
  return {
    conflictCount: conflicts.length,
    acceptedConflictCount: acceptedConflicts,
    bookedConflictCount: bookedConflicts,
    capacityExceeded: Boolean(availability?.capacityExceeded),
    sameVenueLoad: Math.max(0, toNumber(availability?.sameVenueLoad, 0)),
    capacityLimit: Math.max(1, toNumber(availability?.capacityLimit, 400))
  };
}

function buildBlockingAvailabilityError(availability) {
  const conflicts = Array.isArray(availability?.conflicts) ? availability.conflicts : [];
  const refs = conflicts
    .filter((item) => item.status === "booked")
    .slice(0, 3)
    .map((item) => item.quoteNumber || item.id)
    .filter(Boolean);
  const suffix = refs.length ? ` Existing booking(s): ${refs.join(", ")}.` : "";
  return `Booking blocked: another contract is already booked for this date/venue.${suffix}`;
}

function ensureConvertibleQuote(quote) {
  const status = normalizeStatus(quote?.status);
  const hasContract = Boolean(String(quote?.booking?.contractNumber || "").trim());
  if (status === "accepted") return;
  if (status === "booked" && !hasContract) return;
  if (status === "booked" && hasContract) {
    throw new Error("This quote is already converted to a contract.");
  }
  throw new Error("Only accepted quotes can be converted to a contract.");
}

async function readQuoteById(quoteId) {
  const id = String(quoteId || "").trim();
  if (!id) {
    throw new Error("Quote id is required.");
  }

  const nowISO = isoNow();
  if (firebaseReady) {
    const quoteSnap = await getDoc(doc(db, "quotes", id));
    if (!quoteSnap.exists()) {
      throw new Error("Quote not found.");
    }
    const data = quoteSnap.data();
    const createdAtISO = timestampToISO(data.createdAtISO || data.createdAt, nowISO);
    return hydrateQuote(
      {
        id,
        ...data,
        createdAtISO
      },
      nowISO
    );
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const match = existing.find((quote) => quote.id === id);
  if (!match) {
    throw new Error("Quote not found.");
  }
  return hydrateQuote(match, nowISO);
}

export async function convertQuoteToContract({
  quoteId,
  actorEmail = "",
  capacityLimit = 400
} = {}) {
  const id = String(quoteId || "").trim();
  if (!id) {
    throw new Error("Quote id is required.");
  }

  const quote = await readQuoteById(id);
  ensureConvertibleQuote(quote);

  const availability = await checkEventAvailability({
    eventDate: quote.event?.date,
    venue: quote.event?.venue,
    eventTime: quote.event?.time,
    eventHours: quote.event?.hours,
    eventGuests: quote.event?.guests,
    capacityLimit,
    excludeQuoteId: id
  });
  if (availability.hasBlockingConflict) {
    throw new Error(buildBlockingAvailabilityError(availability));
  }

  const nowISO = isoNow();
  const actor = normalizeEmail(actorEmail);
  const currentBooking = hydrateBooking(quote.booking);
  const contractNumber = currentBooking.contractNumber || buildContractNumber();
  const nextLifecycle = lifecycleObject("booked", nowISO, quote.lifecycle);
  const nextBooking = {
    ...currentBooking,
    bookedAtISO: currentBooking.bookedAtISO || nowISO,
    bookedByEmail: currentBooking.bookedByEmail || actor,
    contractNumber,
    contractConvertedAtISO: currentBooking.contractConvertedAtISO || nowISO,
    contractConvertedByEmail: actor || currentBooking.contractConvertedByEmail,
    confirmationStatus: normalizeBookingConfirmationStatus(currentBooking.confirmationStatus || "pending"),
    availabilityCheckedAtISO: nowISO,
    availabilitySummary: buildAvailabilitySummary(availability)
  };

  if (firebaseReady) {
    await updateDoc(doc(db, "quotes", id), {
      status: "booked",
      booking: nextBooking,
      lifecycle: nextLifecycle,
      updatedAtISO: nowISO
    });
    await syncPortalSnapshotFromQuoteDoc(id);
    return {
      ok: true,
      storage: "firebase",
      status: "booked",
      booking: nextBooking,
      lifecycle: nextLifecycle,
      contractNumber,
      availability
    };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  let found = false;
  const next = existing.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return {
      ...item,
      status: "booked",
      booking: nextBooking,
      lifecycle: nextLifecycle,
      updatedAtISO: nowISO
    };
  });
  if (!found) {
    throw new Error("Quote not found.");
  }
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return {
    ok: true,
    storage: "local",
    status: "booked",
    booking: nextBooking,
    lifecycle: nextLifecycle,
    contractNumber,
    availability
  };
}

export async function updateQuoteBookingConfirmation({
  quoteId,
  confirmationStatus = "pending",
  actorEmail = ""
} = {}) {
  const id = String(quoteId || "").trim();
  if (!id) {
    throw new Error("Quote id is required.");
  }

  const quote = await readQuoteById(id);
  if (normalizeStatus(quote.status) !== "booked") {
    throw new Error("Quote must be booked before confirmation can be tracked.");
  }
  const booking = hydrateBooking(quote.booking);
  if (!booking.contractNumber) {
    throw new Error("Convert this quote to a contract before tracking confirmation.");
  }

  const nowISO = isoNow();
  const actor = normalizeEmail(actorEmail);
  const nextStatus = normalizeBookingConfirmationStatus(confirmationStatus);
  const nextBooking = {
    ...booking,
    confirmationStatus: nextStatus,
    confirmationUpdatedByEmail: actor || booking.confirmationUpdatedByEmail
  };

  if (nextStatus === "pending") {
    nextBooking.confirmationSentAtISO = "";
    nextBooking.confirmedAtISO = "";
  }
  if (nextStatus === "sent") {
    nextBooking.confirmationSentAtISO = nowISO;
    nextBooking.confirmedAtISO = "";
  }
  if (nextStatus === "confirmed") {
    nextBooking.confirmationSentAtISO = booking.confirmationSentAtISO || nowISO;
    nextBooking.confirmedAtISO = nowISO;
  }
  if (nextStatus === "cancelled") {
    nextBooking.confirmedAtISO = "";
  }

  if (firebaseReady) {
    await updateDoc(doc(db, "quotes", id), {
      booking: nextBooking,
      updatedAtISO: nowISO
    });
    await syncPortalSnapshotFromQuoteDoc(id);
    return { ok: true, storage: "firebase", booking: nextBooking };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  let found = false;
  const next = existing.map((item) => {
    if (item.id !== id) return item;
    found = true;
    return {
      ...item,
      booking: nextBooking,
      updatedAtISO: nowISO
    };
  });
  if (!found) {
    throw new Error("Quote not found.");
  }
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return { ok: true, storage: "local", booking: nextBooking };
}

export async function recordQuoteIntegrationSync({
  quoteId,
  provider = "crm",
  direction = "push",
  state = "queued",
  message = "",
  actorEmail = "",
  attempt = 1,
  payloadRef = ""
} = {}) {
  const id = String(quoteId || "").trim();
  if (!id) {
    throw new Error("Quote id is required.");
  }

  const entry = buildIntegrationLogEntry({
    provider,
    direction,
    state,
    message,
    actorEmail,
    attempt,
    payloadRef
  });

  if (firebaseReady) {
    const quoteRef = doc(db, "quotes", id);
    const quoteSnap = await getDoc(quoteRef);
    if (!quoteSnap.exists()) {
      throw new Error("Quote not found.");
    }
    const data = quoteSnap.data();
    const current = data.integrations || {};
    const existingLogs = Array.isArray(current.logs) ? current.logs : [];
    const retention = Math.max(10, toNumber(current.retention, data.quoteMeta?.integrationAuditRetention || 50));
    const logs = [entry, ...existingLogs].slice(0, retention);
    const providerKey = entry.provider;
    const nextProviders = {
      ...(current.providers || {}),
      [providerKey]: {
        ...((current.providers || {})[providerKey] || {}),
        state: entry.state,
        direction: entry.direction,
        occurredAtISO: entry.occurredAtISO,
        attempt: entry.attempt,
        message: entry.message,
        actorEmail: entry.actorEmail
      }
    };

    await updateDoc(quoteRef, {
      integrations: {
        ...current,
        providers: nextProviders,
        logs,
        lastSyncAtISO: entry.occurredAtISO,
        retention
      },
      updatedAtISO: entry.occurredAtISO
    });
    await syncPortalSnapshotFromQuoteDoc(id);
    return { ok: true, storage: "firebase", entry };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  let found = false;
  const next = existing.map((quote) => {
    if (quote.id !== id) return quote;
    found = true;
    const current = quote.integrations || {};
    const existingLogs = Array.isArray(current.logs) ? current.logs : [];
    const retention = Math.max(10, toNumber(current.retention, quote.quoteMeta?.integrationAuditRetention || 50));
    const logs = [entry, ...existingLogs].slice(0, retention);
    const providerKey = entry.provider;
    const nextProviders = {
      ...(current.providers || {}),
      [providerKey]: {
        ...((current.providers || {})[providerKey] || {}),
        state: entry.state,
        direction: entry.direction,
        occurredAtISO: entry.occurredAtISO,
        attempt: entry.attempt,
        message: entry.message,
        actorEmail: entry.actorEmail
      }
    };
    return {
      ...quote,
      updatedAtISO: entry.occurredAtISO,
      integrations: {
        ...current,
        providers: nextProviders,
        logs,
        lastSyncAtISO: entry.occurredAtISO,
        retention
      }
    };
  });

  if (!found) {
    throw new Error("Quote not found.");
  }

  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return { ok: true, storage: "local", entry };
}

export async function updateQuoteBookingAssignment({ quoteId, staffLead = "" } = {}) {
  const id = String(quoteId || "").trim();
  if (!id) {
    throw new Error("Quote id is required.");
  }
  const nowISO = isoNow();
  const nextLead = String(staffLead || "").trim();

  if (firebaseReady) {
    await updateDoc(doc(db, "quotes", id), {
      "booking.staffLead": nextLead,
      "booking.staffAssignedAtISO": nowISO,
      updatedAtISO: nowISO
    });
    await syncPortalSnapshotFromQuoteDoc(id);
    return { ok: true, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  let found = false;
  const next = existing.map((quote) => {
    if (quote.id !== id) return quote;
    found = true;
    const booking = hydrateBooking(quote.booking);
    return {
      ...quote,
      updatedAtISO: nowISO,
      booking: {
        ...booking,
        staffLead: nextLead,
        staffAssignedAtISO: nowISO
      }
    };
  });
  if (!found) {
    throw new Error("Quote not found.");
  }
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return { ok: true, storage: "local" };
}

export async function submitQuote({ form, totals, catalogSource, settings, ownerUid = "", ownerEmail = "" }) {
  const nowISO = isoNow();
  const quoteNumber = buildQuoteNumber();
  const portalKey = buildPortalKey();
  const normalizedCustomerEmail = normalizeEmail(form.email);
  const validityDays = Math.max(1, Number(settings?.quoteValidityDays || DEFAULT_VALIDITY_DAYS));
  const expiresAtISO = addDaysISO(nowISO, validityDays);
  const menuItems = Array.isArray(form.menuItems) ? form.menuItems : [];
  const menuItemDetails = resolveMenuItemDetails(menuItems, settings);
  const menuItemNames = menuItemDetails.map((item) => item.name);
  const payload = {
    quoteNumber,
    customer: {
      name: form.name || "",
      email: normalizedCustomerEmail,
      phone: form.phone || "",
      organization: form.clientOrg || ""
    },
    customerEmailKey: normalizedCustomerEmail,
    ownerUid: ownerUid || "",
    ownerEmail: normalizeEmail(ownerEmail),
    portalKey,
    event: {
      name: form.eventName || "",
      date: form.date || "",
      time: form.time || "",
      venue: form.venue || "",
      venueAddress: form.venueAddress || "",
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
    booking: {
      bookedAtISO: "",
      bookedByEmail: "",
      staffLead: "",
      staffAssignedAtISO: "",
      contractNumber: "",
      contractConvertedAtISO: "",
      contractConvertedByEmail: "",
      confirmationStatus: "pending",
      confirmationSentAtISO: "",
      confirmedAtISO: "",
      confirmationUpdatedByEmail: "",
      availabilityCheckedAtISO: "",
      availabilitySummary: {}
    },
    integrations: {
      retryLimit: Math.max(1, Number(settings?.integrationRetryLimit || 3)),
      retention: Math.max(10, Number(settings?.integrationAuditRetention || 50)),
      lastSyncAtISO: "",
      providers: {
        crm: {
          enabled: Boolean(settings?.crmEnabled),
          state: "idle",
          occurredAtISO: "",
          provider: settings?.crmProvider || "webhook"
        }
      },
      logs: []
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
      brandName: settings?.brandName || "",
      brandTagline: settings?.brandTagline || "",
      brandLogoUrl: settings?.brandLogoUrl || "",
      brandPrimaryColor: settings?.brandPrimaryColor || "",
      brandAccentColor: settings?.brandAccentColor || "",
      brandDarkAccentColor: settings?.brandDarkAccentColor || "",
      brandCrew: Array.isArray(settings?.brandCrew) ? settings.brandCrew : [],
      businessPhone: settings?.businessPhone || "",
      businessEmail: settings?.businessEmail || "",
      businessAddress: settings?.businessAddress || "",
      acceptanceEmail: settings?.acceptanceEmail || "",
      includeDisposables: form.includeDisposables !== false,
      disposablesNote: settings?.disposablesNote || "",
      depositNotice: settings?.depositNotice || "",
      quoteValidityDays: Number(settings?.quoteValidityDays || DEFAULT_VALIDITY_DAYS),
      crmEnabled: Boolean(settings?.crmEnabled),
      crmProvider: settings?.crmProvider || "webhook",
      crmWebhookUrl: settings?.crmWebhookUrl || "",
      crmAutoSyncOnSent: Boolean(settings?.crmAutoSyncOnSent),
      crmAutoSyncOnBooked: Boolean(settings?.crmAutoSyncOnBooked),
      integrationRetryLimit: Math.max(1, Number(settings?.integrationRetryLimit || 3)),
      integrationAuditRetention: Math.max(10, Number(settings?.integrationAuditRetention || 50))
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
    await setDoc(
      doc(db, PORTAL_COLLECTION, portalKey),
      buildPortalSnapshot(ref.id, payload),
      { merge: true }
    );
    return { id: ref.id, quoteNumber, portalKey, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const fallbackId = globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now());
  existing.unshift({ id: fallbackId, ...payload });
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(existing));
  return { id: existing[0].id, quoteNumber, portalKey, storage: "local" };
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
        autoExpired.map(async (quote) => {
          await updateDoc(doc(db, "quotes", quote.id), {
            status: "expired",
            updatedAtISO: nowISO,
            "lifecycle.expiredAtISO": quote.lifecycle?.expiredAtISO || nowISO
          });
          await syncPortalSnapshotFromQuoteDoc(quote.id);
        })
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
  const statusPayload = {
    status: nextStatus,
    updatedAtISO: nowISO,
    ...lifecyclePatch(nextStatus, nowISO)
  };
  if (nextStatus === "booked") {
    statusPayload["booking.bookedAtISO"] = nowISO;
  }

  if (firebaseReady) {
    await updateDoc(doc(db, "quotes", quoteId), statusPayload);
    await syncPortalSnapshotFromQuoteDoc(quoteId);
    return { ok: true, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const next = existing.map((quote) => {
    if (quote.id !== quoteId) return quote;
    const booking = hydrateBooking(quote.booking);
    return {
      ...quote,
      status: nextStatus,
      updatedAtISO: nowISO,
      booking:
        nextStatus === "booked"
          ? {
            ...booking,
            bookedAtISO: booking.bookedAtISO || nowISO
          }
          : booking,
      lifecycle: lifecycleObject(nextStatus, nowISO, quote.lifecycle)
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
    await syncPortalSnapshotFromQuoteDoc(quoteId);
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

export async function getPortalQuote(portalKey) {
  const key = String(portalKey || "").trim();
  if (!key) {
    throw new Error("Portal key is required.");
  }

  if (firebaseReady) {
    const snap = await getDoc(doc(db, PORTAL_COLLECTION, key));
    if (!snap.exists()) {
      throw new Error("Quote not found.");
    }
    return {
      portalKey: key,
      ...snap.data()
    };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const quote = existing.find((item) => item.portalKey === key);
  if (!quote) {
    throw new Error("Quote not found.");
  }
  return buildPortalSnapshot(quote.id, quote);
}

export async function updatePortalQuoteStatus(portalKey, status) {
  const key = String(portalKey || "").trim();
  if (!key) {
    throw new Error("Portal key is required.");
  }

  const nextStatus = normalizeStatus(status);
  if (!["viewed", "accepted", "declined"].includes(nextStatus)) {
    throw new Error("Invalid portal status.");
  }

  const nowISO = isoNow();

  if (firebaseReady) {
    const portalRef = doc(db, PORTAL_COLLECTION, key);
    const portalSnap = await getDoc(portalRef);
    if (!portalSnap.exists()) {
      throw new Error("Quote not found.");
    }
    const portalData = portalSnap.data();
    if (normalizeStatus(portalData.status) === "booked") {
      throw new Error("This quote is already booked and can no longer be changed from the portal.");
    }
    const lifecycle = lifecycleObject(nextStatus, nowISO, portalData.lifecycle);
    await updateDoc(portalRef, {
      status: nextStatus,
      updatedAtISO: nowISO,
      lifecycle
    });

    if (portalData.quoteId) {
      await updateDoc(doc(db, "quotes", portalData.quoteId), {
        status: nextStatus,
        updatedAtISO: nowISO,
        lifecycle
      });
    }
    return { ok: true, storage: "firebase" };
  }

  const existing = JSON.parse(localStorage.getItem(LOCAL_QUOTES_KEY) || "[]");
  const locked = existing.find((quote) => quote.portalKey === key && normalizeStatus(quote.status) === "booked");
  if (locked) {
    throw new Error("This quote is already booked and can no longer be changed from the portal.");
  }
  const next = existing.map((quote) => {
    if (quote.portalKey !== key) return quote;
    return {
      ...quote,
      status: nextStatus,
      updatedAtISO: nowISO,
      lifecycle: lifecycleObject(nextStatus, nowISO, quote.lifecycle)
    };
  });
  localStorage.setItem(LOCAL_QUOTES_KEY, JSON.stringify(next));
  return { ok: true, storage: "local" };
}

export function buildQuoteEmailTemplate(quote) {
  const emailPayload = buildQuoteEmailPayload(quote);
  return {
    subject: emailPayload.subject,
    body: emailPayload.body
  };
}

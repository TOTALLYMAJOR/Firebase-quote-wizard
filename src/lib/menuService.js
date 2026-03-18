import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  updateDoc,
  where
} from "firebase/firestore";
import { db, firebaseReady } from "./firebase";

function ensureReady() {
  if (!firebaseReady || !db) {
    throw new Error("Firebase is not configured.");
  }
}

function asText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizePriceType(value) {
  if (value === "per_person" || value === "per_item" || value === "per_event") {
    return value;
  }
  return "per_event";
}

function normalizeActive(value, fallback = true) {
  if (typeof value === "boolean") return value;
  return fallback;
}

function mapDocs(snapshot) {
  return snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
}

function sortByName(items) {
  return [...items].sort((a, b) => asText(a?.name).localeCompare(asText(b?.name)));
}

export async function getEventTypes() {
  if (!firebaseReady || !db) return [];
  const snap = await getDocs(query(collection(db, "eventTypes")));
  return sortByName(
    mapDocs(snap).map((item) => ({
      ...item,
      name: asText(item.name, "Untitled Event Type")
    }))
  );
}

export async function getMenuCategories(eventTypeId) {
  const nextEventTypeId = asText(eventTypeId);
  if (!nextEventTypeId || !firebaseReady || !db) return [];
  const snap = await getDocs(
    query(collection(db, "menuCategories"), where("eventTypeId", "==", nextEventTypeId))
  );
  return sortByName(
    mapDocs(snap).map((item) => ({
      ...item,
      eventTypeId: asText(item.eventTypeId),
      name: asText(item.name, "Untitled Category")
    }))
  );
}

export async function getMenuItems(eventTypeId, { includeInactive = false } = {}) {
  const nextEventTypeId = asText(eventTypeId);
  if (!nextEventTypeId || !firebaseReady || !db) return [];
  const snap = await getDocs(
    query(collection(db, "menuItems"), where("eventTypeId", "==", nextEventTypeId))
  );
  const mapped = mapDocs(snap).map((item) => {
    const pricingType = normalizePriceType(item.pricingType || item.type);
    return {
      ...item,
      eventTypeId: asText(item.eventTypeId),
      categoryId: asText(item.categoryId),
      name: asText(item.name, "Untitled Item"),
      price: asNumber(item.price, 0),
      pricingType,
      type: pricingType,
      active: normalizeActive(item.active, true)
    };
  });
  return sortByName(includeInactive ? mapped : mapped.filter((item) => item.active !== false));
}

export async function createMenuItem(data = {}) {
  ensureReady();
  const pricingType = normalizePriceType(data.pricingType || data.type);
  const payload = {
    eventTypeId: asText(data.eventTypeId),
    categoryId: asText(data.categoryId),
    name: asText(data.name, "New Menu Item"),
    price: asNumber(data.price, 0),
    pricingType,
    type: pricingType,
    active: normalizeActive(data.active, true),
    createdAtISO: new Date().toISOString()
  };
  if (!payload.eventTypeId) {
    throw new Error("eventTypeId is required.");
  }
  if (!payload.categoryId) {
    throw new Error("categoryId is required.");
  }
  const ref = await addDoc(collection(db, "menuItems"), payload);
  return {
    id: ref.id,
    ...payload
  };
}

export async function updateMenuItem(id, data = {}) {
  ensureReady();
  const itemId = asText(id);
  if (!itemId) {
    throw new Error("Menu item id is required.");
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = asText(data.name, "New Menu Item");
  }
  if (Object.prototype.hasOwnProperty.call(data, "price")) {
    payload.price = asNumber(data.price, 0);
  }
  if (Object.prototype.hasOwnProperty.call(data, "categoryId")) {
    payload.categoryId = asText(data.categoryId);
  }
  if (Object.prototype.hasOwnProperty.call(data, "eventTypeId")) {
    payload.eventTypeId = asText(data.eventTypeId);
  }
  if (Object.prototype.hasOwnProperty.call(data, "type")) {
    const pricingType = normalizePriceType(data.type);
    payload.pricingType = pricingType;
    payload.type = pricingType;
  }
  if (Object.prototype.hasOwnProperty.call(data, "pricingType")) {
    const pricingType = normalizePriceType(data.pricingType);
    payload.pricingType = pricingType;
    payload.type = pricingType;
  }
  if (Object.prototype.hasOwnProperty.call(data, "active")) {
    payload.active = normalizeActive(data.active, true);
  }
  payload.updatedAtISO = new Date().toISOString();

  await updateDoc(doc(db, "menuItems", itemId), payload);
  return {
    id: itemId,
    ...payload
  };
}

export async function deleteMenuItem(id) {
  ensureReady();
  const itemId = asText(id);
  if (!itemId) {
    throw new Error("Menu item id is required.");
  }
  await deleteDoc(doc(db, "menuItems", itemId));
  return { ok: true, id: itemId };
}

export async function createCategory(data = {}) {
  ensureReady();
  const payload = {
    eventTypeId: asText(data.eventTypeId),
    name: asText(data.name, "New Category"),
    createdAtISO: new Date().toISOString()
  };
  if (!payload.eventTypeId) {
    throw new Error("eventTypeId is required.");
  }
  const ref = await addDoc(collection(db, "menuCategories"), payload);
  return {
    id: ref.id,
    ...payload
  };
}

export async function updateCategory(id, data = {}) {
  ensureReady();
  const categoryId = asText(id);
  if (!categoryId) {
    throw new Error("Category id is required.");
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = asText(data.name, "New Category");
  }
  if (Object.prototype.hasOwnProperty.call(data, "eventTypeId")) {
    payload.eventTypeId = asText(data.eventTypeId);
  }
  payload.updatedAtISO = new Date().toISOString();

  await updateDoc(doc(db, "menuCategories", categoryId), payload);
  return {
    id: categoryId,
    ...payload
  };
}

export async function createEventType(data = {}) {
  ensureReady();
  const payload = {
    name: asText(data.name, "New Event Type"),
    createdAtISO: new Date().toISOString()
  };
  const ref = await addDoc(collection(db, "eventTypes"), payload);
  return {
    id: ref.id,
    ...payload
  };
}

export async function updateEventType(id, data = {}) {
  ensureReady();
  const eventTypeId = asText(id);
  if (!eventTypeId) {
    throw new Error("Event type id is required.");
  }

  const payload = {};
  if (Object.prototype.hasOwnProperty.call(data, "name")) {
    payload.name = asText(data.name, "New Event Type");
  }
  payload.updatedAtISO = new Date().toISOString();

  await updateDoc(doc(db, "eventTypes", eventTypeId), payload);
  return {
    id: eventTypeId,
    ...payload
  };
}

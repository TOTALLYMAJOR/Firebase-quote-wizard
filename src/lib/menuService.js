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
  return value === "per_person" ? "per_person" : "per_event";
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

export async function getMenuItems(eventTypeId) {
  const nextEventTypeId = asText(eventTypeId);
  if (!nextEventTypeId || !firebaseReady || !db) return [];
  const snap = await getDocs(
    query(collection(db, "menuItems"), where("eventTypeId", "==", nextEventTypeId))
  );
  return sortByName(
    mapDocs(snap).map((item) => ({
      ...item,
      eventTypeId: asText(item.eventTypeId),
      categoryId: asText(item.categoryId),
      name: asText(item.name, "Untitled Item"),
      price: asNumber(item.price, 0),
      type: normalizePriceType(item.type)
    }))
  );
}

export async function createMenuItem(data = {}) {
  ensureReady();
  const payload = {
    eventTypeId: asText(data.eventTypeId),
    categoryId: asText(data.categoryId),
    name: asText(data.name, "New Menu Item"),
    price: asNumber(data.price, 0),
    type: normalizePriceType(data.type),
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
    payload.type = normalizePriceType(data.type);
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
